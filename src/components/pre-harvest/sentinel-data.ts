import { useEffect, useState } from "react";
import { CROP_THRESHOLDS as CT } from "../../lib/pre-harvest/config";
import type { SentinelFixture, SentinelScene } from "../../lib/pre-harvest/types";

const cache = new Map<string, Promise<SentinelFixture | null>>();
const load = (parcelId: string) => {
  if (!cache.has(parcelId)) {
    cache.set(
      parcelId,
      fetch(`/pre-harvest/sentinel-${parcelId}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<SentinelFixture>) : null))
        .catch(() => null),
    );
  }
  return cache.get(parcelId)!;
};

export function useSentinel(parcelId: string) {
  const [data, setData] = useState<SentinelFixture | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    load(parcelId).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [parcelId]);
  return data;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const doy = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return Math.floor((Date.UTC(2001, m - 1, Math.min(day, 28 + (m === 2 ? 0 : 3))) - Date.UTC(2001, 0, 1)) / 86_400_000);
};

/** Parcel NDVI on `date` vs the parcel's own median for the same season in the previous 5 years. */
export function vsNormal(series: SentinelFixture["series"], scene: SentinelScene): number | null {
  if (scene.ndviMean === null) return null;
  const y = Number(scene.date.slice(0, 4));
  const target = doy(scene.date);
  const same = series.filter((p) => {
    const py = Number(p.date.slice(0, 4));
    const dd = Math.abs(doy(p.date) - target);
    return py < y && py >= y - CT.baselineYears && Math.min(dd, 365 - dd) <= 15;
  });
  if (same.length < 3) return null;
  const m = median(same.map((p) => p.ndviMean));
  return Math.round(((scene.ndviMean - m) / m) * 100);
}

