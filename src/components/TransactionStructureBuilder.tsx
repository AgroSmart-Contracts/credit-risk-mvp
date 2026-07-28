import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type {
  CostLine,
  CostUnit,
  DealFixedCost,
  DealLeg,
  DealPurpose,
  LegType,
  SensitivityTable,
  TransactionStructureInput,
} from "../lib/transaction-structure/types";
import { buildTransactionStructureReport } from "../lib/transaction-structure/compute";
import { formatUSD, formatUSDDetailed } from "../lib/assessment";

interface TransactionStructureBuilderProps {
  value: TransactionStructureInput;
  onChange: (next: TransactionStructureInput) => void;
  dealValueUSD: number;
  advancePaymentPct: number;
  contractType: string;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function blankCostLine(label = "Packing / logistics"): CostLine {
  return { id: nextId("cost"), label, amountPerUnit: 0, unit: "per_carton", taxRatePct: 0 };
}

function blankLeg(legType: LegType = "sourcing"): DealLeg {
  return {
    id: nextId("leg"),
    label: legType === "sourcing" ? "Sourcing leg" : legType === "exw" ? "EXW leg" : "FOB-ready leg",
    legType,
    grossKg: 0,
    discardPct: legType === "sourcing" ? 0.1 : 0,
    kgPerCarton: 1.5,
    priceBasis: legType === "sourcing" ? "gross_kg" : "packed_kg",
    purchasePricePerKg: 0,
    variableCosts: [blankCostLine()],
  };
}

function blankFixedCost(): DealFixedCost {
  return { id: nextId("fixed"), label: "Logistics to port", amountUSD: 0 };
}

const TIER_BADGE: Record<string, string> = {
  Strong: "border-tm-primary bg-tm-primary/10 text-tm-primary-dark",
  Adequate: "border-tm-blue bg-tm-blue/10 text-tm-blue",
  Weak: "border-tm-accent bg-tm-accent/10 text-tm-accent-dark",
  Insufficient: "border-tm-danger bg-tm-danger/10 text-tm-danger-dark",
};

function marginCellColor(marginPct: number): string {
  if (marginPct < 0) return "bg-tm-danger/15 text-tm-danger-dark";
  if (marginPct < 8) return "bg-tm-accent/15 text-tm-accent-dark";
  if (marginPct < 15) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (marginPct < 22) return "bg-tm-primary/10 text-tm-primary-dark";
  return "bg-tm-primary/25 text-tm-primary-dark";
}

export function TransactionStructureBuilder({
  value,
  onChange,
  dealValueUSD,
  advancePaymentPct,
  contractType,
}: TransactionStructureBuilderProps) {
  const [expanded, setExpanded] = useState(false);
  const [previewCollectionPct, setPreviewCollectionPct] = useState(100);

  const report = useMemo(
    () => buildTransactionStructureReport(value, dealValueUSD, advancePaymentPct, contractType),
    [value, dealValueUSD, advancePaymentPct, contractType],
  );

  const previewCashCollected =
    report.score.cashFlow.buyerFirstAmount + report.score.cashFlow.buyerFinalAmount * (previewCollectionPct / 100);
  const previewMargin = previewCashCollected - report.resolved.purchaseTotal;

  const update = (patch: Partial<TransactionStructureInput>) => onChange({ ...value, ...patch });

  const updateLeg = (id: string, patch: Partial<DealLeg>) =>
    update({ legs: value.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const removeLeg = (id: string) => update({ legs: value.legs.filter((l) => l.id !== id) });
  const addLeg = () => update({ legs: [...value.legs, blankLeg()] });

  const updateCostLine = (legId: string, costId: string, patch: Partial<CostLine>) =>
    updateLeg(legId, {
      variableCosts: (value.legs.find((l) => l.id === legId)?.variableCosts ?? []).map((c) =>
        c.id === costId ? { ...c, ...patch } : c,
      ),
    });
  const addCostLine = (legId: string) => {
    const leg = value.legs.find((l) => l.id === legId);
    if (!leg) return;
    updateLeg(legId, { variableCosts: [...leg.variableCosts, blankCostLine("Additional cost")] });
  };
  const removeCostLine = (legId: string, costId: string) => {
    const leg = value.legs.find((l) => l.id === legId);
    if (!leg) return;
    updateLeg(legId, { variableCosts: leg.variableCosts.filter((c) => c.id !== costId) });
  };

  const updateFixedCost = (id: string, patch: Partial<DealFixedCost>) =>
    update({ fixedCosts: value.fixedCosts.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeFixedCost = (id: string) => update({ fixedCosts: value.fixedCosts.filter((f) => f.id !== id) });
  const addFixedCost = () => update({ fixedCosts: [...value.fixedCosts, blankFixedCost()] });

  return (
    <section className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-tm-black">Transaction structure — cash flow &amp; sensitivity</h3>
          <p className="mt-0.5 text-xs text-tm-text-light">
            Optional. Model supply legs, cost stack, payment tranches, and insurance to drive Dimension
            D from a real cash-flow engine instead of the default category-based estimate.
          </p>
        </div>
        <span
          className={`ml-3 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_BADGE[report.score.tier]}`}
        >
          {report.score.tier} · {report.score.composite}
        </span>
        {expanded ? <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-tm-text-muted" /> : <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-tm-text-muted" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          <KpiStrip report={report} />

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-5">
              <DealPurposeFields value={value} onChange={update} />
              <LegsEditor
                legs={value.legs}
                onUpdateLeg={updateLeg}
                onRemoveLeg={removeLeg}
                onAddLeg={addLeg}
                onUpdateCostLine={updateCostLine}
                onAddCostLine={addCostLine}
                onRemoveCostLine={removeCostLine}
              />
              <FixedCostsEditor
                costs={value.fixedCosts}
                onUpdate={updateFixedCost}
                onRemove={removeFixedCost}
                onAdd={addFixedCost}
              />
              <SalePriceField value={value} onChange={update} totalKg={report.kpis.totalKg} />
              <TranchesEditor value={value} onChange={update} />
              <InsuranceFields value={value} onChange={update} />
            </div>

            <div className="space-y-5">
              <CashTimeline report={report} />
              {report.legResults.length > 0 && <LegComparison report={report} />}
              <CollectionPreview
                previewCollectionPct={previewCollectionPct}
                onChange={setPreviewCollectionPct}
                previewMargin={previewMargin}
                finalTrancheAmount={report.score.cashFlow.buyerFinalAmount}
              />
              <ScoreBreakdownPanel report={report} />
            </div>
          </div>

          <div className="space-y-6">
            {report.sensitivity.map((table, i) => (
              <SensitivityTableView key={i} table={table} />
            ))}
          </div>

          {report.resolved.missingFields.length > 0 && (
            <p className="text-xs text-tm-text-muted">
              Using defaults for: {report.resolved.missingFields.join(", ")}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-tm-text">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm text-tm-black focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20"
        />
        {suffix && <span className="shrink-0 text-xs text-tm-text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-tm-text">
        <span>{label}</span>
        <span className="font-semibold text-tm-black">{format(value)}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tm-primary"
      />
    </label>
  );
}

function DealPurposeFields({
  value,
  onChange,
}: {
  value: TransactionStructureInput;
  onChange: (patch: Partial<TransactionStructureInput>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-tm-text">Deal purpose</span>
        <select
          value={value.dealPurpose ?? "Export"}
          onChange={(e) => onChange({ dealPurpose: e.target.value as DealPurpose })}
          className="w-full rounded-lg border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm text-tm-black focus:border-tm-primary focus:outline-none"
        >
          {(["Export", "Retail", "Processing", "Resale"] as const).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-4 pb-1.5">
        <label className="flex items-center gap-1.5 text-xs text-tm-text">
          <input
            type="checkbox"
            checked={value.tmProductOwnership ?? true}
            onChange={(e) => onChange({ tmProductOwnership: e.target.checked })}
          />
          TM ownership
        </label>
        <label className="flex items-center gap-1.5 text-xs text-tm-text">
          <input
            type="checkbox"
            checked={value.collectionRights ?? true}
            onChange={(e) => onChange({ collectionRights: e.target.checked })}
          />
          Collection rights (CISG)
        </label>
      </div>
    </div>
  );
}

function LegsEditor({
  legs,
  onUpdateLeg,
  onRemoveLeg,
  onAddLeg,
  onUpdateCostLine,
  onAddCostLine,
  onRemoveCostLine,
}: {
  legs: DealLeg[];
  onUpdateLeg: (id: string, patch: Partial<DealLeg>) => void;
  onRemoveLeg: (id: string) => void;
  onAddLeg: () => void;
  onUpdateCostLine: (legId: string, costId: string, patch: Partial<CostLine>) => void;
  onAddCostLine: (legId: string) => void;
  onRemoveCostLine: (legId: string, costId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-tm-black">Supply legs</h4>
        <button
          type="button"
          onClick={onAddLeg}
          className="inline-flex items-center gap-1 rounded-lg border border-tm-border px-2 py-1 text-xs font-medium text-tm-primary hover:border-tm-primary"
        >
          <Plus className="h-3 w-3" /> Add leg
        </button>
      </div>
      {legs.length === 0 && (
        <p className="text-xs text-tm-text-muted">
          No legs yet — add one per supplier relationship. Sourcing legs pay for gross kg (discard
          applies); EXW/FOB-ready legs pay for already-packed kg.
        </p>
      )}
      {legs.map((leg) => (
        <div key={leg.id} className="rounded-lg border border-tm-border bg-tm-neutral-light/60 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              value={leg.label}
              onChange={(e) => onUpdateLeg(leg.id, { label: e.target.value })}
              className="flex-1 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-sm font-medium text-tm-black focus:border-tm-primary focus:outline-none"
            />
            <select
              value={leg.legType}
              onChange={(e) => {
                const legType = e.target.value as LegType;
                onUpdateLeg(leg.id, {
                  legType,
                  discardPct: legType === "sourcing" ? leg.discardPct : 0,
                  priceBasis: legType === "sourcing" ? "gross_kg" : "packed_kg",
                });
              }}
              className="rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
            >
              <option value="sourcing">Sourcing</option>
              <option value="exw">EXW</option>
              <option value="fob_ready">FOB-ready</option>
            </select>
            <button type="button" onClick={() => onRemoveLeg(leg.id)} className="text-tm-text-muted hover:text-tm-danger">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumField
              label={leg.legType === "sourcing" ? "Gross kg" : "Packed/net kg"}
              value={leg.grossKg}
              onChange={(v) => onUpdateLeg(leg.id, { grossKg: v })}
              step={100}
            />
            {leg.legType === "sourcing" && (
              <NumField
                label="Discard %"
                value={Math.round(leg.discardPct * 100)}
                onChange={(v) => onUpdateLeg(leg.id, { discardPct: v / 100 })}
                step={1}
                min={0}
                suffix="%"
              />
            )}
            <NumField
              label="Kg per carton"
              value={leg.kgPerCarton}
              onChange={(v) => onUpdateLeg(leg.id, { kgPerCarton: v })}
              step={0.1}
              min={0.01}
            />
            <NumField
              label={`Price / kg (${leg.priceBasis === "gross_kg" ? "gross" : "packed"})`}
              value={leg.purchasePricePerKg}
              onChange={(v) => onUpdateLeg(leg.id, { purchasePricePerKg: v })}
              step={0.01}
              suffix="$"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-muted">
                Variable costs
              </span>
              <button
                type="button"
                onClick={() => onAddCostLine(leg.id)}
                className="text-[11px] font-medium text-tm-primary hover:text-tm-primary-dark"
              >
                + add cost line
              </button>
            </div>
            {leg.variableCosts.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <input
                  value={c.label}
                  onChange={(e) => onUpdateCostLine(leg.id, c.id, { label: e.target.value })}
                  className="w-28 shrink-0 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
                />
                <input
                  type="number"
                  value={c.amountPerUnit}
                  step={0.01}
                  onChange={(e) => onUpdateCostLine(leg.id, c.id, { amountPerUnit: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
                />
                <select
                  value={c.unit}
                  onChange={(e) => onUpdateCostLine(leg.id, c.id, { unit: e.target.value as CostUnit })}
                  className="rounded-lg border border-tm-border bg-tm-surface px-1.5 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
                >
                  <option value="per_carton">$/carton</option>
                  <option value="per_kg">$/kg</option>
                  <option value="flat">flat $</option>
                </select>
                <input
                  type="number"
                  value={c.taxRatePct}
                  step={1}
                  onChange={(e) => onUpdateCostLine(leg.id, c.id, { taxRatePct: Number(e.target.value) })}
                  className="w-14 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
                  title="Tax %"
                />
                <span className="text-[10px] text-tm-text-muted">% tax</span>
                <button
                  type="button"
                  onClick={() => onRemoveCostLine(leg.id, c.id)}
                  className="ml-auto text-tm-text-muted hover:text-tm-danger"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixedCostsEditor({
  costs,
  onUpdate,
  onRemove,
  onAdd,
}: {
  costs: DealFixedCost[];
  onUpdate: (id: string, patch: Partial<DealFixedCost>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-tm-black">Per-deal fixed costs</h4>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-tm-border px-2 py-1 text-xs font-medium text-tm-primary hover:border-tm-primary"
        >
          <Plus className="h-3 w-3" /> Add cost
        </button>
      </div>
      <p className="text-[11px] text-tm-text-muted">
        Dilutes across all legs' pooled volume — quality/opex, money transfer, port logistics.
      </p>
      {costs.map((c) => (
        <div key={c.id} className="flex items-center gap-1.5">
          <input
            value={c.label}
            onChange={(e) => onUpdate(c.id, { label: e.target.value })}
            className="flex-1 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
          />
          <input
            type="number"
            value={c.amountUSD}
            step={10}
            onChange={(e) => onUpdate(c.id, { amountUSD: Number(e.target.value) })}
            className="w-24 rounded-lg border border-tm-border bg-tm-surface px-2 py-1 text-xs text-tm-black focus:border-tm-primary focus:outline-none"
          />
          <span className="text-[10px] text-tm-text-muted">USD</span>
          <button type="button" onClick={() => onRemove(c.id)} className="text-tm-text-muted hover:text-tm-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function SalePriceField({
  value,
  onChange,
  totalKg,
}: {
  value: TransactionStructureInput;
  onChange: (patch: Partial<TransactionStructureInput>) => void;
  totalKg: number;
}) {
  const price = value.salePricePerKg ?? 0;
  const hasLegs = value.legs.length > 0;
  return (
    <div className="space-y-1.5 rounded-lg border border-tm-border bg-tm-neutral-light/60 p-3">
      <SliderField
        label={`Sale (FOB) price — total ${totalKg > 0 ? formatUSD(totalKg * price) : "n/a"}`}
        value={price}
        onChange={(v) => onChange({ salePricePerKg: v })}
        min={0}
        max={Math.max(5, price * 2 || 20)}
        step={0.01}
        format={(v) => `$${v.toFixed(2)}/kg`}
      />
      {!hasLegs && (
        <p className="text-[11px] text-tm-text-muted">
          No legs entered — enter purchase/sale totals directly below instead.
        </p>
      )}
      {!hasLegs && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="Purchase total (USD)"
            value={value.purchaseTotalUSD ?? 0}
            onChange={(v) => onChange({ purchaseTotalUSD: v })}
            step={100}
          />
          <NumField
            label="Sale total (USD)"
            value={value.saleTotalUSD ?? 0}
            onChange={(v) => onChange({ saleTotalUSD: v })}
            step={100}
          />
        </div>
      )}
    </div>
  );
}

function TranchesEditor({
  value,
  onChange,
}: {
  value: TransactionStructureInput;
  onChange: (patch: Partial<TransactionStructureInput>) => void;
}) {
  const rows: Array<{
    label: string;
    day: number;
    pct: number;
    onDay: (v: number) => void;
    onPct: (v: number) => void;
  }> = [
    {
      label: "Supplier advance",
      day: value.supAdvDay ?? 0,
      pct: (value.supAdvPct ?? 0) * 100,
      onDay: (v) => onChange({ supAdvDay: v }),
      onPct: (v) => onChange({ supAdvPct: v / 100 }),
    },
    {
      label: "Supplier final",
      day: value.supFinDay ?? 0,
      pct: (value.supFinPct ?? 0) * 100,
      onDay: (v) => onChange({ supFinDay: v }),
      onPct: (v) => onChange({ supFinPct: v / 100 }),
    },
    {
      label: "Buyer first payment",
      day: value.buyFirstDay ?? 0,
      pct: (value.buyFirstPct ?? 0) * 100,
      onDay: (v) => onChange({ buyFirstDay: v }),
      onPct: (v) => onChange({ buyFirstPct: v / 100 }),
    },
    {
      label: "Buyer final payment",
      day: value.buyFinalDay ?? 0,
      pct: (value.buyFinalPct ?? 0) * 100,
      onDay: (v) => onChange({ buyFinalDay: v }),
      onPct: (v) => onChange({ buyFinalPct: v / 100 }),
    },
  ];
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-tm-black">Payment tranches</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-xs">
          <thead>
            <tr className="text-tm-text-muted">
              <th className="pb-1 pr-2 font-semibold">Tranche</th>
              <th className="pb-1 pr-2 font-semibold">Day</th>
              <th className="pb-1 font-semibold">% of total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-tm-border/60">
                <td className="py-1 pr-2 text-tm-text">{row.label}</td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    value={row.day}
                    onChange={(e) => row.onDay(Number(e.target.value))}
                    className="w-16 rounded border border-tm-border bg-tm-surface px-1.5 py-0.5 text-xs focus:border-tm-primary focus:outline-none"
                  />
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    value={row.pct}
                    onChange={(e) => row.onPct(Number(e.target.value))}
                    className="w-16 rounded border border-tm-border bg-tm-surface px-1.5 py-0.5 text-xs focus:border-tm-primary focus:outline-none"
                  />
                  <span className="ml-1 text-tm-text-muted">%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsuranceFields({
  value,
  onChange,
}: {
  value: TransactionStructureInput;
  onChange: (patch: Partial<TransactionStructureInput>) => void;
}) {
  const insurance = value.insurance;
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-tm-border p-3">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-tm-black">
        <input
          type="checkbox"
          checked={insurance !== null}
          onChange={(e) =>
            onChange({
              insurance: e.target.checked
                ? { indemnityPct: 90, coverageCapUSD: 0, policyValidityDate: null, policyholder: null }
                : null,
            })
          }
        />
        Credit insurance overlay
      </label>
      {insurance && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="Indemnity %"
            value={insurance.indemnityPct ?? 0}
            onChange={(v) => onChange({ insurance: { ...insurance, indemnityPct: v } })}
            step={1}
            suffix="%"
          />
          <NumField
            label="Coverage cap (USD)"
            value={insurance.coverageCapUSD ?? 0}
            onChange={(v) => onChange({ insurance: { ...insurance, coverageCapUSD: v } })}
            step={100}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tm-text">Policy validity date</span>
            <input
              type="date"
              value={insurance.policyValidityDate ?? ""}
              onChange={(e) => onChange({ insurance: { ...insurance, policyValidityDate: e.target.value || null } })}
              className="w-full rounded-lg border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm text-tm-black focus:border-tm-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tm-text">Policyholder</span>
            <input
              value={insurance.policyholder ?? ""}
              onChange={(e) => onChange({ insurance: { ...insurance, policyholder: e.target.value || null } })}
              className="w-full rounded-lg border border-tm-border bg-tm-surface px-2.5 py-1.5 text-sm text-tm-black focus:border-tm-primary focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function KpiStrip({ report }: { report: ReturnType<typeof buildTransactionStructureReport> }) {
  const { kpis } = report;
  const items: Array<{ label: string; value: string; tone?: "danger" | "primary" }> = [
    { label: "Margin", value: formatUSD(kpis.margin), tone: kpis.margin < 0 ? "danger" : "primary" },
    { label: "Capital need", value: formatUSD(kpis.capitalNeed) },
    {
      label: "At risk after 1st collection",
      value: formatUSD(kpis.exposureAfterFirstCollection),
      tone: kpis.exposureAfterFirstCollection > 0 ? "danger" : undefined,
    },
    { label: "Breakeven price", value: kpis.breakevenPrice != null ? `$${kpis.breakevenPrice.toFixed(2)}/kg` : "n/a" },
    {
      label: "Min collection to breakeven",
      value: kpis.minCollectionToBreakevenPctOfInvoice != null ? `${Math.max(0, kpis.minCollectionToBreakevenPctOfInvoice).toFixed(1)}% of invoice` : "n/a",
    },
    { label: "Max loss on default", value: formatUSD(kpis.maxLossOnDefault), tone: kpis.maxLossOnDefault < 0 ? "danger" : undefined },
    { label: "Self-funding price", value: kpis.selfFundingPrice != null ? `$${kpis.selfFundingPrice.toFixed(2)}/kg` : "n/a" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-tm-border bg-tm-neutral-light/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-muted">{item.label}</p>
          <p
            className={`mt-1 text-base font-bold ${item.tone === "danger" ? "text-tm-danger-dark" : item.tone === "primary" ? "text-tm-primary-dark" : "text-tm-black"}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CashTimeline({ report }: { report: ReturnType<typeof buildTransactionStructureReport> }) {
  const cf = report.score.cashFlow;
  const events = [
    { label: "Supplier advance", day: report.resolved.supAdvDay, amount: cf.supplierAdvanceAmount, cum: cf.cum1 },
    { label: "Supplier final", day: report.resolved.supFinDay, amount: cf.supplierFinalAmount, cum: cf.cum2 },
    { label: "Buyer first payment", day: report.resolved.buyFirstDay, amount: cf.buyerFirstAmount, cum: cf.cum3 },
    { label: "Buyer final payment", day: report.resolved.buyFinalDay, amount: cf.buyerFinalAmount, cum: cf.cum4 },
  ];
  return (
    <div className="space-y-2 rounded-lg border border-tm-border bg-tm-surface p-3">
      <h4 className="text-sm font-semibold text-tm-black">Cash timeline</h4>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-tm-text-muted">
            <th className="pb-1 pr-2 font-semibold">Event</th>
            <th className="pb-1 pr-2 font-semibold">Day</th>
            <th className="pb-1 pr-2 font-semibold">Amount</th>
            <th className="pb-1 font-semibold">Cumulative</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.label} className="border-t border-tm-border/60">
              <td className="py-1 pr-2 text-tm-text">{e.label}</td>
              <td className="py-1 pr-2 text-tm-text-muted">{e.day}</td>
              <td className={`py-1 pr-2 font-medium ${e.amount < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>
                {e.amount < 0 ? "-" : "+"}
                {formatUSDDetailed(Math.abs(e.amount))}
              </td>
              <td className={`py-1 font-semibold ${e.cum < 0 ? "text-tm-danger-dark" : "text-tm-black"}`}>
                {formatUSDDetailed(e.cum)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-tm-text-muted">
        Peak negative position {formatUSDDetailed(cf.peakNegativePosition)} · {cf.exposureDuration}-day exposure
      </p>
    </div>
  );
}

export function LegComparison({ report }: { report: ReturnType<typeof buildTransactionStructureReport> }) {
  return (
    <div className="space-y-2 rounded-lg border border-tm-border bg-tm-surface p-3">
      <h4 className="text-sm font-semibold text-tm-black">Per-leg landed cost</h4>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-tm-text-muted">
            <th className="pb-1 pr-2 font-semibold">Leg</th>
            <th className="pb-1 pr-2 font-semibold">Net kg</th>
            <th className="pb-1 font-semibold">Landed $/kg</th>
          </tr>
        </thead>
        <tbody>
          {report.legResults.map((leg) => (
            <tr key={leg.legId} className="border-t border-tm-border/60">
              <td className="py-1 pr-2 text-tm-text">{leg.label}</td>
              <td className="py-1 pr-2 text-tm-text-muted">{leg.netKg.toLocaleString()}</td>
              <td className="py-1 font-semibold text-tm-black">${leg.landedCostPerKg.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionPreview({
  previewCollectionPct,
  onChange,
  previewMargin,
  finalTrancheAmount,
}: {
  previewCollectionPct: number;
  onChange: (v: number) => void;
  previewMargin: number;
  finalTrancheAmount: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-tm-border bg-tm-neutral-light/60 p-3">
      <h4 className="text-sm font-semibold text-tm-black">What if the buyer only pays part of the final tranche?</h4>
      <SliderField
        label={`Collection of final tranche (${formatUSD(finalTrancheAmount)})`}
        value={previewCollectionPct}
        onChange={onChange}
        min={0}
        max={100}
        step={5}
        format={(v) => `${v}%`}
      />
      <p className={`text-sm font-bold ${previewMargin < 0 ? "text-tm-danger-dark" : "text-tm-primary-dark"}`}>
        Margin at this collection level: {formatUSD(previewMargin)}
      </p>
    </div>
  );
}

export function ScoreBreakdownPanel({ report }: { report: ReturnType<typeof buildTransactionStructureReport> }) {
  const s = report.score;
  return (
    <div className="space-y-2 rounded-lg border border-tm-border bg-tm-surface p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-tm-black">Dimension D score</h4>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_BADGE[s.tier]}`}>
          {s.tier}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-tm-text-muted">Sub-A</dt>
          <dd className="text-base font-bold text-tm-black">{s.subA}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-tm-text-muted">Sub-B (0%wt)</dt>
          <dd className="text-base font-bold text-tm-text-muted">{s.subB}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-tm-text-muted">Sub-D</dt>
          <dd className="text-base font-bold text-tm-black">{s.subD}</dd>
        </div>
      </dl>
      <p className="text-xs text-tm-text-light">
        Composite {s.composite}/100 — {s.protocol}
      </p>
      {report.insuranceResult && (
        <p className="text-xs text-tm-text-light">
          Insurance recovery {formatUSD(report.insuranceResult.recovery)} → margin after insurance{" "}
          {formatUSD(report.insuranceResult.marginAfterInsurance)}
          {report.insuranceResult.validityWarning && (
            <span className="mt-1 block text-tm-danger-dark">⚠ {report.insuranceResult.validityWarning}</span>
          )}
        </p>
      )}
    </div>
  );
}

export function SensitivityTableView({ table }: { table: SensitivityTable }) {
  const maxRevenue = Math.max(1, ...table.cells.flat().map((v) => Math.abs(v)));
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-tm-black">
        {table.rowAxis.label} × {table.colAxis.label}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="border border-tm-border bg-tm-neutral-light px-2 py-1"></th>
              {table.colValues.map((c, i) => (
                <th
                  key={i}
                  className={`border border-tm-border px-2 py-1 font-semibold ${i === table.currentColIndex ? "bg-tm-primary/10 text-tm-primary-dark" : "bg-tm-neutral-light text-tm-text-muted"}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rowValues.map((r, ri) => (
              <tr key={ri}>
                <th
                  className={`border border-tm-border px-2 py-1 font-semibold ${ri === table.currentRowIndex ? "bg-tm-primary/10 text-tm-primary-dark" : "bg-tm-neutral-light text-tm-text-muted"}`}
                >
                  {r.toFixed(2)}
                </th>
                {table.cells[ri].map((cell, ci) => {
                  const marginPct = (cell / maxRevenue) * 100;
                  const isCurrent = ri === table.currentRowIndex && ci === table.currentColIndex;
                  return (
                    <td
                      key={ci}
                      className={`border px-2 py-1 font-medium ${marginCellColor(marginPct)} ${isCurrent ? "border-tm-primary border-2" : "border-tm-border"}`}
                    >
                      {formatUSD(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
