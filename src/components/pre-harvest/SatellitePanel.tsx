import { useEffect, useMemo, useRef, useState } from "react";
import { useSentinel, vsNormal } from "./sentinel-data";
import { Satellite } from "lucide-react";
import { formatDate, t } from "../../lib/pre-harvest/i18n";
import type { Lang, SentinelScene } from "../../lib/pre-harvest/types";
import { Card } from "./ui";

function decode(b64: string): Uint8ClampedArray<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8ClampedArray(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A small RGBA image drawn into a canvas, upscaled by CSS, with the parcel outline on top. */
function SceneImage({
  scene,
  which,
  parcel,
  label,
}: {
  scene: SentinelScene;
  which: "trueColor" | "ndviImage";
  parcel: Array<[number, number]>;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const b64 = scene[which];
    const ctx = ref.current?.getContext("2d");
    if (!b64 || !ctx) return;
    ctx.putImageData(new ImageData(decode(b64), scene.size, scene.size), 0, 0);
  }, [scene, which]);

  const [w, s, e, n] = scene.bboxLonLat ?? [0, 0, 1, 1];
  const pts = parcel.map(([lon, lat]) => `${((lon - w) / (e - w)) * scene.size},${((n - lat) / (n - s)) * scene.size}`).join(" ");

  return (
    <figure className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-tm-border bg-tm-neutral">
        <canvas
          ref={ref}
          width={scene.size}
          height={scene.size}
          className="h-full w-full"
          style={{ imageRendering: which === "ndviImage" ? "pixelated" : "auto" }}
          aria-label={label}
        />
        <svg viewBox={`0 0 ${scene.size} ${scene.size}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <polygon points={pts} fill="none" stroke="#ffffff" strokeWidth={0.8} strokeDasharray="2 1.2" />
        </svg>
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-tm-text-light">{label}</figcaption>
    </figure>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-tm-neutral-light px-3 py-2">
      <p className="text-[11px] text-tm-text-muted">{label}</p>
      <p className="font-display text-lg leading-tight text-tm-black">{value}</p>
    </div>
  );
}

export function SatellitePanel({ cutoff, parcelId, lang }: { cutoff: string; parcelId: string; lang: Lang }) {
  const data = useSentinel(parcelId);
  const visible = useMemo(() => (data ? data.scenes.filter((s) => s.date <= cutoff && s.trueColor) : []), [data, cutoff]);
  const [picked, setPicked] = useState<string | null>(null);
  // Follow the cut-off date unless the user picked an image that is still visible.
  const scene = visible.find((s) => s.id === picked) ?? visible.at(-1) ?? null;

  if (data === undefined) {
    return <div className="h-72 animate-pulse rounded-xl bg-tm-border/40" aria-busy="true" />;
  }
  if (!data || !scene) return null;

  const delta = vsNormal(data.series, scene);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="inline-flex items-center gap-1.5 font-display text-base text-tm-black">
            <Satellite className="h-4 w-4 text-tm-primary" />
            {t("satTitle", lang)}
          </h4>
          <p className="text-xs text-tm-text-light">{t("satSub", lang)}</p>
        </div>
        <span className="text-xs text-tm-text-muted">
          {formatDate(scene.date, lang)} · Sentinel-2 · 10 m
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.9fr]">
        <SceneImage scene={scene} which="trueColor" parcel={data.parcel} label={t("satTrueColor", lang)} />
        <SceneImage scene={scene} which="ndviImage" parcel={data.parcel} label={t("satNdvi", lang)} />
        <div className="grid grid-cols-2 content-start gap-2 md:grid-cols-1">
          <Stat label={t("satParcelNdvi", lang)} value={scene.ndviMean === null ? "–" : scene.ndviMean.toFixed(2)} />
          <Stat label={t("satVsNormal", lang)} value={delta === null ? "–" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}%`} />
          <Stat label={t("satWeak", lang)} value={scene.weakPct === null ? "–" : `${scene.weakPct}%`} />
          <Stat label={t("satClear", lang)} value={`${scene.parcelClearPct}%`} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-tm-text-muted">NDVI</span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{ background: "linear-gradient(90deg, #966e46, #d6bd78 31%, #bed26e 56%, #6eaf46 75%, #1e6e28)" }}
        />
        <span className="text-[11px] text-tm-text-muted">0 → 0.8+</span>
      </div>

      <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={t("satHistory", lang)}>
        {visible.map((s) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={s.id === scene.id}
            onClick={() => setPicked(s.id)}
            className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
              s.id === scene.id ? "border-tm-primary bg-tm-primary text-white" : "border-tm-border text-tm-text-light hover:text-tm-black"
            }`}
          >
            {formatDate(s.date, lang)}
            {s.ndviMean !== null && <span className="ml-1 opacity-70">{s.ndviMean.toFixed(2)}</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-tm-text-muted">{t("satSource", lang)}</p>
    </Card>
  );
}
