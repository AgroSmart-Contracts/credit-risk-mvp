/** Bank edition of the map: exposure by region. Exact locations are for pilot users only. */
import { cov, usd } from "../lib/bcp/calc";
import type { Portfolio } from "../lib/bcp/types";
import { ExampleChip, Card, SectionTitle, StateChip } from "../components/bcp/ui";
import { useT } from "../components/bcp/shared";

export function MapView({ data, onOpen }: { data: Portfolio; focus: string | null; onOpen: (id: string) => void }) {
  const t = useT();
  const regions = [...new Set(data.loans.map((l) => t(l.zone)))];
  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <ExampleChip kind="portfolio" />
      <SectionTitle title={t("Vista regional", "Regional view")} sub={t("exposición por región y estado", "exposure by region and state")} />
      {regions.map((r) => {
        const loans = data.loans.filter((l) => t(l.zone) === r);
        return (
          <Card key={r}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-[18px] font-bold">{r}</h2>
              <p className="num font-semibold">{usd(loans.reduce((s, l) => s + l.disbursedUsd, 0))}</p>
            </div>
            <ul className="divide-y divide-bcp-divider">
              {loans.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onOpen(l.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left hover:underline">
                    <span className="font-semibold">{l.id}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="num">{usd(l.disbursedUsd)} · {cov(l.coverageToday)}</span>
                      <StateChip state={l.state} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <p className="lbl">{t("Las ubicaciones exactas y el mapa de predios se habilitan para los expedientes del piloto.", "Exact locations and the parcel map are enabled for pilot files.")}</p>
    </div>
  );
}
