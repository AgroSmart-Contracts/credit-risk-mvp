/**
 * Sentinel-2 L2A parcel imagery from Earth Search (Element 84 STAC on AWS Open Data).
 * Keyless: scenes are public Cloud-Optimised GeoTIFFs, so only the pixels around the
 * parcel are fetched (HTTP range requests), not whole 100 km tiles.
 *
 * For each scene: parcel-mean NDVI over clear pixels (SCL cloud mask), the share of
 * clear pixels, and two small RGBA images (true colour and NDVI) of the parcel area.
 */
import { fromUrl, type GeoTIFFImage } from "geotiff";
import proj4 from "proj4";
import type { SentinelScene } from "../../src/lib/pre-harvest/types.js";

const STAC = "https://earth-search.aws.element84.com/v1/search";
const TIMEOUT_MS = 60_000;

type StacItem = {
  id: string;
  properties: { datetime: string; "eo:cloud_cover": number; "proj:epsg"?: number; "proj:code"?: string };
  assets: Record<string, { href: string }>;
};

export async function searchScenes(lon: number, lat: number, from: string, to: string, maxCloud = 40): Promise<StacItem[]> {
  const out: StacItem[] = [];
  let body: Record<string, unknown> | null = {
    collections: ["sentinel-2-l2a"],
    intersects: { type: "Point", coordinates: [lon, lat] },
    datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
    query: { "eo:cloud_cover": { lt: maxCloud } },
    limit: 200,
    fields: { include: ["id", "properties", "assets.red.href", "assets.nir.href", "assets.scl.href", "assets.visual.href"], exclude: ["geometry", "links"] },
  };
  // Page through results; stop on an empty page, a repeated token, or a hard cap.
  const seenTokens = new Set<string>();
  for (let page = 0; body && page < 20; page++) {
    const res = await fetch(STAC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`STAC ${res.status}`);
    const json = (await res.json()) as { features: StacItem[]; links?: Array<{ rel: string; body?: Record<string, unknown> }> };
    if (!json.features.length) break;
    out.push(...json.features);
    const next = json.links?.find((l) => l.rel === "next");
    const token = next?.body ? JSON.stringify(next.body.next ?? next.body) : null;
    if (!token || seenTokens.has(token)) break;
    seenTokens.add(token);
    body = { ...body, ...next!.body };
  }
  // Earth Search sometimes lists a reprocessed duplicate (…_0_L2A / …_1_L2A): keep one per date.
  const byDate = new Map<string, StacItem>();
  for (const it of out.sort((a, b) => b.id.localeCompare(a.id))) {
    const d = it.properties.datetime.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, it);
  }
  return [...byDate.values()].sort((a, b) => a.properties.datetime.localeCompare(b.properties.datetime));
}

function epsgOf(item: StacItem): string {
  const code = item.properties["proj:code"] ?? (item.properties["proj:epsg"] ? `EPSG:${item.properties["proj:epsg"]}` : null);
  if (code) return code;
  // Fallback: UTM zone from the MGRS tile in the id (e.g. S2A_18LUK_… → zone 18, south).
  const zone = Number(item.id.split("_")[1].slice(0, 2));
  return `EPSG:327${String(zone).padStart(2, "0")}`;
}

function utmDef(epsg: string): string {
  const n = Number(epsg.replace("EPSG:", ""));
  const south = n >= 32700;
  const zone = n % 100;
  return `+proj=utm +zone=${zone} ${south ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
}

/** Read a window (in projected metres) from a COG, resampled to `size`×`size`. */
async function readWindow(href: string, bbox: [number, number, number, number], size: number, samples?: number[]) {
  const tiff = await fromUrl(href, { allowFullFile: false });
  const image: GeoTIFFImage = await tiff.getImage();
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  const x0 = Math.floor((bbox[0] - ox) / rx);
  const x1 = Math.ceil((bbox[2] - ox) / rx);
  const y0 = Math.floor((bbox[3] - oy) / ry); // ry is negative
  const y1 = Math.ceil((bbox[1] - oy) / ry);
  const rasters = await image.readRasters({
    window: [x0, y0, x1, y1],
    width: size,
    height: size,
    resampleMethod: "nearest",
    samples,
    interleave: false,
  });
  return rasters as unknown as ArrayLike<number>[];
}

// Sentinel-2 Scene Classification: 4 vegetation, 5 bare soil, 6 water, 7 unclassified (clear-ish).
const CLEAR = new Set([4, 5, 6, 7]);

/** NDVI → RGBA (brown → yellow → green), transparent where cloudy. */
function ndviColor(v: number): [number, number, number] {
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [150, 110, 70]],
    [0.25, [214, 189, 120]],
    [0.45, [190, 210, 110]],
    [0.6, [110, 175, 70]],
    [0.8, [30, 110, 40]],
  ];
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * t)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * Process one scene for a parcel.
 * @param parcel lon/lat ring of the parcel
 * @param marginM context margin around the parcel for the images
 */
export async function processScene(
  item: StacItem,
  parcel: Array<[number, number]>,
  opts: { marginM?: number; size?: number; images?: boolean } = {},
): Promise<SentinelScene | null> {
  const { marginM = 150, size = 64, images = true } = opts;
  const epsg = epsgOf(item);
  const toUtm = proj4("EPSG:4326", utmDef(epsg));
  const ring = parcel.map(([lon, lat]) => toUtm.forward([lon, lat]) as [number, number]);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const bbox: [number, number, number, number] = [
    Math.min(...xs) - marginM,
    Math.min(...ys) - marginM,
    Math.max(...xs) + marginM,
    Math.max(...ys) + marginM,
  ];
  const [red, nir, scl] = await Promise.all([
    readWindow(item.assets.red.href, bbox, size).then((r) => r[0]),
    readWindow(item.assets.nir.href, bbox, size).then((r) => r[0]),
    readWindow(item.assets.scl.href, bbox, size).then((r) => r[0]),
  ]);

  // Pixel centres → inside-parcel test (ray casting on the projected ring).
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const px = (bbox[2] - bbox[0]) / size;
  const py = (bbox[3] - bbox[1]) / size;

  let sum = 0;
  let clear = 0;
  let total = 0;
  const ndvi = new Float32Array(size * size);
  const lowShare = { below: 0 };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const n = nir[i];
      const rd = red[i];
      const v = n + rd > 0 ? (n - rd) / (n + rd) : 0;
      ndvi[i] = v;
      const x = bbox[0] + (c + 0.5) * px;
      const y = bbox[3] - (r + 0.5) * py;
      if (inside(x, y)) {
        total++;
        if (CLEAR.has(scl[i])) {
          clear++;
          sum += v;
        }
      }
    }
  }
  if (total === 0) return null;
  const clearPct = Math.round((clear / total) * 100);
  const mean = clear > 0 ? sum / clear : null;

  // Share of clear parcel pixels well below the parcel mean (heterogeneity / weak patches).
  if (mean !== null) {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const i = r * size + c;
        const x = bbox[0] + (c + 0.5) * px;
        const y = bbox[3] - (r + 0.5) * py;
        if (inside(x, y) && CLEAR.has(scl[i]) && ndvi[i] < mean * 0.8) lowShare.below++;
      }
  }

  const scene: SentinelScene = {
    id: item.id,
    date: item.properties.datetime.slice(0, 10),
    sceneCloudPct: Math.round(item.properties["eo:cloud_cover"]),
    parcelClearPct: clearPct,
    ndviMean: mean === null ? null : Math.round(mean * 1000) / 1000,
    weakPct: mean === null || clear === 0 ? null : Math.round((lowShare.below / clear) * 100),
    size,
    bboxLonLat: null,
    trueColor: null,
    ndviImage: null,
  };

  if (images) {
    const fromUtm = proj4(utmDef(epsg), "EPSG:4326");
    const sw = fromUtm.forward([bbox[0], bbox[1]]) as [number, number];
    const ne = fromUtm.forward([bbox[2], bbox[3]]) as [number, number];
    scene.bboxLonLat = [sw[0], sw[1], ne[0], ne[1]];

    const rgb = await readWindow(item.assets.visual.href, bbox, size, [0, 1, 2]);
    const tc = new Uint8Array(size * size * 4);
    const nd = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      tc[i * 4] = rgb[0][i];
      tc[i * 4 + 1] = rgb[1][i];
      tc[i * 4 + 2] = rgb[2][i];
      tc[i * 4 + 3] = 255;
      const [r, g, b] = ndviColor(ndvi[i]);
      nd[i * 4] = r;
      nd[i * 4 + 1] = g;
      nd[i * 4 + 2] = b;
      nd[i * 4 + 3] = CLEAR.has(scl[i]) ? 255 : 60;
    }
    scene.trueColor = b64(tc);
    scene.ndviImage = b64(nd);
  }
  return scene;
}
