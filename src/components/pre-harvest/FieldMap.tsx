import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Severity } from "../../lib/pre-harvest/types";
import { CHART_COLORS } from "./theme";

const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Square parcel of `areaHa` hectares centred on the field point. */
function parcel(lat: number, lon: number, areaHa: number): L.LatLngExpression[] {
  const half = Math.sqrt(Math.max(areaHa, 0.1) * 10_000) / 2;
  const dLat = half / 111_320;
  const dLon = half / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lon - dLon],
    [lat - dLat, lon + dLon],
    [lat + dLat, lon + dLon],
    [lat + dLat, lon - dLon],
  ];
}

// Neutral (white) outline when the crop is fine; colour only when it is not.
const colorFor = (s: Severity) => (s === "green" ? "#ffffff" : s === "yellow" ? CHART_COLORS.yellow : CHART_COLORS.red);

export function FieldMap({
  lat,
  lon,
  areaHa,
  ring,
  severity,
}: {
  lat: number;
  lon: number;
  areaHa: number;
  /** Surveyed parcel boundary as [lon, lat] pairs; falls back to a square of `areaHa`. */
  ring?: Array<[number, number]>;
  severity: Severity;
}) {
  const outline = (): L.LatLngExpression[] => (ring ? ring.map(([x, y]) => [y, x] as [number, number]) : parcel(lat, lon, areaHa));
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const shape = useRef<L.Polygon | null>(null);

  // Create the map once. Prop changes update it in place, so the imagery is not
  // re-downloaded on every edit or replay step.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [lat, lon], zoom: 15, scrollWheelZoom: false });
    L.tileLayer(IMAGERY, { maxZoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(m);
    shape.current = L.polygon(outline(), { weight: 2, fillOpacity: 0.15 }).addTo(m);
    map.current = m;

    // Leaflet sizes itself on creation; re-measure when the container is shown
    // again after being hidden behind another tab.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      shape.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; updated below
  }, []);

  useEffect(() => {
    shape.current?.setLatLngs(outline());
    map.current?.setView([lat, lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outline() derives from these
  }, [lat, lon, areaHa, ring]);

  useEffect(() => {
    const color = colorFor(severity);
    shape.current?.setStyle({ color, fillColor: color });
  }, [severity]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-lg border border-tm-border print:h-56" />;
}
