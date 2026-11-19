/**
 * Parcel images (Sentinel-2, 10 m) for files with a surveyed parcel: natural
 * colour and the vigour map, with the parcel outline, and a strip of earlier
 * passes. Images only; the vigour reading the bank acts on is in the file.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSentinel } from "../pre-harvest/sentinel-data";
import type { SentinelScene } from "../../lib/pre-harvest/types";
import { date } from "../../lib/bcp/calc";
import { useLang, useT } from "./shared";

function decode(b64: string): Uint8ClampedArray<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8ClampedArray(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function Scene({ scene, which, ring, label }: { scene: SentinelScene; which: "trueColor" | "ndviImage"; ring: Array<[number, number]>; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const b64 = scene[which];
    const ctx = ref.current?.getContext("2d");
    if (b64 && ctx) ctx.putImageData(new ImageData(decode(b64), scene.size, scene.size), 0, 0);
  }, [scene, which]);
  const [w, s, e, n] = scene.bboxLonLat ?? [0, 0, 1, 1];
  const pts = ring.map(([lon, lat]) => `${((lon - w) / (e - w)) * scene.size},${((n - lat) / (n - s)) * scene.size}`).join(" ");
  return (
    <figure>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-bcp-border bg-bcp-fill">
        <canvas ref={ref} width={scene.size} height={scene.size} className="h-full w-full" style={{ imageRendering: which === "ndviImage" ? "pixelated" : "auto" }} aria-label={label} />
        <svg viewBox={`0 0 ${scene.size} ${scene.size}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <polygon points={pts} fill="none" stroke="#ffffff" strokeWidth={0.8} strokeDasharray="2 1.2" />
        </svg>
      </div>
      <figcaption className="lbl mt-1 text-center">{label}</figcaption>
    </figure>
  );
}

export function FieldImages({ parcelId, ring, cutoff }: { parcelId: string; ring: Array<[number, number]>; cutoff: string }) {
  const t = useT();
  const lang = useLang();
  const data = useSentinel(parcelId);
  const scenes = useMemo(() => (data ? data.scenes.filter((s) => s.date <= cutoff && s.trueColor) : []), [data, cutoff]);
  const [picked, setPicked] = useState<string | null>(null);
  const scene = scenes.find((s) => s.id === picked) ?? scenes.at(-1) ?? null;
  if (data === undefined) return <div className="h-64 rounded-lg bg-bcp-fill" aria-busy="true" />;
  if (!scene) return <p className="text-sm text-bcp-muted">{t("Sin imagen despejada a la fecha de corte.", "No clear image at the cut-off date.")}</p>;
  return (
    <div className="max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Scene scene={scene} which="trueColor" ring={ring} label={t("Color natural", "Natural colour")} />
        <Scene scene={scene} which="ndviImage" ring={ring} label={t("Mapa de vigor del cultivo", "Crop vigour map")} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="lbl">{t("bajo", "low")}</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, #966e46, #d6bd78 31%, #bed26e 56%, #6eaf46 75%, #1e6e28)" }} aria-hidden />
        <span className="lbl">{t("alto", "high")}</span>
      </div>
      <div role="listbox" aria-label={t("Pases anteriores", "Earlier passes")} className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {scenes.slice(-10).map((s) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={s.id === scene.id}
            onClick={() => setPicked(s.id)}
            className={`min-h-[36px] shrink-0 rounded-md border px-2 text-xs font-semibold ${s.id === scene.id ? "border-bcp-ink bg-bcp-ink text-white" : "border-bcp-border text-bcp-ink"}`}
          >
            {date(s.date, lang, false)}
          </button>
        ))}
      </div>
      <p className="lbl mt-1">
        {t(`Sentinel-2 · 10 m · pase del ${date(scene.date, "es")} · línea punteada: el predio monitoreado`, `Sentinel-2 · 10 m · pass of ${date(scene.date, "en")} · dashed line: the monitored parcel`)}
      </p>
    </div>
  );
}
