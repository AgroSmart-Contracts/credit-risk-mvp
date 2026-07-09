import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileCheck,
  Shield,
  ShoppingCart,
  Database,
  FileSearch,
  AlertTriangle,
} from "lucide-react";
import type { Deal } from "../types";
import { formatUSDDetailed } from "../lib/assessment";
import {
  applyConfirmations,
  listConfirmationFields,
  type ConfirmationField,
  type ConfirmationValues,
} from "../lib/confirmation-fields";
import { formatCofaceSignal } from "../lib/create-deal";

interface DocumentIngestionProps {
  deal: Deal;
  onBack: () => void;
  onRunAssessment: (deal: Deal) => void;
}

const docIcons: Record<string, typeof FileText> = {
  contract: FileText,
  purchase_order: ShoppingCart,
  credit_insurance: Shield,
  sales_order: FileCheck,
};

function fieldKey(field: ConfirmationField): string {
  return field.kind === "scoring" ? field.id : field.key;
}

export function DocumentIngestion({
  deal,
  onBack,
  onRunAssessment,
}: DocumentIngestionProps) {
  const [processedCount, setProcessedCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [confirmedFields, setConfirmedFields] = useState<ConfirmationValues>({});

  const analysis = deal.documentAnalysis;
  const docCoveragePct = analysis?.docCoveragePct ?? 82;
  const extractedFieldCount =
    analysis?.filledFields.length ??
    Math.max(6, deal.sourceDocuments.length * 2);

  const confirmationFields = useMemo(
    () => listConfirmationFields(deal),
    [deal],
  );

  useEffect(() => {
    setProcessedCount(0);
    setShowSummary(false);
    setShowButton(false);
    setConfirmedFields({});

    const docCount = deal.sourceDocuments.length;
    const staggerMs = Math.min(400, Math.floor(2000 / Math.max(docCount, 1)));
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < docCount; i++) {
      timers.push(
        setTimeout(() => setProcessedCount(i + 1), (i + 1) * staggerMs),
      );
    }

    timers.push(
      setTimeout(() => setShowSummary(true), docCount * staggerMs + 200),
    );
    timers.push(
      setTimeout(() => setShowButton(true), docCount * staggerMs + 500),
    );

    return () => timers.forEach(clearTimeout);
  }, [deal]);

  const allProcessed = processedCount >= deal.sourceDocuments.length;
  const confirmationCount = confirmationFields.length;

  const handleRunAssessment = () => {
    const updatedDeal = applyConfirmations(deal, confirmedFields);
    onRunAssessment(updatedDeal);
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
          Document ingestion
        </h2>
        <p className="mt-1 text-tm-text-light">
          {deal.dealRef} — {deal.product}
        </p>
        <p className="mt-2 text-xs text-tm-text-muted">
          ~{docCoveragePct}% of risk variables sourced from trade
          documentation · platform metrics auto-populated where available
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SourceBadge icon={FileSearch} label="From documents" />
        <SourceBadge icon={Database} label="Platform auto-fill" />
        {confirmationCount > 0 && (
          <SourceBadge
            icon={FileText}
            label={`${confirmationCount} field(s) need confirmation`}
            variant="warn"
          />
        )}
      </div>

      <div className="space-y-3">
        {deal.sourceDocuments.map((doc, index) => {
          const Icon = docIcons[doc.type] ?? FileText;
          const isDone = index < processedCount;
          const analyzed = analysis?.documents.find(
            (item) => item.fileName === doc.label,
          );
          return (
            <motion.div
              key={doc.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 rounded-lg border border-tm-border bg-tm-surface px-4 py-3"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300 ${
                  isDone
                    ? "bg-tm-primary/10 text-tm-primary"
                    : "bg-tm-neutral text-tm-text-muted"
                }`}
              >
                {isDone ? (
                  analyzed?.requiresOcr ? (
                    <AlertTriangle className="h-5 w-5 text-tm-accent" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-tm-black">{doc.label}</p>
                {isDone && doc.extractionHint && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-tm-primary"
                  >
                    {doc.extractionHint}
                  </motion.p>
                )}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-tm-text-muted">
                {doc.type.replace("_", " ")}
              </span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showSummary && allProcessed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-tm-border bg-tm-neutral/60 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-tm-text-light">
                Extracted fields
              </h3>
              <span className="text-xs text-tm-primary">
                {extractedFieldCount} fields from docs
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Product"
                value={`${deal.product}, ${deal.variety}`}
                source="document"
              />
              <Field label="Buyer" value={deal.buyer.name} source="document" />
              <Field
                label="Supplier"
                value={deal.supplier.name}
                source="document"
              />
              <Field label="Incoterm" value={deal.incoterm} source="document" />
              <Field
                label="Payment terms"
                value={deal.paymentTerms}
                source="document"
              />
              <Field
                label="Deal value"
                value={formatUSDDetailed(deal.dealValueUSD)}
                source="document"
              />
              <Field
                label="Quantity"
                value={deal.quantityLabel}
                source="document"
              />
              <Field
                label="Perishability"
                value={deal.perishabilityClass}
                source="document"
              />
              <Field
                label="Transit estimate"
                value={`${deal.estimatedTransitDays} days`}
                source="document"
              />
              {deal.cofaceCoverage &&
                (deal.cofaceCoverage.coveragePct !== null ||
                  deal.cofaceCoverage.coverageAmountUSD !== null) && (
                  <Field
                    label="Coface coverage"
                    value={formatCofaceSignal(deal.cofaceCoverage)}
                    source="document"
                  />
                )}
              <Field
                label="Platform deals (buyer)"
                value={String(deal.buyer.platformDealsCompleted)}
                source="platform"
              />
              <Field
                label="Platform deals (supplier)"
                value={String(deal.supplier.platformDealsCompleted)}
                source="platform"
              />
            </dl>

            {confirmationCount > 0 && (
              <div className="mt-5 border-t border-tm-border pt-4">
                <p className="mb-3 text-xs text-tm-text-muted">
                  Not found in documents — confirm or estimate (model does not
                  silently guess)
                </p>
                <div className="space-y-3">
                  {confirmationFields.map((field) => (
                    <ConfirmationFieldInput
                      key={fieldKey(field)}
                      field={field}
                      value={confirmedFields[fieldKey(field)]}
                      onChange={(value) =>
                        setConfirmedFields((prev) => ({
                          ...prev,
                          [fieldKey(field)]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end pt-2"
          >
            <button
              type="button"
              onClick={handleRunAssessment}
              className="rounded-lg bg-tm-primary px-6 py-3 font-semibold text-white shadow-tm-md transition-colors hover:bg-tm-primary-dark"
            >
              Run risk assessment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmationFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfirmationField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  if (field.kind === "freeText") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-tm-text">
          {field.label}
        </label>
        <input
          type="text"
          placeholder={field.placeholder ?? "Enter value or estimate"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-tm-border bg-tm-surface px-3 py-2 text-sm text-tm-black placeholder:text-tm-text-muted focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20"
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-tm-text">
          {field.label}
        </label>
        <YesNoToggle
          value={typeof value === "boolean" ? value : null}
          onChange={onChange}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-tm-text">
        {field.label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={field.type === "percent" ? 100 : undefined}
          step={field.type === "percent" ? 0.1 : 1}
          placeholder={field.placeholder ?? "Enter value or estimate"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-tm-border bg-tm-surface px-3 py-2 pr-14 text-sm text-tm-black placeholder:text-tm-text-muted focus:border-tm-primary focus:outline-none focus:ring-2 focus:ring-tm-primary/20"
        />
        {field.suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tm-text-muted">
            {field.suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-tm-border bg-tm-surface p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          value === true
            ? "bg-tm-primary text-white shadow-sm"
            : "text-tm-text-light hover:text-tm-black"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          value === false
            ? "bg-tm-primary text-white shadow-sm"
            : "text-tm-text-light hover:text-tm-black"
        }`}
      >
        No
      </button>
    </div>
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

function SourceBadge({
  icon: Icon,
  label,
  variant = "default",
}: {
  icon: typeof FileText;
  label: string;
  variant?: "default" | "warn";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
        variant === "warn"
          ? "bg-tm-accent/10 text-tm-accent-dark"
          : "bg-tm-neutral text-tm-text-light"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
