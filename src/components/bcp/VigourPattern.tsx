/**
 * Bank edition: the seasonal vigour pattern of a parcel by calendar month, against an
 * evergreen reference. It shows the crop mismatch without imagery, dates or location.
 */
import { SectionTitle } from "./ui";
import { useT } from "./shared";

const W = 640;
const H = 200;
const PAD = 32;
const MONTHS = { es: "EFMAMJJASOND", en: "JFMAMJJASOND" };

export function VigourPattern({ points }: { points: { month: number; value: number; reference: number }[] }) {
  const t = useT();
  const x = (m: number) => PAD + ((m - 1) / 11) * (W - PAD * 2);
  const y = (v: number) => H - PAD - v * (H - PAD * 2);
  const line = (k: "value" | "reference") => points.map((p) => `${x(p.month)},${y(p[k])}`).join(" ");
  const low = Math.min(...points.map((p) => p.value));
  return (
    <figure>
      <SectionTitle title={t("Patrón de vigor del predio", "Parcel vigour pattern")} sub={t("mediana por mes del año, 2022 a 2026 · datos satelitales reales, anonimizados", "median by month of the year, 2022 to 2026 · real satellite data, anonymised")} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(`El vigor del predio baja a ${low.toFixed(2)} en su mes más bajo; un huerto perenne de referencia se mantiene estable.`, `The parcel's vigour falls to ${low.toFixed(2)} in its lowest month; an evergreen reference orchard stays stable.`)} className="mt-2 w-full">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="#eef2f5" />
            <text x={PAD - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4a5b6c">{v.toFixed(1)}</text>
          </g>
        ))}
        {points.map((p) => (
          <text key={p.month} x={x(p.month)} y={H - 10} textAnchor="middle" fontSize="11" fill="#4a5b6c">{MONTHS[t("es", "en") as "es" | "en"][p.month - 1]}</text>
        ))}
        <polyline points={line("reference")} fill="none" stroke="#0f9d6b" strokeWidth="2" strokeDasharray="6 4" />
        <polyline points={line("value")} fill="none" stroke="#102a40" strokeWidth="2.5" />
      </svg>
      <figcaption className="lbl mt-1">{t("Línea continua: este predio · línea discontinua: huerto perenne de referencia, sin relación con el solicitante", "Solid line: this parcel · dashed line: evergreen reference orchard, unrelated to the applicant")}</figcaption>
    </figure>
  );
}
