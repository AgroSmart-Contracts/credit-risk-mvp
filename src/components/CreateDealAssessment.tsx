import { useRef, useState } from "react";
import { ArrowLeft, FileUp, Shield, Upload } from "lucide-react";
import type { Deal } from "../types";
import { analyzeDealDocuments } from "../lib/document-analysis/analyze-documents-client";
import { applySuggestionsToForm } from "../lib/document-analysis/apply-suggestions";
import {
  analyzeCofaceDocument,
  computeCoveragePct,
} from "../lib/coface-analysis/analyze-coface-client";
import type { CofaceExtractionResult } from "../lib/coface-analysis/types";
import { countCoreDetectedFields } from "../lib/document-analysis/format-detected-fields";
import type { AnalyzeDocumentsResult } from "../lib/document-analysis/types";
import { buildDealFromInput } from "../lib/create-deal";
import { PRODUCT_OPTIONS } from "../lib/product-risk-tables";
import { ROUTE_OPTIONS } from "../lib/route-risk-tables";
import { PRODUCT_RISK_TABLE } from "../lib/product-risk-tables";
import { ROUTE_RISK_TABLE } from "../lib/route-risk-tables";
import { ProcessingMascot } from "./ProcessingMascot";

interface CreateDealAssessmentProps {
  onBack: () => void;
  onCreate: (deal: Deal) => void;
}

export function CreateDealAssessment({
  onBack,
  onCreate,
}: CreateDealAssessmentProps) {
  const dealFileRef = useRef<HTMLInputElement>(null);
  const cofaceFileRef = useRef<HTMLInputElement>(null);

  const [dealFiles, setDealFiles] = useState<File[]>([]);
  const [cofaceFile, setCofaceFile] = useState<File | null>(null);
  const [cofaceExtraction, setCofaceExtraction] =
    useState<CofaceExtractionResult | null>(null);
  const [analyzingCoface, setAnalyzingCoface] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] =
    useState<AnalyzeDocumentsResult | null>(null);
  const [fieldsAppliedFromDocs, setFieldsAppliedFromDocs] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [product, setProduct] = useState("");
  const [routeIndex, setRouteIndex] = useState(-1);
  const [variety, setVariety] = useState("");
  const [dealValueUSD, setDealValueUSD] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [advancePaymentPct, setAdvancePaymentPct] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [qualityGrade, setQualityGrade] = useState<Deal["qualityGrade"] | "">(
    "",
  );
  const [cofacePct, setCofacePct] = useState("");
  const [cofaceAmount, setCofaceAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedRoute =
    routeIndex >= 0 ? ROUTE_OPTIONS[routeIndex] : undefined;
  const detectedFieldCount = documentAnalysis
    ? countCoreDetectedFields(documentAnalysis.suggestions)
    : 0;

  const applyFormValues = (applied: ReturnType<typeof applySuggestionsToForm>) => {
    setProduct(applied.product);
    setRouteIndex(applied.routeIndex);
    setVariety(applied.variety);
    setDealValueUSD(applied.dealValueUSD);
    setBuyerName(applied.buyerName);
    setSupplierName(applied.supplierName);
    setPaymentTerms(applied.paymentTerms);
    setAdvancePaymentPct(applied.advancePaymentPct);
    setIncoterm(applied.incoterm);
    setQualityGrade(applied.qualityGrade);
  };

  const analyzeFiles = async (files: File[]) => {
    const pdfFiles = files.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ext === "pdf";
    });
    if (!pdfFiles.length) {
      setDocumentAnalysis(null);
      setFieldsAppliedFromDocs(false);
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      const result = await analyzeDealDocuments(pdfFiles);
      setDocumentAnalysis(result);
      if (result.filledFields.length > 0) {
        applyFormValues(applySuggestionsToForm(result.suggestions));
        setFieldsAppliedFromDocs(true);
        if (cofaceExtraction) {
          applyCofaceExtraction(
            cofaceExtraction,
            applySuggestionsToForm(result.suggestions).dealValueUSD,
          );
        }
      } else {
        setFieldsAppliedFromDocs(false);
      }
    } catch (err) {
      setDocumentAnalysis(null);
      setFieldsAppliedFromDocs(false);
      setError(
        err instanceof Error
          ? err.message
          : "Could not analyze uploaded PDF documents",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDealFilesChange = async (files: File[]) => {
    setDealFiles(files);
    await analyzeFiles(files);
  };

  const applyCofaceExtraction = (
    result: CofaceExtractionResult,
    dealValue = dealValueUSD,
  ) => {
    setCofaceAmount(String(result.coverageAmountUSD));
    const value = parseFloat(dealValue);
    const pct = computeCoveragePct(result.coverageAmountUSD, value);
    if (pct != null) {
      setCofacePct(String(pct));
    }
  };

  const handleCofaceFileChange = async (file: File | null) => {
    setCofaceFile(file);
    setCofaceExtraction(null);

    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== 'pdf') {
      setError(
        'Coface auto-fill works with PDF limit notifications. Enter coverage manually for images.',
      );
      return;
    }

    try {
      setAnalyzingCoface(true);
      setError(null);
      const result = await analyzeCofaceDocument(file);
      setCofaceExtraction(result);
      applyCofaceExtraction(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not extract Coface coverage from document',
      );
    } finally {
      setAnalyzingCoface(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRoute) {
      setError("Select a route for this deal.");
      return;
    }

    const value = parseFloat(dealValueUSD);
    if (!buyerName.trim() || !supplierName.trim()) {
      setError("Buyer and supplier names are required.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid deal value in USD.");
      return;
    }
    if (!incoterm) {
      setError("Select an incoterm.");
      return;
    }
    if (!qualityGrade) {
      setError("Select a quality grade.");
      return;
    }
    if (!product) {
      setError("Select a product.");
      return;
    }

    const pct = cofacePct.trim() ? parseFloat(cofacePct) : null;
    const amount = cofaceAmount.trim() ? parseFloat(cofaceAmount) : null;
    if (pct !== null && (pct < 0 || pct > 100)) {
      setError("Coface coverage % must be between 0 and 100.");
      return;
    }

    const deal = buildDealFromInput({
      dealRef: documentAnalysis?.suggestions.dealRef,
      product,
      variety: variety.trim() || undefined,
      dealValueUSD: value,
      origin: selectedRoute.origin,
      destination: selectedRoute.destination,
      incoterm,
      buyerName: buyerName.trim(),
      supplierName: supplierName.trim(),
      paymentTerms: paymentTerms || "To be confirmed",
      advancePaymentPct: parseFloat(advancePaymentPct) || 0,
      qualityGrade,
      uploadedFileNames: dealFiles.map((f) => f.name),
      cofaceCoverage: {
        coveragePct: pct,
        coverageAmountUSD: amount,
        documentName: cofaceFile?.name ?? null,
      },
      documentAnalysis: documentAnalysis ?? undefined,
    });

    onCreate(deal);
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
          New deal assessment
        </h2>
        <p className="mt-1 text-tm-text-light">
          Upload Spanish trade contracts or POs — deal details populate from
          extracted PDF text
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {(analyzing || analyzingCoface) && (
          <div
            className="rounded-xl border border-tm-border bg-tm-surface px-4 py-6"
            aria-busy="true"
          >
            <ProcessingMascot
              size={180}
              messages={
                analyzingCoface
                  ? [
                      "Reading Coface notification…",
                      "Extracting coverage limit…",
                    ]
                  : [
                      "Reading deal documents…",
                      "Extracting parties and terms…",
                      "Mapping product and route…",
                    ]
              }
            />
          </div>
        )}

        <section className="rounded-xl border border-tm-border bg-tm-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-tm-black">
            <FileUp className="h-4 w-4 text-tm-primary" />
            Deal documentation
          </h3>
          <input
            ref={dealFileRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) =>
              void handleDealFilesChange(Array.from(e.target.files ?? []))
            }
          />
          <button
            type="button"
            onClick={() => dealFileRef.current?.click()}
            disabled={analyzing}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-tm-border bg-tm-neutral/40 px-4 py-8 transition-colors hover:border-tm-primary/50 hover:bg-tm-primary/5 disabled:cursor-wait disabled:opacity-70"
          >
            <Upload className="h-8 w-8 text-tm-text-muted" />
            <span className="text-sm font-medium text-tm-text">
              Upload sales agreement, orden de compra, or invoice (PDF)
            </span>
            <span className="text-xs text-tm-text-muted">
              Uses the same pdf-parse + keyword extraction as TruMarket
            </span>
          </button>
          {dealFiles.length > 0 && (
            <ul className="mt-3 space-y-1">
              {dealFiles.map((f) => {
                const analyzed = documentAnalysis?.documents.find(
                  (doc) => doc.fileName === f.name,
                );
                return (
                  <li key={f.name} className="text-xs text-tm-primary">
                    {f.name}
                    {analyzed?.extractionHint
                      ? ` — ${analyzed.extractionHint}`
                      : ""}
                  </li>
                );
              })}
            </ul>
          )}
          {documentAnalysis && detectedFieldCount > 0 && (
            <p className="mt-3 text-xs text-tm-text-muted">
              Detected {detectedFieldCount} field(s) from documents (~
              {documentAnalysis.docCoveragePct}% doc coverage). Edit deal
              details below if anything needs correction.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-tm-border bg-tm-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-tm-black">Deal details</h3>
            {fieldsAppliedFromDocs && (
              <span className="rounded-full bg-tm-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-tm-primary">
                Populated from documents
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Product">
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select product</option>
                {PRODUCT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p} (base risk:{" "}
                    {PRODUCT_RISK_TABLE.find((x) => x.product === p)
                      ?.baseScore ?? "—"}
                    )
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Variety (optional)">
              <input
                type="text"
                placeholder="e.g. W. Murcott"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Route">
              <select
                value={routeIndex}
                onChange={(e) => setRouteIndex(Number(e.target.value))}
                className={inputClass}
                required
              >
                <option value={-1}>Select route</option>
                {ROUTE_OPTIONS.map((r, i) => (
                  <option key={r.label} value={i}>
                    {r.label} (base risk:{" "}
                    {ROUTE_RISK_TABLE[i]?.baseScore ?? "—"})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Deal value (USD)">
              <input
                type="number"
                required
                min={1}
                placeholder="36000"
                value={dealValueUSD}
                onChange={(e) => setDealValueUSD(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Buyer">
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Supplier">
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Incoterm">
              <select
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select incoterm</option>
                {["EXW", "FOB", "CIF", "DAP", "DDP"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Payment terms">
              <input
                type="text"
                placeholder="e.g. 60 days"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Advance payment %">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={advancePaymentPct}
                onChange={(e) => setAdvancePaymentPct(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Quality grade">
              <select
                value={qualityGrade}
                onChange={(e) =>
                  setQualityGrade(e.target.value as Deal["qualityGrade"])
                }
                className={inputClass}
                required
              >
                <option value="">Select quality grade</option>
                <option value="Grade A / Class I">Grade A / Class I</option>
                <option value="Grade B / Class II">Grade B / Class II</option>
                <option value="Industrial">Industrial</option>
              </select>
            </FormField>
          </div>
        </section>

        <section className="rounded-xl border border-tm-border bg-tm-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-tm-black">
            <Shield className="h-4 w-4 text-tm-blue" />
            Coface coverage
          </h3>
          <p className="mb-4 text-xs text-tm-text-muted">
            Enter coverage from your Coface policy or upload the limit
            notification PDF — fields auto-fill from the guaranteed amount
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Coverage % of deal value">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 80"
                value={cofacePct}
                onChange={(e) => setCofacePct(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Coverage amount (USD)">
              <input
                type="number"
                min={0}
                placeholder="e.g. 40000"
                value={cofaceAmount}
                onChange={(e) => setCofaceAmount(e.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>
          <input
            ref={cofaceFileRef}
            type="file"
            accept=".pdf,.png,.jpg"
            className="hidden"
            onChange={(e) =>
              void handleCofaceFileChange(e.target.files?.[0] ?? null)
            }
          />
          <button
            type="button"
            onClick={() => cofaceFileRef.current?.click()}
            disabled={analyzingCoface}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-tm-border px-3 py-2 text-sm text-tm-text transition-colors hover:border-tm-blue hover:text-tm-blue disabled:cursor-wait disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Upload Coface document
          </button>
          {cofaceFile && (
            <p className="mt-2 text-xs text-tm-blue">
              {cofaceFile.name}
              {cofaceExtraction
                ? ` — ${cofaceExtraction.extractionHint}`
                : analyzingCoface
                  ? ' — analyzing…'
                  : ''}
            </p>
          )}
        </section>

        {error && (
          <p className="text-sm text-tm-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={analyzing || analyzingCoface}
            className="rounded-lg bg-tm-primary px-6 py-3 font-semibold text-white shadow-tm-md transition-colors hover:bg-tm-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to document ingestion
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-sm text-tm-black placeholder:text-tm-text-muted focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-tm-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
