/**
 * Dimension A (Counterparty) — weighted/shrink formula (outline 2026-07-30).
 * Formerly the sandbox tester; now the live CRAM counterparty scorer.
 *
 * Platform deals: prefer the precomputed sandbox score for
 * (company, role, product) from counterparty-sandbox-scores.json (customs-
 * enriched). Assess / unknown parties: score live from deal fields.
 */
import type { Deal } from "../types";
import { sandboxCounterparties } from "../data/counterparty-sandbox-scores";
import {
  monthlyFromYearlySalesUsd,
  scoreBuyer,
  scoreComposite,
  scoreCreditRating,
  scoreLicenseValid,
  scoreRelationship,
  scoreSupplier,
  type GroupScoreResult,
  type SandboxBuyerInputs,
  type SandboxSupplierInputs,
  type WeightedField,
} from "./counterparty-sandbox-scoring";

function clampRound(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function groupKey(role: string, companyName: string, product: string): string {
  return `${role}::${companyName.trim().toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ")}::${product}`;
}

const sandboxByKey = new Map(
  sandboxCounterparties.map((cp) => [
    groupKey(cp.role, cp.companyName, cp.product),
    cp,
  ] as const),
);

function isTmEntity(name: string): boolean {
  const k = name.toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return k.includes("TRU MARKET") || k.includes("TRUMARKET");
}

function profileDealCount(party: Deal["buyer"]): number {
  return party.profileDealCount ?? party.platformDealsCompleted ?? 0;
}

function profileFinishedCount(party: Deal["buyer"]): number {
  return party.profileFinishedDealCount ?? 0;
}

export function buildBuyerInputs(deal: Deal): SandboxBuyerInputs {
  const { buyer } = deal;
  const customs = buyer.customsEnrichment;
  const dealCount = profileDealCount(buyer);
  const onPlatform = dealCount > 0;
  const yearlySalesUsd = customs?.fobUsd ?? null;
  // Always yearly/12 — do not use customs monthlyFobUsd (fob/activeMonths),
  // which inflated seasonal buyers (monthly×12 ≫ yearly).
  const monthlyPurchaseVolumeUsd = monthlyFromYearlySalesUsd(yearlySalesUsd);
  const frequencyCount =
    customs?.shipments != null && customs.shipments > 0
      ? customs.shipments
      : null;
  return {
    yearsInBusiness: buyer.yearsInBusiness,
    frequencyOfDeals: frequencyCount,
    monthlyPurchaseVolumeUsd,
    yearlySalesUsd,
    annualImportVolumeMt: customs?.roles.includes("importer")
      ? customs.volumeMt
      : null,
    routeDiversity: customs?.routeCount ?? null,
    creditRating: buyer.creditRating
      ? scoreCreditRating(buyer.creditRating)
      : null,
    platformTransactionCount: dealCount > 0 ? dealCount : null,
    paymentDelayDays:
      buyer.avgPaymentDelayDays === undefined || buyer.avgPaymentDelayDays === null
        ? null
        : buyer.avgPaymentDelayDays,
    tmPlatformTrust: onPlatform || isTmEntity(buyer.name),
  };
}

export function buildSupplierInputs(deal: Deal): SandboxSupplierInputs {
  const { supplier } = deal;
  const customs = supplier.customsEnrichment;
  const dealCount = profileDealCount(supplier);
  const finished = profileFinishedCount(supplier);
  const onPlatform = dealCount > 0;
  const onTime =
    supplier.platformCompletionRate != null
      ? supplier.platformCompletionRate
      : dealCount > 0 && finished > 0
        ? Math.round((finished / dealCount) * 100)
        : null;
  const yearlySalesUsd = customs?.fobUsd ?? null;
  const frequencyCount =
    customs?.shipments != null && customs.shipments > 0
      ? customs.shipments
      : null;
  return {
    yearsInBusiness: supplier.yearsInBusiness,
    frequencyOfDeals: frequencyCount,
    exportLicenseStatus: scoreLicenseValid(supplier.licenseValid) ?? null,
    productionCapacityMt: customs?.volumeMt ?? null,
    yearlySalesUsd,
    annualExportVolumeMt: customs?.roles.includes("exporter")
      ? customs.volumeMt
      : (customs?.volumeMt ?? null),
    routeDiversity: customs?.routeCount ?? null,
    qualityCertifications: null,
    platformTransactionCount: dealCount > 0 ? dealCount : null,
    onTimeDeliveryRate: onTime,
    qualityRejectionRate:
      supplier.qualityRejectionRatePct === undefined ||
      supplier.qualityRejectionRatePct === null
        ? null
        : supplier.qualityRejectionRatePct,
    tmPlatformTrust: onPlatform || isTmEntity(supplier.name),
  };
}

/** Enrich deal parties from the sandbox customs blob when missing on the deal. */
export function dealWithSandboxEnrichment(deal: Deal): Deal {
  const buyerCp = sandboxByKey.get(
    groupKey("buyer", deal.buyer.name, deal.product),
  );
  const supplierCp = sandboxByKey.get(
    groupKey("supplier", deal.supplier.name, deal.product),
  );

  const buyerEnrichment =
    deal.buyer.customsEnrichment ??
    (buyerCp?.sandbox
      ? {
          matched: buyerCp.sandbox.customsMatched,
          // Calendar monthly average (yearly/12) — not seasonal peak.
          monthlyFobUsd:
            buyerCp.sandbox.customsFobUsd != null &&
            buyerCp.sandbox.customsFobUsd > 0
              ? Math.round((buyerCp.sandbox.customsFobUsd / 12) * 100) / 100
              : null,
          fobUsd: buyerCp.sandbox.customsFobUsd,
          volumeMt: buyerCp.sandbox.customsVolumeMt,
          routeCount: buyerCp.sandbox.customsRoutes,
          roles: buyerCp.sandbox.customsMatched ? ["importer"] : [],
          shipments: buyerCp.sandbox.customsShipments,
        }
      : null);

  const supplierEnrichment =
    deal.supplier.customsEnrichment ??
    (supplierCp?.sandbox
      ? {
          matched: supplierCp.sandbox.customsMatched,
          monthlyFobUsd:
            supplierCp.sandbox.customsFobUsd != null &&
            supplierCp.sandbox.customsFobUsd > 0
              ? Math.round((supplierCp.sandbox.customsFobUsd / 12) * 100) / 100
              : null,
          fobUsd: supplierCp.sandbox.customsFobUsd,
          volumeMt: supplierCp.sandbox.customsVolumeMt,
          routeCount: supplierCp.sandbox.customsRoutes,
          roles: supplierCp.sandbox.customsMatched ? ["exporter"] : [],
          shipments: supplierCp.sandbox.customsShipments,
        }
      : null);

  return {
    ...deal,
    buyer: {
      ...deal.buyer,
      profileDealCount:
        deal.buyer.profileDealCount ?? buyerCp?.dealCount ?? deal.buyer.platformDealsCompleted,
      profileFinishedDealCount:
        deal.buyer.profileFinishedDealCount ?? buyerCp?.finishedDealCount ?? 0,
      avgPaymentDelayDays: deal.buyer.avgPaymentDelayDays ?? null,
      customsEnrichment: buyerEnrichment,
    },
    supplier: {
      ...deal.supplier,
      profileDealCount:
        deal.supplier.profileDealCount ??
        supplierCp?.dealCount ??
        deal.supplier.platformDealsCompleted,
      profileFinishedDealCount:
        deal.supplier.profileFinishedDealCount ??
        supplierCp?.finishedDealCount ??
        0,
      qualityRejectionRatePct: deal.supplier.qualityRejectionRatePct ?? null,
      customsEnrichment: supplierEnrichment,
    },
  };
}

export function scoreDealBuyer(deal: Deal): GroupScoreResult {
  return scoreBuyer(buildBuyerInputs(dealWithSandboxEnrichment(deal)));
}

export function scoreDealSupplier(deal: Deal): GroupScoreResult {
  return scoreSupplier(buildSupplierInputs(dealWithSandboxEnrichment(deal)));
}

export function scoreDealRelationship(deal: Deal): GroupScoreResult {
  return scoreRelationship({
    priorDealsBetweenParties: deal.priorDealsBetweenParties,
    relationshipAgeMonths: deal.relationshipAgeMonths,
  });
}

export function scoreDealCounterparty(deal: Deal): GroupScoreResult {
  const enriched = dealWithSandboxEnrichment(deal);
  return scoreComposite({
    buyer: buildBuyerInputs(enriched),
    supplier: buildSupplierInputs(enriched),
    relationship: {
      priorDealsBetweenParties: deal.priorDealsBetweenParties,
      relationshipAgeMonths: deal.relationshipAgeMonths,
    },
  });
}

export function computeBuyerScore(deal: Deal): number {
  const hit = sandboxByKey.get(groupKey("buyer", deal.buyer.name, deal.product));
  if (hit?.sandbox?.score != null) return clampRound(hit.sandbox.score);
  return clampRound(scoreDealBuyer(deal).score);
}

export function computeSupplierScore(deal: Deal): number {
  const hit = sandboxByKey.get(
    groupKey("supplier", deal.supplier.name, deal.product),
  );
  if (hit?.sandbox?.score != null) return clampRound(hit.sandbox.score);
  return clampRound(scoreDealSupplier(deal).score);
}

export function computeCounterpartyScore(deal: Deal): number {
  return clampRound(scoreDealCounterparty(deal).score);
}

/**
 * Composite (buyer + supplier + relationship) coverage %, 0–100 — how much
 * of the counterparty profile is actually known for this deal, independent
 * of the score itself. Two deals can land on the same composite score with
 * very different amounts of underlying data; this is what lets a downstream
 * consumer (e.g. financing.ts's APY calc) price that difference explicitly
 * instead of it disappearing once the score is shrunk toward neutral.
 */
export function computeCounterpartyCoveragePct(deal: Deal): number {
  return Math.round(scoreDealCounterparty(deal).coverageFraction * 1000) / 10;
}

/** Relationship group score 0–100 (weighted/shrink). */
export function relationshipAdjustment(deal: Deal): number {
  return clampRound(scoreDealRelationship(deal).score);
}

export interface PartyScoreLine {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface PartyScoreAudit {
  role: "buyer" | "supplier";
  base: number;
  lines: PartyScoreLine[];
  rawTotal: number;
  score: number;
  whyBelow100: string[];
}

function fieldsToAuditLines(fields: WeightedField[]): PartyScoreLine[] {
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    points: f.score ?? 0,
    maxPoints: 100,
    detail:
      f.score == null
        ? "Blank — excluded from raw average; still counts against coverage"
        : `Field score ${Math.round(f.score)} (weight ${f.weight})`,
  }));
}

export function explainPartyScore(
  deal: Deal,
  role: "buyer" | "supplier",
): PartyScoreAudit {
  const result = role === "buyer" ? scoreDealBuyer(deal) : scoreDealSupplier(deal);
  const score =
    role === "buyer" ? computeBuyerScore(deal) : computeSupplierScore(deal);
  const whyBelow100 =
    score >= 100
      ? []
      : [
          `Coverage ${Math.round(result.coverageFraction * 100)}% · raw avg ${
            result.rawAverage == null ? "n/a" : Math.round(result.rawAverage)
          } · shrink→${Math.round(result.shrunkScore)} + trust ${result.trustBonus}`,
          ...result.fields
            .filter((f) => f.score == null)
            .map((f) => `${f.label}: blank (weight ${f.weight})`),
        ];
  return {
    role,
    base: 50,
    lines: fieldsToAuditLines(result.fields),
    rawTotal: result.shrunkScore + result.trustBonus,
    score,
    whyBelow100,
  };
}
