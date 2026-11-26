/**
 * Mapa de predios: a secondary view (spec section 3). Where the money is, by
 * state: markers are labelled with the loan ID and coloured by state; the state
 * in words is in each popup and the list beside the map. Surveyed parcels show
 * their outline; the rest are marked at their zone and say so.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEO } from "../../data/bcp/technical";
import { bySeverity, cov, usd } from "../../lib/bcp/calc";
import type { Portfolio } from "../../lib/bcp/types";
import { STATE_SOLID, STATE_TEXT, useLang, useT } from "./shared";
import { Card, Lbl, StateChip } from "./ui";

/** Label offset from its marker, by side. */
const LABEL_OFFSET: Record<"left" | "right" | "top" | "bottom", [number, number]> = { left: [-10, 0], right: [10, 0], top: [0, -10], bottom: [0, 10] };
const IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function LeafletMap({ data, focus, onOpen }: { data: Portfolio; focus: string | null; onOpen: (id: string) => void }) {
  const lang = useLang();
  const el = useRef<HTMLDivElement>(null);
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer(IMAGERY, { maxZoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(m);
    const bounds: L.LatLngExpression[] = [];
    for (const loan of data.loans) {
      const g = GEO[loan.id];
      if (!g) continue;
      const color = STATE_SOLID[loan.state];
      if (g.ring) {
        const ring = g.ring.map(([x, y]) => [y, x] as [number, number]);
        L.polygon(ring, { color, weight: 2, fillOpacity: 0.25 }).addTo(m);
      }
      const marker = L.circleMarker([g.lat, g.lon], { radius: g.approximate ? 7 : 9, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1, dashArray: g.approximate ? "3 3" : undefined }).addTo(m);
      // Permanent label: the ID only. The state in words is in the popup and the list beside the map.
      marker.bindTooltip(loan.id, { permanent: true, direction: g.labelSide ?? "right", offset: LABEL_OFFSET[g.labelSide ?? "right"], className: "bcp-map-label" });
      const div = document.createElement("div");
      div.style.fontFamily = "Inter, system-ui, sans-serif";
      div.innerHTML = `<p style="margin:0;font-weight:700;font-size:13px">${loan.id} · ${loan.zone[lang]}</p>
        <p style="margin:2px 0;font-size:12px">${STATE_TEXT[loan.state][lang]} · ${lang === "es" ? "desembolsado" : "disbursed"} ${usd(loan.disbursedUsd)} · ${lang === "es" ? "cobertura" : "coverage"} ${cov(loan.coverageToday)}</p>
        ${g.approximate ? `<p style="margin:2px 0;font-size:11px;color:#4a5b6c">${lang === "es" ? "Ubicación aproximada de la zona" : "Approximate zone location"}</p>` : ""}`;
      const btn = document.createElement("button");
      btn.textContent = lang === "es" ? "Abrir expediente →" : "Open file →";
      btn.style.cssText = "font-weight:700;color:#0b6b48;text-decoration:underline;min-height:32px";
      btn.onclick = () => openRef.current(loan.id);
      div.appendChild(btn);
      marker.bindPopup(div, { maxWidth: 280 });
      if (g.ring) bounds.push(...g.ring.map(([x, y]) => [y, x] as [number, number]));
      bounds.push([g.lat, g.lon]);
      if (focus === loan.id) window.setTimeout(() => marker.openPopup(), 300);
    }
    // Applications: neutral marker labelled "Solicitud" (nothing disbursed yet).
    for (const a of data.applications) {
      const g = GEO[a.id];
      if (!g) continue;
      if (g.ring) L.polygon(g.ring.map(([x, y]) => [y, x] as [number, number]), { color: "#ffffff", weight: 2, dashArray: "4 4", fillOpacity: 0.1 }).addTo(m);
      const marker = L.circleMarker([g.lat, g.lon], { radius: 7, color: "#ffffff", weight: 2, fillColor: "#102a40", fillOpacity: 1, dashArray: g.approximate ? "3 3" : undefined }).addTo(m);
      marker.bindTooltip(a.id, { permanent: true, direction: g.labelSide ?? "right", offset: LABEL_OFFSET[g.labelSide ?? "right"], className: "bcp-map-label" });
      const div = document.createElement("div");
      div.style.fontFamily = "Inter, system-ui, sans-serif";
      div.innerHTML = `<p style="margin:0;font-weight:700;font-size:13px">${a.id} · ${a.zone[lang]}</p>
        <p style="margin:2px 0;font-size:12px">${lang === "es" ? "Solicitud" : "Application"} · ${usd(a.requestedUsd)} · ${a.recommendation === "rechazar" ? (lang === "es" ? "rechazo recomendado" : "decline recommended") : lang === "es" ? "aprobación recomendada" : "approval recommended"}</p>`;
      const btn = document.createElement("button");
      btn.textContent = lang === "es" ? "Abrir solicitud →" : "Open application →";
      btn.style.cssText = "font-weight:700;color:#0b6b48;text-decoration:underline;min-height:32px";
      btn.onclick = () => openRef.current(a.id);
      div.appendChild(btn);
      marker.bindPopup(div, { maxWidth: 280 });
      bounds.push([g.lat, g.lon]);
      if (focus === a.id) window.setTimeout(() => marker.openPopup(), 300);
    }
    const f = focus ? GEO[focus] : null;
    if (f) m.setView([f.lat, f.lon], f.ring ? 15 : 12);
    else if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [60, 60] });
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
    };
  }, [data, focus, lang]);

  return <div ref={el} className="h-[520px] w-full overflow-hidden rounded-lg border border-bcp-border" role="region" aria-label={lang === "es" ? "Mapa de predios" : "Parcel map"} />;
}

export function MapView({ data, focus, onOpen }: { data: Portfolio; focus: string | null; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <LeafletMap data={data} focus={focus} onOpen={onOpen} />
        <Card>
          <Lbl>{t("Préstamos en el mapa", "Loans on the map")}</Lbl>
          <ul className="mt-2 divide-y divide-bcp-divider">
            {[...data.loans].sort(bySeverity).map((l) => (
              <li key={l.id} className="py-2">
                <button type="button" onClick={() => onOpen(l.id)} className="w-full text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{l.id}</span>
                    <StateChip state={l.state} />
                  </span>
                  <span className="lbl block">
                    {t(l.zone)} · {usd(l.disbursedUsd)} · {cov(l.coverageToday)}
                    {GEO[l.id]?.approximate ? ` · ${t("ubicación aproximada", "approximate location")}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data.applications.length > 0 && (
            <>
              <Lbl className="mt-4">{t("Solicitudes", "Applications")}</Lbl>
              <ul className="mt-1 divide-y divide-bcp-divider">
                {data.applications.map((a) => (
                  <li key={a.id} className="py-2">
                    <button type="button" onClick={() => onOpen(a.id)} className="w-full text-left">
                      <span className="font-semibold">{a.id}</span>
                      <span className="lbl block">
                        {t(a.zone)} · {usd(a.requestedUsd)} · {a.recommendation === "rechazar" ? t("rechazo recomendado", "decline recommended") : t("aprobación recomendada", "approval recommended")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="lbl mt-3">{t("Contorno: predio medido. Punto con borde discontinuo: zona aproximada.", "Outline: surveyed parcel. Dot with a dashed outline: approximate zone.")}</p>
        </Card>
      </div>
    </div>
  );
}
