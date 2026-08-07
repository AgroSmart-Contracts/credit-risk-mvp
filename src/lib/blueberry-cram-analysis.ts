/**
 * Deep CRAM breakdown for a curated set of Fresh Blueberries platform deals.
 * Used by the Blueberry CRAM analysis tab — not a live scorer, just an audit view.
 */
import { platformDeals } from "../data/platform-deals";
import type { PlatformDealRecord } from "../types/platform";
import type { Deal, FinancingRecommendation, RiskTier } from "../types";
import { platformDealToDeal } from "./platform-deal-mapper";
import { buildRiskAssessment, formatUSD } from "./assessment";
import { recommendFinancingTerms } from "./financing";
import { computeOverallScore } from "./scoring";
import { DIMENSION_WEIGHTS } from "./scoring-constants";
import {
  scoreDealBuyer,
  scoreDealSupplier,
  scoreDealRelationship,
  scoreDealCounterparty,
  dealWithSandboxEnrichment,
} from "./dimension-a";
import type { GroupScoreResult } from "./counterparty-sandbox-scoring";
import { SANDBOX_NEUTRAL } from "./counterparty-sandbox-scoring";
import { sandboxCounterparties } from "../data/counterparty-sandbox-scores";
import { priceVsMarketDetail } from "./price-benchmarks";
import { lookupRouteRisk } from "./route-risk-tables";
import { paymentTermsAdjustment } from "./scoring";

function partyKey(role: string, companyName: string, product: string): string {
  return `${role}::${companyName.trim().toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ")}::${product}`;
}

const sandboxByKey = new Map(
  sandboxCounterparties.map(
    (cp) =>
      [partyKey(cp.role, cp.companyName, cp.product), cp] as const,
  ),
);

function toShrinkAudit(
  label: string,
  result: GroupScoreResult,
  publishedSandboxScore: number | null,
): ShrinkPartyAudit {
  const filledFieldCount = result.fields.filter((f) => f.score != null).length;
  return {
    label,
    rawAverage:
      result.rawAverage == null
        ? null
        : Math.round(result.rawAverage * 10) / 10,
    filledWeight: Math.round(result.filledWeight * 10) / 10,
    possibleWeight: Math.round(result.possibleWeight * 10) / 10,
    filledFieldCount,
    totalFieldCount: result.fields.length,
    weightCoveragePct: Math.round(result.weightCoverageFraction * 1000) / 10,
    fieldCoveragePct: Math.round(result.fieldCoverageFraction * 1000) / 10,
    coveragePct: Math.round(result.coverageFraction * 1000) / 10,
    shrunkScore: Math.round(result.shrunkScore * 10) / 10,
    trustBonus: result.trustBonus,
    finalScore: Math.round(result.score * 10) / 10,
    rangeLow: Math.round(result.pessimisticScore),
    rangeHigh: Math.round(result.optimisticScore),
    publishedSandboxScore,
  };
}

function buildCounterpartyMethodAudit(
  deal: Deal,
  buyerResult: GroupScoreResult,
  supplierResult: GroupScoreResult,
  relResult: GroupScoreResult,
  compositeA: GroupScoreResult,
): CounterpartyMethodAudit {
  const buyerSb = sandboxByKey.get(
    partyKey("buyer", deal.buyer.name, deal.product),
  )?.sandbox?.score;
  const supplierSb = sandboxByKey.get(
    partyKey("supplier", deal.supplier.name, deal.product),
  )?.sandbox?.score;

  return {
    parties: [
      toShrinkAudit("Buyer", buyerResult, buyerSb ?? null),
      toShrinkAudit("Supplier", supplierResult, supplierSb ?? null),
      toShrinkAudit("Relationship", relResult, null),
      toShrinkAudit("Composite (feeds Dimension A)", compositeA, null),
    ],
    why: [
      `Blank fields are excluded from the raw average so missing data does not fake a zero — we only average what we know.`,
      `Coverage = the more conservative of filled weight ÷ possible weight and filled field count ÷ total field count. A couple of heavy fields (e.g. credit rating + years-in-business) no longer look as complete as their weight alone would suggest.`,
      `Shrink: coverage × rawAvg + (1 − coverage) × ${SANDBOX_NEUTRAL}. Pulls sparse profiles toward neutral ${SANDBOX_NEUTRAL} so one or two strong fields cannot overstate creditworthiness.`,
      `TM trust bonus (+3 when on-platform / TM affiliate) is added flat after shrink — a known platform relationship keeps its full weight even on a thin customs profile.`,
      `Range: best/worst case if every missing field turned out to score 100 / 0. The published score is always the range's midpoint (missing fields assumed neutral).`,
      `Dimension A overall uses the composite (buyer + supplier + relationship fields together), then × 40% of CRAM.`,
    ],
    improvements: [
      `Fill customs for importers (Veritrade / Matching Company as Importador) — unlocks monthly volume, yearly FOB, MT, routes, and online verifiability (55).`,
      `Wire monthlyFobUsd through sandbox enrichment (today live rebuild often drops it even when Counterparties scored it).`,
      `Add Coface / CRA credit ratings — weight 7, currently almost always blank.`,
      `Payment delay / quality rejection now correctly exclude from the raw average when unmeasured (fixed 2026-08-06 — previously defaulted to a free 100).`,
      `Online verifiability for the 6 non-customs-matched blueberries counterparties is now hand-researched (see docs/blueberry-deals-research-2026-08-06.md) — 3 came back with real identity-verification red flags (Allied Trade Global's taxId matches no registered Taiwan company; Guangzhou Fresh Link is fully unverifiable; two Peru RUCs on file fail SUNAT's checksum) that need human follow-up.`,
      `Improve name matching (spelling variants) so buyers like Agro Smart are found when they appear under a different consignee string.`,
      `Consider a lower floor than ${SANDBOX_NEUTRAL} for veto-adjacent signals, or requiring minimum coverage before AUTO-APPROVE.`,
    ],
  };
}

/** Curated mongoIds — unique buyers, customs-matched importers, score spread.
 *  Note: among Fresh Blueberries deals with customs-matched buyers, only two
 *  suppliers appear (TM + Holy Fruit), so TM repeats on several rows; the four
 *  previous deals (Allied / Guangzhou Fresh Link / Fresh Express / Agro Smart)
 *  were dropped because those buyers are absent from Veritrade/Datasur.
 */
export const BLUEBERRY_CRAM_SAMPLE_MONGO_IDS = [
  "690cf87e3d2ca4b63b280e92", // Limax ← TM · ~78
  "6761acdbb9fa43de6d8a387f", // ASM International ← TM · ~72
  "675a16e4b9fa43de6d873513", // BC Nature ← TM · ~68
  "6764614cb9fa43de6d8c1bc2", // Benassi ← TM · ~65
  "6922fd4e11cf91e11fbd2f5a", // Eagle Trading ← Holy Fruit · ~64
] as const;

export interface FieldRow {
  id: string;
  label: string;
  /** Raw input shown to the analyst */
  input: string;
  /** Numeric field score 0–100, or null if blank/excluded */
  score: number | null;
  weight: number;
  note: string;
}

/** Raw avg → coverage → shrink → trust bonus audit for one party group. */
export interface ShrinkPartyAudit {
  label: string;
  rawAverage: number | null;
  filledWeight: number;
  possibleWeight: number;
  filledFieldCount: number;
  totalFieldCount: number;
  /** filled weight ÷ possible weight, as a % — one of the two coverage() inputs */
  weightCoveragePct: number;
  /** filled fields ÷ total fields, as a % — the other coverage() input */
  fieldCoveragePct: number;
  coveragePct: number;
  shrunkScore: number;
  trustBonus: number;
  finalScore: number;
  /** Worst/best case if every missing field turned out to score 0 / 100 */
  rangeLow: number;
  rangeHigh: number;
  /** Counterparties-tab published sandbox score, when applicable */
  publishedSandboxScore: number | null;
}

export interface CounterpartyMethodAudit {
  parties: ShrinkPartyAudit[];
  why: string[];
  improvements: string[];
}

export interface DimensionBreakdown {
  key: "counterparty" | "product" | "route" | "structure";
  title: string;
  weight: number;
  score: number;
  contribution: number;
  why: string;
  fields: FieldRow[];
  formula: string;
  /** Present on Dimension A — raw/coverage/shrink walkthrough */
  methodAudit?: CounterpartyMethodAudit;
}

export interface BlueberryCramCase {
  mongoId: string;
  record: PlatformDealRecord;
  deal: Deal;
  overall: number;
  tier: RiskTier;
  vetoed: boolean;
  vetoReasons: string[];
  dimensions: DimensionBreakdown[];
  financing: FinancingRecommendation;
  /** Estimated financing APY% = baseRate + riskPremium from financing engine */
  estimatedApyPct: number;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function structureFallbackFields(deal: Deal): FieldRow[] {
  const payAdj = paymentTermsAdjustment(deal.paymentTerms);
  const rel =
    deal.priorDealsBetweenParties >= 10
      ? 15
      : deal.priorDealsBetweenParties >= 5
        ? 12
        : deal.priorDealsBetweenParties >= 1
          ? 8
          : -12;
  const adv =
    deal.advancePaymentPct >= 50
      ? 10
      : deal.advancePaymentPct >= 25
        ? 7
        : deal.advancePaymentPct >= 10
          ? 5
          : 0;
  const collMap: Record<string, number> = {
    "Letter of Credit": 25,
    "Bank Guarantee": 20,
    "Warehouse Receipt": 15,
    "Inventory Pledge": 10,
    "Personal Guarantee": 5,
    None: -5,
  };
  const coll = collMap[deal.collateralType] ?? 0;
  const ins =
    deal.insuranceCoverage === "All Risk"
      ? 5
      : deal.insuranceCoverage === "Comprehensive"
        ? 3
        : deal.insuranceCoverage === "Basic"
          ? 1
          : 0;

  return [
    {
      id: "base",
      label: "Structure base",
      input: "60",
      score: 60,
      weight: 0,
      note: "Flat fallback (no transaction-structure cash-flow input on platform CSV deals)",
    },
    {
      id: "collateral",
      label: "Collateral",
      input: `${deal.collateralType} (value ${formatUSD(deal.collateralValueUSD)})`,
      score: coll,
      weight: 35,
      note: "Points added to base (spec §4.D)",
    },
    {
      id: "paymentTerms",
      label: "Payment terms",
      input: deal.paymentTerms,
      score: payAdj,
      weight: 25,
      note: "Points added to base",
    },
    {
      id: "relationship",
      label: "Prior deals (structure)",
      input: `${deal.priorDealsBetweenParties} prior · ${deal.relationshipAgeMonths} mo relationship`,
      score: rel,
      weight: 25,
      note: "≥10 → +15 / ≥5 → +12 / ≥1 → +8 / 0 → −12",
    },
    {
      id: "advance",
      label: "Advance payment %",
      input: `${deal.advancePaymentPct}%`,
      score: adv,
      weight: 10,
      note: "≥50% → +10 / ≥25% → +7 / ≥10% → +5",
    },
    {
      id: "insurance",
      label: "Cargo insurance",
      input: deal.insuranceCoverage,
      score: ins,
      weight: 0,
      note:
        deal.insuranceCoverage === "None"
          ? "0 pts here — also triggers veto register (mandatory baseline)"
          : "Points added to base",
    },
  ];
}

export function buildBlueberryCramCase(
  record: PlatformDealRecord,
): BlueberryCramCase {
  const deal = platformDealToDeal(record);
  const breakdown = computeOverallScore(deal);
  const assessment = buildRiskAssessment(deal);
  const financing = recommendFinancingTerms(
    breakdown.overall,
    deal.dealValueUSD,
    breakdown.counterpartyCoveragePct,
  );

  const buyerResult = scoreDealBuyer(deal);
  const supplierResult = scoreDealSupplier(deal);
  const relResult = scoreDealRelationship(deal);
  const compositeA = scoreDealCounterparty(deal);
  const enrichedDeal = dealWithSandboxEnrichment(deal);

  const buyerFields: FieldRow[] = buyerResult.fields.map((f) => {
    const score = f.score ?? null;
    const customs = enrichedDeal.buyer.customsEnrichment;
    return {
      id: `buyer.${f.id}`,
      label: `Buyer · ${f.label}`,
      input:
        f.id === "yearsInBusiness"
          ? `${deal.buyer.yearsInBusiness ?? "—"} yrs (source ${record.buyerYibSource})`
          : f.id === "platformTransactionCount"
            ? `${deal.buyer.platformDealsCompleted} platform deals`
            : f.id === "importLicenseStatus"
              ? `licenseValid=${String(deal.buyer.licenseValid)}`
              : f.id === "paymentDelay"
                ? deal.buyer.avgPaymentDelayDays == null
                  ? "default full score (no measured delay yet)"
                  : `${deal.buyer.avgPaymentDelayDays} days`
                : f.id === "monthlyPurchaseVolume"
                  ? customs?.monthlyFobUsd != null
                    ? `$${Math.round(customs.monthlyFobUsd).toLocaleString()} /mo (customs)`
                    : "blank — not in Veritrade/Matching as Importador"
                  : f.id === "yearlySales"
                    ? customs?.fobUsd != null
                      ? `$${Math.round(customs.fobUsd).toLocaleString()} FOB (customs)`
                      : "blank — not in Veritrade/Matching as Importador"
                    : f.id === "annualImportVolume"
                      ? customs?.volumeMt != null
                        ? `${customs.volumeMt} MT (customs)`
                        : "blank — not in Veritrade/Matching as Importador"
                      : f.id === "routeDiversity"
                        ? customs?.routeCount != null
                          ? `${customs.routeCount} routes (customs)`
                          : "blank — not in Veritrade/Matching as Importador"
                        : f.id === "onlineVerifiability"
                          ? customs?.matched
                            ? "customs match → 55"
                            : score == null
                              ? "blank — no online/customs signal"
                              : `score ${Math.round(score)} (web/registry lookup)`
                          : f.id === "creditRating"
                            ? "blank — needs Coface CRA/DRA (not in Veritrade)"
                            : score == null
                              ? "blank"
                              : `score ${Math.round(score)}`,
      score,
      weight: f.weight,
      note:
        f.id === "paymentDelay" && deal.buyer.avgPaymentDelayDays == null
          ? "Temporary default 100 until payment-timing data exists"
          : f.id === "creditRating" && score == null
            ? "Coface only — Veritrade cannot fill this"
            : score == null
              ? "Blank — excluded from raw avg; still reduces coverage"
              : `Weight ${f.weight}`,
    };
  });

  const supplierFields: FieldRow[] = supplierResult.fields.map((f) => {
    const score = f.score ?? null;
    return {
      id: `supplier.${f.id}`,
      label: `Supplier · ${f.label}`,
      input:
        f.id === "yearsInBusiness"
          ? `${deal.supplier.yearsInBusiness ?? "—"} yrs (source ${record.supplierYibSource})`
          : f.id === "platformTransactionCount"
            ? `${deal.supplier.platformDealsCompleted} platform deals`
            : f.id === "onTimeDeliveryRate"
              ? `completion ${deal.supplier.platformCompletionRate ?? "—"}%`
              : f.id === "qualityRejectionRate"
                ? deal.supplier.qualityRejectionRatePct == null
                  ? "default full score (no measured rejection rate yet)"
                  : `${deal.supplier.qualityRejectionRatePct}%`
                : score == null
                  ? "blank"
                  : `score ${Math.round(score)}`,
      score,
      weight: f.weight,
      note:
        f.id === "qualityRejectionRate" &&
        deal.supplier.qualityRejectionRatePct == null
          ? "Temporary default 100 until rejection-rate data exists"
          : score == null
            ? "Blank — excluded from raw avg; still reduces coverage"
            : `Weight ${f.weight}`,
    };
  });

  const relFields: FieldRow[] = relResult.fields.map((f) => {
    const score = f.score ?? null;
    return {
      id: `rel.${f.id}`,
      label: `Relationship · ${f.label}`,
      input:
        f.id === "priorDealsBetweenParties"
          ? String(deal.priorDealsBetweenParties)
          : f.id === "relationshipAgeMonths"
            ? `${deal.relationshipAgeMonths} months`
            : score == null
              ? "blank"
              : `score ${Math.round(score)}`,
      score,
      weight: f.weight,
      note: score == null ? "Blank" : `Weight ${f.weight}`,
    };
  });

  const price = priceVsMarketDetail(deal);
  const productFields: FieldRow[] = [
    {
      id: "base",
      label: "Product base",
      input: "70",
      score: 70,
      weight: 0,
      note: "Convention — no baked product-table score",
    },
    {
      id: "priceVsMarket",
      label: "Price vs usual (month×route)",
      input:
        price.usualUsdPerKg != null
          ? `$${fmtNum(price.dealUnitPriceUSD)}/kg vs usual $${fmtNum(price.usualUsdPerKg)}/kg (${price.deflatedPctOverUsual != null && price.deflatedPctOverUsual > 0 ? "+" : ""}${fmtNum(price.deflatedPctOverUsual, 1)}%, ${price.fallback}${price.match ? ` · ${price.match.matchLevel}` : ""})`
          : `Deal unit $${fmtNum(price.dealUnitPriceUSD)}/kg · no usual benchmark (${price.fallback})`,
      score: price.pts,
      weight: 0,
      note: "Band points −35…+20 added to base 70",
    },
    {
      id: "offerUnit",
      label: "Offer unit price (raw CSV)",
      input:
        deal.offerUnitPriceUSD != null
          ? `$${fmtNum(deal.offerUnitPriceUSD)} (may be per carton)`
          : "—",
      score: null,
      weight: 0,
      note: "Context only — scoring uses $/kg when quantity allows",
    },
    {
      id: "shippingMonth",
      label: "Shipping start",
      input: deal.shippingStartDate ?? "—",
      score: null,
      weight: 0,
      note: "Keys month×route usual price table",
    },
  ];

  const routeProfile =
    deal.routeRiskProfile ??
    lookupRouteRisk(
      deal.origin,
      deal.destination,
      deal.product,
      deal.transportMode,
      deal.numberOfTransshipments,
    );

  const routeFields: FieldRow[] = [
    {
      id: "od",
      label: "Origin → destination",
      input: `${deal.origin} → ${deal.destination}`,
      score: null,
      weight: 0,
      note: "Lookup key for Dimension C v2 table",
    },
    {
      id: "modeStops",
      label: "Mode / stops",
      input: `${deal.transportMode ?? "—"} · ${deal.numberOfTransshipments} transshipments · transit ${deal.estimatedTransitDays}d`,
      score: null,
      weight: 0,
      note: "Air stop band selects table row",
    },
    {
      id: "table",
      label: "Route table score",
      input: routeProfile
        ? `${routeProfile.score} · ${routeProfile.routeRiskFlag} · ${routeProfile.transportMode}${routeProfile.airStops != null ? ` · ${routeProfile.airStops} air stops` : ""} · ${routeProfile.scoreConfirmed ? "AC-confirmed" : "provisional"}`
        : "No table row — fallback base 70",
      score: routeProfile?.score ?? 70,
      weight: 0,
      note: routeProfile?.rationale ?? "HANDOFF: engine never guesses on miss",
    },
  ];

  const dims: DimensionBreakdown[] = [
    {
      key: "counterparty",
      title: "A · Counterparty",
      weight: DIMENSION_WEIGHTS.counterparty,
      score: breakdown.counterparty,
      contribution:
        Math.round(
          breakdown.counterparty * DIMENSION_WEIGHTS.counterparty * 10,
        ) / 10,
      why: assessment.counterparty.why,
      formula: `Composite ${Math.round(compositeA.score)} (buyer cov ${Math.round(buyerResult.coverageFraction * 100)}% · supplier cov ${Math.round(supplierResult.coverageFraction * 100)}%). Live field rebuild below; Counterparties tab may show published sandbox party scores.`,
      fields: [...buyerFields, ...supplierFields, ...relFields],
      methodAudit: buildCounterpartyMethodAudit(
        deal,
        buyerResult,
        supplierResult,
        relResult,
        compositeA,
      ),
    },
    {
      key: "product",
      title: "B · Product",
      weight: DIMENSION_WEIGHTS.product,
      score: breakdown.product,
      contribution:
        Math.round(breakdown.product * DIMENSION_WEIGHTS.product * 10) / 10,
      why: assessment.product.why,
      formula: `70 + pricePts(${price.pts}) = ${breakdown.product}`,
      fields: productFields,
    },
    {
      key: "route",
      title: "C · Route",
      weight: DIMENSION_WEIGHTS.route,
      score: breakdown.route,
      contribution:
        Math.round(breakdown.route * DIMENSION_WEIGHTS.route * 10) / 10,
      why: assessment.route.why,
      formula: routeProfile
        ? `Table score ${routeProfile.score} (no Incoterms overlay)`
        : "No table row → base 70",
      fields: routeFields,
    },
    {
      key: "structure",
      title: "D · Structure",
      weight: DIMENSION_WEIGHTS.structure,
      score: breakdown.structure,
      contribution:
        Math.round(breakdown.structure * DIMENSION_WEIGHTS.structure * 10) /
        10,
      why: assessment.structure.why,
      formula: deal.transactionStructure
        ? "Cash-flow structure engine composite"
        : `clamp(60 + collateral + payment + relationship + advance + insurance) = ${breakdown.structure}`,
      fields: structureFallbackFields(deal),
    },
  ];

  return {
    mongoId: record.mongoId,
    record,
    deal,
    overall: breakdown.overall,
    tier: breakdown.tier,
    vetoed: breakdown.vetoed,
    vetoReasons: breakdown.vetoReasons,
    dimensions: dims,
    financing,
    estimatedApyPct: financing.interestRate,
  };
}

export function loadBlueberryCramCases(): BlueberryCramCase[] {
  const byId = new Map(platformDeals.map((d) => [d.mongoId, d]));
  const cases: BlueberryCramCase[] = [];
  for (const id of BLUEBERRY_CRAM_SAMPLE_MONGO_IDS) {
    const record = byId.get(id);
    if (!record) {
      console.warn(`[blueberry-cram] missing deal ${id}`);
      continue;
    }
    cases.push(buildBlueberryCramCase(record));
  }
  return cases;
}
