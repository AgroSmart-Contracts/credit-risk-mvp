/**
 * Dimension A (Counterparty) — weighted-average + coverage shrink toward 50
 * (outline 2026-07-30). Formerly the "sandbox" tester; now the live CRAM
 * counterparty formula for platform deals and Assess.
 */
import type { Deal } from "../types";
import {
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

function isTmEntity(name: string): boolean {
  const k = name.toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return k.includes("TRU MARKET") || k.includes("TRUMARKET");
}

function clampRound(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Prefer company×product profile counts when present (platform deals). */
function profileDealCount(party: Deal["buyer"]): number {
  return party.profileDealCount ?? party.platformDealsCompleted ?? 0;
}

function profileFinishedCount(party: Deal["buyer"]): number {
  return party.profileFinishedDealCount ?? 0;
}

function mapCreditForSandbox(deal: Deal): number | null {
  if (deal.buyer.creditRating) {
    return scoreCreditRating(deal.buyer.creditRating);
  }
  return null;
}

export function buildBuyerInputs(deal: Deal): SandboxBuyerInputs {
  const { buyer } = deal;
  const customs = buyer.customsEnrichment;
  const dealCount = profileDealCount(buyer);
  const onPlatform = dealCount > 0;
  return {
    yearsInBusiness: buyer.yearsInBusiness,
    onlineVerifiability: customs?.matched ? 55 : null,
    importLicenseStatus: scoreLicenseValid(buyer.licenseValid) ?? null,
    importLicenseTm: isTmEntity(buyer.name) ? 100 : null,
    monthlyPurchaseVolumeUsd: customs?.monthlyFobUsd ?? null,
    yearlySalesUsd: customs?.fobUsd ?? null,
    annualImportVolumeMt: customs?.roles.includes("importer")
      ? customs.volumeMt
      : null,
    routeDiversity: customs?.routeCount ?? null,
    creditRating: mapCreditForSandbox(deal),
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
  return {
    yearsInBusiness: supplier.yearsInBusiness,
    onlineVerifiability: customs?.matched ? 55 : null,
    exportLicenseStatus: scoreLicenseValid(supplier.licenseValid) ?? null,
    productionCapacityMt: customs?.volumeMt ?? null,
    yearlySalesUsd: customs?.fobUsd ?? null,
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

export function scoreDealBuyer(deal: Deal): GroupScoreResult {
  return scoreBuyer(buildBuyerInputs(deal));
}

export function scoreDealSupplier(deal: Deal): GroupScoreResult {
  return scoreSupplier(buildSupplierInputs(deal));
}

export function scoreDealRelationship(deal: Deal): GroupScoreResult {
  return scoreRelationship({
    priorDealsBetweenParties: deal.priorDealsBetweenParties,
    relationshipAgeMonths: deal.relationshipAgeMonths,
  });
}

export function scoreDealCounterparty(deal: Deal): GroupScoreResult {
  return scoreComposite({
    buyer: buildBuyerInputs(deal),
    supplier: buildSupplierInputs(deal),
    relationship: {
      priorDealsBetweenParties: deal.priorDealsBetweenParties,
      relationshipAgeMonths: deal.relationshipAgeMonths,
    },
  });
}

export function computeBuyerScore(deal: Deal): number {
  return clampRound(scoreDealBuyer(deal).score);
}

export function computeSupplierScore(deal: Deal): number {
  return clampRound(scoreDealSupplier(deal).score);
}

export function computeCounterpartyScore(deal: Deal): number {
  return clampRound(scoreDealCounterparty(deal).score);
}

/** Relationship group score 0–100 (weighted/shrink), not the old −10/+10 additive. */
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
  const lines = fieldsToAuditLines(result.fields);
  const score = clampRound(result.score);
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
    lines,
    rawTotal: result.shrunkScore + result.trustBonus,
    score,
    whyBelow100,
  };
}
