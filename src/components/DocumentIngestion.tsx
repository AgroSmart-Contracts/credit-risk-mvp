import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileSearch, Shield, Upload } from "lucide-react";
import type { Deal } from "../types";
import { formatUSDDetailed } from "../lib/assessment";
import {
  applyCofaceExtractToDraft,
  buildDealFromDraft,
  buildSourceDocumentsFromUploads,
  type DealDraftInput,
} from "../lib/deal-builder";
import { analyzeCofaceDocument } from "../lib/coface-analysis/analyze-coface-client";
import { analyzeDealDocuments } from "../lib/document-analysis/analyze-documents-client";
import { PRODUCT_RISK_TABLE } from "../lib/product-risk-tables";
import { ROUTE_OPTIONS, lookupRouteRisk } from "../lib/route-risk-tables";
import {
  defaultStructureFromDeal,
  structureForDeal,
} from "../lib/transaction-structure/compute";
import type { TransactionStructureInput } from "../lib/transaction-structure/types";
import { TransactionStructureBuilder } from "./TransactionStructureBuilder";

interface DocumentIngestionProps {
  deal: Deal;
  onBack: () => void;
  onRunAssessment: (deal: Deal) => void;
}

interface DealFormState {
  product: string;
  variety: string;
  dealValueUSD: string;
  buyerName: string;
  supplierName: string;
  paymentTerms: string;
  advancePaymentPct: string;
  incoterm: string;
  qualityGrade: Deal["qualityGrade"];
  origin: string;
  destination: string;
  transportMode: "air" | "sea" | "";
  numberOfTransshipments: string;
}

function initialForm(deal: Deal): DealFormState {
  return {
    product: deal.product,
    variety: deal.variety,
    dealValueUSD: deal.dealValueUSD > 0 ? String(deal.dealValueUSD) : "",
    buyerName: deal.buyer.name,
    supplierName: deal.supplier.name,
    paymentTerms: deal.paymentTerms,
    advancePaymentPct: String(deal.advancePaymentPct),
    incoterm: deal.incoterm,
    qualityGrade: deal.qualityGrade,
    origin: deal.origin,
    destination: deal.destination,
    transportMode: deal.transportMode ?? "",
    numberOfTransshipments: String(deal.numberOfTransshipments),
  };
}

function routeLabel(origin: string, destination: string): string {
  return `${origin} → ${destination}`;
}

export function DocumentIngestion({
  deal,
  onBack,
  onRunAssessment,
}: DocumentIngestionProps) {
  const [form, setForm] = useState<DealFormState>(() => initialForm(deal));
  const [dealFiles, setDealFiles] = useState<File[]>([]);
  const [cofaceFile, setCofaceFile] = useState<File | null>(null);
  const [cofaceCoverageAmountUSD, setCofaceCoverageAmountUSD] = useState(
    deal.cofaceCoverageAmountUSD != null ? String(deal.cofaceCoverageAmountUSD) : "",
  );
  const [cofaceCoveragePct, setCofaceCoveragePct] = useState(
    deal.cofaceCoveragePct != null ? String(deal.cofaceCoveragePct) : "",
  );
  const [transactionStructure, setTransactionStructure] = useState<TransactionStructureInput>(
    () => structureForDeal(deal),
  );
  const [docStatus, setDocStatus] = useState<string>("");
  const [cofaceStatus, setCofaceStatus] = useState<string>("");
  const [busy, setBusy] = useState<"docs" | "coface" | null>(null);
  const [cofaceExtractFields, setCofaceExtractFields] = useState({
    cofaceRequestCountry: deal.cofaceRequestCountry ?? null,
    cofaceRequestBuyerName: deal.cofaceRequestBuyerName ?? null,
    cofaceRequestedCoverageAmountUSD:
      deal.cofaceRequestedCoverageAmountUSD ?? null,
    cofaceCountryRiskGrade: deal.cofaceCountryRiskGrade ?? null,
    cofaceCompanyRiskGrade: deal.cofaceCompanyRiskGrade ?? null,
  });

  useEffect(() => {
    setForm(initialForm(deal));
    setCofaceCoverageAmountUSD(
      deal.cofaceCoverageAmountUSD != null ? String(deal.cofaceCoverageAmountUSD) : "",
    );
    setCofaceCoveragePct(
      deal.cofaceCoveragePct != null ? String(deal.cofaceCoveragePct) : "",
    );
    setDealFiles([]);
    setCofaceFile(null);
    setDocStatus("");
    setCofaceStatus("");
    setCofaceExtractFields({
      cofaceRequestCountry: deal.cofaceRequestCountry ?? null,
      cofaceRequestBuyerName: deal.cofaceRequestBuyerName ?? null,
      cofaceRequestedCoverageAmountUSD:
        deal.cofaceRequestedCoverageAmountUSD ?? null,
      cofaceCountryRiskGrade: deal.cofaceCountryRiskGrade ?? null,
      cofaceCompanyRiskGrade: deal.cofaceCompanyRiskGrade ?? null,
    });
    setTransactionStructure(structureForDeal(deal));
  }, [deal]);

  const handleStructureChange = (next: TransactionStructureInput) => {
    setTransactionStructure({ ...next, structureSource: "user" });
  };

  const handleResetStructure = () => {
    setTransactionStructure(
      defaultStructureFromDeal({
        dealValueUSD: Number(form.dealValueUSD || 0) || deal.dealValueUSD,
        offerUnitPriceUSD: deal.offerUnitPriceUSD,
        advancePaymentPct: Number(form.advancePaymentPct || 0),
        estimatedTransitDays: deal.estimatedTransitDays,
      }),
    );
  };

  const selectedProduct = useMemo(
    () => PRODUCT_RISK_TABLE.find((entry) => entry.product === form.product) ?? null,
    [form.product],
  );

  // route-risk-tables.ts is keyed per (origin, destination, product, mode)
  // since the 2026-07-29 transport/air-stops split — dedupe to distinct
  // corridors for the dropdown, then resolve the exact row separately.
  const corridors = useMemo(() => {
    const seen = new Map<string, { origin: string; destination: string }>();
    for (const entry of ROUTE_OPTIONS) {
      const key = `${entry.origin}__${entry.destination}`;
      if (!seen.has(key)) seen.set(key, { origin: entry.origin, destination: entry.destination });
    }
    return [...seen.values()];
  }, []);

  const selectedRoute = useMemo(
    () =>
      lookupRouteRisk(
        form.origin,
        form.destination,
        form.product,
        form.transportMode === "" ? null : form.transportMode,
        Number(form.numberOfTransshipments || 0),
      ),
    [
      form.origin,
      form.destination,
      form.product,
      form.transportMode,
      form.numberOfTransshipments,
    ],
  );

  const handleAnalyzeDocs = async () => {
    if (!dealFiles.length) return;
    setBusy("docs");
    setDocStatus("");
    try {
      const result = await analyzeDealDocuments(dealFiles);
      setDocStatus(
        `Analyzed ${result.documents.length} file(s) · ${result.docCoveragePct}% field coverage`,
      );
      setForm((current) => ({
        ...current,
        product: result.suggestions.product ?? current.product,
        variety: result.suggestions.variety ?? current.variety,
        dealValueUSD:
          result.suggestions.dealValueUSD != null
            ? String(Math.round(result.suggestions.dealValueUSD))
            : current.dealValueUSD,
        buyerName: result.suggestions.buyerName ?? current.buyerName,
        supplierName: result.suggestions.supplierName ?? current.supplierName,
        paymentTerms: result.suggestions.paymentTerms ?? current.paymentTerms,
        advancePaymentPct:
          result.suggestions.advancePaymentPct != null
            ? String(result.suggestions.advancePaymentPct)
            : current.advancePaymentPct,
        incoterm: result.suggestions.incoterm ?? current.incoterm,
        qualityGrade:
          result.suggestions.qualityGrade === "Grade A / Class I" ||
          result.suggestions.qualityGrade === "Grade B / Class II" ||
          result.suggestions.qualityGrade === "Industrial"
            ? result.suggestions.qualityGrade
            : current.qualityGrade,
        origin: result.suggestions.origin ?? current.origin,
        destination: result.suggestions.destination ?? current.destination,
      }));
    } catch (error) {
      setDocStatus(error instanceof Error ? error.message : "Document analysis failed");
    } finally {
      setBusy(null);
    }
  };

  const handleAnalyzeCoface = async () => {
    if (!cofaceFile) return;
    setBusy("coface");
    setCofaceStatus("");
    try {
      const result = await analyzeCofaceDocument(cofaceFile);
      const dealValueUSD = Number(form.dealValueUSD || 0);
      const merged = applyCofaceExtractToDraft(
        {
          product: form.product,
          variety: form.variety,
          dealValueUSD,
          buyerName: form.buyerName,
          supplierName: form.supplierName,
          paymentTerms: form.paymentTerms,
          advancePaymentPct: Number(form.advancePaymentPct || 0),
          incoterm: form.incoterm,
          qualityGrade: form.qualityGrade,
          origin: form.origin,
          destination: form.destination,
          cofaceCoverageAmountUSD: null,
          cofaceCoveragePct: null,
          sourceDocuments: [],
        },
        result,
        dealValueUSD,
      );
      setCofaceCoverageAmountUSD(
        String(Math.round(merged.cofaceCoverageAmountUSD ?? 0)),
      );
      if (merged.cofaceCoveragePct != null) {
        setCofaceCoveragePct(String(merged.cofaceCoveragePct));
      }
      if (merged.buyerName?.trim()) {
        setForm((current) => ({ ...current, buyerName: merged.buyerName }));
      }
      setCofaceExtractFields({
        cofaceRequestCountry: merged.cofaceRequestCountry ?? null,
        cofaceRequestBuyerName: merged.cofaceRequestBuyerName ?? null,
        cofaceRequestedCoverageAmountUSD:
          merged.cofaceRequestedCoverageAmountUSD ?? null,
        cofaceCountryRiskGrade: merged.cofaceCountryRiskGrade ?? null,
        cofaceCompanyRiskGrade: merged.cofaceCompanyRiskGrade ?? null,
      });
      const gradeNote = [
        merged.cofaceCountryRiskGrade
          ? `country ${merged.cofaceCountryRiskGrade}`
          : null,
        merged.cofaceCompanyRiskGrade
          ? `company ${merged.cofaceCompanyRiskGrade}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      setCofaceStatus(
        `Extracted Coface cover ${formatUSDDetailed(result.coverageAmountUSD)}${merged.cofaceCoveragePct != null ? ` (${merged.cofaceCoveragePct}%)` : ""}${gradeNote ? ` · ${gradeNote}` : ""}`,
      );
    } catch (error) {
      setCofaceStatus(error instanceof Error ? error.message : "Coface analysis failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRouteChange = (value: string) => {
    const route = corridors.find(
      (entry) => `${entry.origin}__${entry.destination}` === value,
    );
    if (!route) return;
    setForm((current) => ({
      ...current,
      origin: route.origin,
      destination: route.destination,
    }));
  };

  const handleRun = () => {
    const draft: DealDraftInput = {
      product: form.product,
      variety: form.variety,
      dealValueUSD: Number(form.dealValueUSD || 0),
      buyerName: form.buyerName,
      supplierName: form.supplierName,
      paymentTerms: form.paymentTerms,
      advancePaymentPct: Number(form.advancePaymentPct || 0),
      incoterm: form.incoterm,
      qualityGrade: form.qualityGrade,
      origin: form.origin,
      destination: form.destination,
      transportMode: form.transportMode === "" ? null : form.transportMode,
      numberOfTransshipments: Number(form.numberOfTransshipments || 0),
      cofaceCoverageAmountUSD:
        cofaceCoverageAmountUSD.trim() === ""
          ? null
          : Number(cofaceCoverageAmountUSD),
      cofaceCoveragePct:
        cofaceCoveragePct.trim() === "" ? null : Number(cofaceCoveragePct),
      ...cofaceExtractFields,
      sourceDocuments: buildSourceDocumentsFromUploads(dealFiles, cofaceFile),
      transactionStructure,
    };

    onRunAssessment(buildDealFromDraft(deal, draft));
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-tm-text-light transition-colors hover:text-tm-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to deals
      </button>

      <div>
        <h2 className="font-display text-2xl text-tm-black sm:text-3xl">
          {deal.isCustom ? "Create deal assessment" : "Document ingestion"}
        </h2>
        <p className="mt-1 text-tm-text-light">
          Upload deal documents, choose the product and route from the scoring
          tables, and attach manual or document-derived Coface cover.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-tm-primary" />
            <h3 className="font-semibold text-tm-black">Deal documents</h3>
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(event) => setDealFiles(Array.from(event.target.files ?? []))}
            className="block w-full text-sm text-tm-text-light file:mr-3 file:rounded-lg file:border-0 file:bg-tm-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <button
            type="button"
            disabled={!dealFiles.length || busy !== null}
            onClick={handleAnalyzeDocs}
            className="inline-flex items-center gap-2 rounded-lg border border-tm-border px-4 py-2 text-sm font-medium text-tm-text transition-colors hover:border-tm-primary hover:text-tm-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSearch className="h-4 w-4" />
            {busy === "docs" ? "Analyzing..." : "Analyze deal docs"}
          </button>
          <p className="text-xs text-tm-text-muted">
            {docStatus ||
              `${deal.sourceDocuments.length} reference document(s) already available on the selected deal.`}
          </p>
          {!!dealFiles.length && (
            <ul className="space-y-1 text-xs text-tm-text-light">
              {dealFiles.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-tm-primary" />
            <h3 className="font-semibold text-tm-black">Coface coverage</h3>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setCofaceFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-tm-text-light file:mr-3 file:rounded-lg file:border-0 file:bg-tm-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <button
            type="button"
            disabled={!cofaceFile || busy !== null}
            onClick={handleAnalyzeCoface}
            className="inline-flex items-center gap-2 rounded-lg border border-tm-border px-4 py-2 text-sm font-medium text-tm-text transition-colors hover:border-tm-primary hover:text-tm-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            {busy === "coface" ? "Extracting..." : "Analyze Coface file"}
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Coverage amount (USD)"
              value={cofaceCoverageAmountUSD}
              onChange={setCofaceCoverageAmountUSD}
              placeholder="40000"
            />
            <Input
              label="Coverage %"
              value={cofaceCoveragePct}
              onChange={setCofaceCoveragePct}
              placeholder="80"
            />
          </div>
          <p className="text-xs text-tm-text-muted">
            {cofaceStatus || "Enter coverage manually or upload a Coface notification PDF."}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-tm-border bg-tm-surface p-5 shadow-tm-sm">
        <h3 className="font-semibold text-tm-black">Assessment inputs</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Product score table"
            value={form.product}
            onChange={(value) => setForm((current) => ({ ...current, product: value }))}
            options={PRODUCT_RISK_TABLE.map((entry) => ({
              value: entry.product,
              label: `${entry.product} · score ${entry.score}`,
            }))}
          />
          <Select
            label="Route score table"
            value={`${form.origin}__${form.destination}`}
            onChange={handleRouteChange}
            options={corridors.map((entry) => ({
              value: `${entry.origin}__${entry.destination}`,
              label: routeLabel(entry.origin, entry.destination),
            }))}
          />
          <Select
            label="Transport mode"
            value={form.transportMode}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                transportMode: value as DealFormState["transportMode"],
              }))
            }
            options={[
              { value: "", label: "Unknown (use ocean table)" },
              { value: "sea", label: "Ocean / sea freight" },
              { value: "air", label: "Air freight" },
            ]}
          />
          <Input
            label="Stops / transits (air)"
            value={form.numberOfTransshipments}
            onChange={(value) =>
              setForm((current) => ({ ...current, numberOfTransshipments: value }))
            }
            placeholder="0"
          />
          <Input
            label="Variety"
            value={form.variety}
            onChange={(value) => setForm((current) => ({ ...current, variety: value }))}
            placeholder="Hass / W. Murcott / San Andreas"
          />
          <Input
            label="Deal value (USD)"
            value={form.dealValueUSD}
            onChange={(value) => setForm((current) => ({ ...current, dealValueUSD: value }))}
            placeholder="36047"
          />
          <Input
            label="Buyer"
            value={form.buyerName}
            onChange={(value) => setForm((current) => ({ ...current, buyerName: value }))}
            placeholder="Buyer company"
          />
          <Input
            label="Supplier"
            value={form.supplierName}
            onChange={(value) => setForm((current) => ({ ...current, supplierName: value }))}
            placeholder="Supplier company"
          />
          <Input
            label="Payment terms"
            value={form.paymentTerms}
            onChange={(value) => setForm((current) => ({ ...current, paymentTerms: value }))}
            placeholder="70% against docs, 30% on arrival"
          />
          <Input
            label="Advance payment %"
            value={form.advancePaymentPct}
            onChange={(value) =>
              setForm((current) => ({ ...current, advancePaymentPct: value }))
            }
            placeholder="0"
          />
          <Input
            label="Incoterm"
            value={form.incoterm}
            onChange={(value) => setForm((current) => ({ ...current, incoterm: value }))}
            placeholder="FOB"
          />
          <Select
            label="Quality grade"
            value={form.qualityGrade}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                qualityGrade: value as Deal["qualityGrade"],
              }))
            }
            options={[
              { value: "Grade A / Class I", label: "Grade A / Class I" },
              { value: "Grade B / Class II", label: "Grade B / Class II" },
              { value: "Industrial", label: "Industrial" },
            ]}
          />
        </div>
      </section>

      <section className="rounded-xl border border-tm-border bg-tm-neutral/60 p-5">
        <h3 className="font-semibold text-tm-black">Selected table entries</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Product table"
            value={
              selectedProduct
                ? `${selectedProduct.product} · score ${selectedProduct.score}`
                : "Select a product"
            }
            source="document"
          />
          <Field
            label="Route table"
            value={
              selectedRoute
                ? `${routeLabel(selectedRoute.origin, selectedRoute.destination)} · ${
                    selectedRoute.transportMode === "air"
                      ? selectedRoute.airStopsBand === "gt2"
                        ? "air ≥3 stops"
                        : "air ≤2 stops"
                      : "ocean"
                  } · score ${selectedRoute.score}${
                    selectedRoute.airStopPenalty
                      ? ` (air stop ${selectedRoute.airStopPenalty})`
                      : ""
                  }`
                : "Select a route"
            }
            source="document"
          />
          {form.transportMode === "air" && (
            <Field
              label="Air stops band"
              value={
                Number(form.numberOfTransshipments || 0) > 2
                  ? "≥3 stops — higher route risk table"
                  : "≤2 stops (direct / few connections)"
              }
              source="document"
            />
          )}
          <Field
            label="Deal value"
            value={
              form.dealValueUSD
                ? formatUSDDetailed(Number(form.dealValueUSD))
                : "Not entered"
            }
            source="document"
          />
          <Field
            label="Coface cover"
            value={
              cofaceCoverageAmountUSD || cofaceCoveragePct
                ? `${cofaceCoverageAmountUSD || "0"} USD / ${cofaceCoveragePct || "0"}%`
                : "Not provided"
            }
            source="document"
          />
        </dl>
      </section>

      <TransactionStructureBuilder
        value={transactionStructure}
        onChange={handleStructureChange}
        onResetToDefaults={handleResetStructure}
        defaultExpanded={transactionStructure.structureSource === "default"}
        dealValueUSD={Number(form.dealValueUSD || 0)}
        advancePaymentPct={Number(form.advancePaymentPct || 0)}
        contractType={deal.contractType}
      />

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleRun}
          className="rounded-lg bg-tm-primary px-6 py-3 font-semibold text-white shadow-tm-md transition-colors hover:bg-tm-primary-dark"
        >
          Run risk assessment
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tm-text">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-sm text-tm-black placeholder:text-tm-text-muted focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tm-text">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-sm text-tm-black focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: "document" | "platform";
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs text-tm-text-muted">
        {label}
        <span
          className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${
            source === "platform"
              ? "bg-tm-blue/10 text-tm-blue"
              : "bg-tm-primary/10 text-tm-primary"
          }`}
        >
          {source}
        </span>
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-tm-black">{value}</dd>
    </div>
  );
}
