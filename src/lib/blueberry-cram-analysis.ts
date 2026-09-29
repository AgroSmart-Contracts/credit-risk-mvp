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
import { computeRiskReward, type RiskRewardSummary } from "./risk-reward";

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
      `Blanks are skipped in the raw average (not scored as 0).`,
      `Coverage = min(weight filled, fields filled); shrink pulls sparse profiles toward ${SANDBOX_NEUTRAL}.`,
      `+3 TM trust after shrink when on-platform. Published score = midpoint of missing-field range.`,
    ],
    improvements: [
      `Fill Veritrade importer customs → volume, FOB, routes, shipment count.`,
      `Add Coface/CRA credit rating (often blank, weight 7).`,
      `Tighten buyer name matching so customs rows link reliably.`,
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

export type FieldHighlight = "primary" | "danger" | "accent" | "call";

export interface FieldRow {
  id: string;
  label: string;
  /** Raw input shown to the analyst */
  input: string;
  /** Numeric field score 0–100, or null if blank/excluded */
  score: number | null;
  weight: number;
  note: string;
  /** Visual emphasis — same tones as pre-scored Structure KpiStrip */
  highlight?: FieldHighlight;
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
  /** Investor/ops risk–reward overlay for Structure (Dimension D). */
  riskReward: RiskRewardSummary;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function structureFallbackFields(
  deal: Deal,
  riskReward: RiskRewardSummary,
): FieldRow[] {
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

  // Scoring inputs only — cash KPIs / investment call live in StructureInvestmentPanel.
  return [
    {
      id: "base",
      label: "Structure base",
      input: "60",
      score: 60,
      weight: 0,
      note: "Fallback base (no attached cash-flow structure)",
    },
    {
      id: "collateral",
      label: "Collateral",
      input: `${deal.collateralType} (${formatUSD(deal.collateralValueUSD)})`,
      score: coll,
      weight: 35,
      note: "Pts vs base",
    },
    {
      id: "paymentTerms",
      label: "Payment terms",
      input: deal.paymentTerms,
      score: payAdj,
      weight: 25,
      note: "Pts vs base",
    },
    {
      id: "relationship",
      label: "Prior deals (structure)",
      input: `${deal.priorDealsBetweenParties} prior · ${deal.relationshipAgeMonths} mo`,
      score: rel,
      weight: 25,
      note: "≥10 +15 · ≥5 +12 · ≥1 +8 · 0 −12",
    },
    {
      id: "advance",
      label: "Advance payment %",
      input: `${deal.advancePaymentPct}%`,
      score: adv,
      weight: 10,
      note:
        deal.advancePaymentPct > 0
          ? "≥50 +10 · ≥25 +7 · ≥10 +5"
          : `0% on deal · policy asks ${riskReward.recommendedAdvancePct}%`,
      highlight: deal.advancePaymentPct <= 0 ? "accent" : "primary",
    },
    {
      id: "insurance",
      label: "Cargo insurance",
      input: deal.insuranceCoverage,
      score: ins,
      weight: 0,
      note: deal.insuranceCoverage === "None" ? "Veto — mandatory" : "Pts vs base",
      highlight: deal.insuranceCoverage === "None" ? "danger" : undefined,
    },
    {
      id: "structureCashScore",
      label: "Cash-structure score",
      input: `${Math.round(riskReward.structureComposite)}/100 · ${riskReward.structureTier}`,
      score: riskReward.structureComposite,
      weight: 0,
      note: riskReward.structureProtocol,
      highlight:
        riskReward.structureComposite < 60
          ? "accent"
          : riskReward.structureComposite >= 75
            ? "primary"
            : undefined,
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
  const riskReward = computeRiskReward({
    deal,
    overall: breakdown.overall,
    tier: breakdown.tier,
    vetoed: breakdown.vetoed,
    financing,
  });

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
            : f.id === "paymentDelay"
                ? deal.buyer.avgPaymentDelayDays == null
                  ? "unmeasured"
                  : `${deal.buyer.avgPaymentDelayDays} days`
                  : f.id === "monthlyPurchaseVolume"
                  ? customs?.fobUsd != null
                    ? `$${Math.round(customs.fobUsd / 12).toLocaleString()}/mo`
                    : "blank — no customs"
                  : f.id === "yearlySales"
                    ? customs?.fobUsd != null
                      ? `$${Math.round(customs.fobUsd).toLocaleString()} FOB`
                      : "blank — no customs"
                    : f.id === "annualImportVolume"
                      ? customs?.volumeMt != null
                        ? `${customs.volumeMt} MT`
                        : "blank — no customs"
                      : f.id === "routeDiversity"
                        ? customs?.routeCount != null
                          ? `${customs.routeCount} routes`
                          : "blank — no customs"
                        : f.id === "frequencyOfDeals"
                          ? customs?.shipments != null && customs.shipments > 0
                            ? `${customs.shipments} shipments`
                            : deal.buyer.platformDealsCompleted > 0
                              ? `${deal.buyer.platformDealsCompleted} platform deals`
                              : "blank"
                          : f.id === "creditRating"
                            ? "blank — needs Coface"
                            : score == null
                              ? "blank"
                              : `score ${Math.round(score)}`,
      score,
      weight: f.weight,
      note:
        f.id === "monthlyPurchaseVolume" && customs?.fobUsd != null
          ? "Yearly FOB ÷ 12"
          : f.id === "paymentDelay" && deal.buyer.avgPaymentDelayDays == null
            ? "Unmeasured — excluded"
            : f.id === "creditRating" && score == null
              ? "Needs Coface"
              : score == null
                ? "Blank"
                : `w${f.weight}`,
    };
  });

  const supplierFields: FieldRow[] = supplierResult.fields.map((f) => {
    const score = f.score ?? null;
    const customs = enrichedDeal.supplier.customsEnrichment;
    return {
      id: `supplier.${f.id}`,
      label: `Supplier · ${f.label}`,
      input:
        f.id === "yearsInBusiness"
          ? `${deal.supplier.yearsInBusiness ?? "—"} yrs (source ${record.supplierYibSource})`
          : f.id === "platformTransactionCount"
            ? `${deal.supplier.platformDealsCompleted} platform deals`
            : f.id === "frequencyOfDeals"
              ? customs?.shipments != null && customs.shipments > 0
                ? `${customs.shipments} customs shipments`
                : deal.supplier.platformDealsCompleted > 0
                  ? `${deal.supplier.platformDealsCompleted} platform deals`
                  : "blank — no shipment / platform deal count"
              : f.id === "onTimeDeliveryRate"
              ? `completion ${deal.supplier.platformCompletionRate ?? "—"}%`
              : f.id === "qualityRejectionRate"
                ? deal.supplier.qualityRejectionRatePct == null
                  ? "unmeasured"
                  : `${deal.supplier.qualityRejectionRatePct}%`
                : score == null
                  ? "blank"
                  : `score ${Math.round(score)}`,
      score,
      weight: f.weight,
      note:
        f.id === "qualityRejectionRate" &&
        deal.supplier.qualityRejectionRatePct == null
          ? "Unmeasured — excluded"
          : score == null
            ? "Blank"
            : `w${f.weight}`,
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
      note: score == null ? "Blank" : `w${f.weight}`,
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
      note: "Base",
    },
    {
      id: "priceVsMarket",
      label: "Price vs usual",
      input:
        price.usualUsdPerKg != null
          ? `$${fmtNum(price.dealUnitPriceUSD)}/kg vs $${fmtNum(price.usualUsdPerKg)}/kg (${price.deflatedPctOverUsual != null && price.deflatedPctOverUsual > 0 ? "+" : ""}${fmtNum(price.deflatedPctOverUsual, 1)}%)`
          : `$${fmtNum(price.dealUnitPriceUSD)}/kg · no benchmark`,
      score: price.pts,
      weight: 0,
      note: "−35…+20 on base 70",
    },
    {
      id: "offerUnit",
      label: "Offer unit (CSV)",
      input:
        deal.offerUnitPriceUSD != null
          ? `$${fmtNum(deal.offerUnitPriceUSD)}`
          : "—",
      score: null,
      weight: 0,
      note: "May be per carton",
    },
    {
      id: "shippingMonth",
      label: "Shipping start",
      input: deal.shippingStartDate ?? "—",
      score: null,
      weight: 0,
      note: "Price-table month",
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
      note: "Route key",
    },
    {
      id: "modeStops",
      label: "Mode / stops",
      input: `${deal.transportMode ?? "—"} · ${deal.numberOfTransshipments} stops · ${deal.estimatedTransitDays}d`,
      score: null,
      weight: 0,
      note: "Table row selector",
    },
    {
      id: "table",
      label: "Route table score",
      input: routeProfile
        ? `${routeProfile.score} · ${routeProfile.routeRiskFlag}${routeProfile.airStops != null ? ` · ${routeProfile.airStops} air stops` : ""}`
        : "No row → 70",
      score: routeProfile?.score ?? 70,
      weight: 0,
      note: routeProfile?.rationale ?? "No guess on miss",
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
      formula: `Composite ${Math.round(compositeA.score)} · buyer cov ${Math.round(buyerResult.coverageFraction * 100)}% · supplier cov ${Math.round(supplierResult.coverageFraction * 100)}%`,
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
        : `clamp(60 + collateral + payment + advance + insurance) = ${breakdown.structure}`,
      fields: structureFallbackFields(deal, riskReward),
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
    estimatedApyPct: breakdown.investorApyPct,
    riskReward,
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
