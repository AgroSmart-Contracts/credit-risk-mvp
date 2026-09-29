/**
 * Investment-decision summary for blueberry (and other) deals.
 *
 * Uses the transaction-structure cash-flow engine (same KPIs as the Structure
 * analysis sandbox: capital need, at-risk after 1st collection, margin, max
 * loss) plus financing APY — so ops/investors see whether a weak CRAM/structure
 * score is still fundable because buyer first payment collapses residual risk.
 */
import type { Deal, FinancingRecommendation, RiskTier } from "../types";
import {
  expectedInvestorReturnUsd,
  investorApyPct,
} from "./investor-apy";
import {
  buildTransactionStructureReport,
  structureForDeal,
} from "./transaction-structure/compute";
import type { TransactionStructureReport } from "./transaction-structure/types";

export type RiskRewardBand =
  | "high-risk / high-reward"
  | "high-risk / moderate-reward"
  | "balanced"
  | "low-risk / moderate-reward"
  | "low-risk / low-reward";

/** Straight investment call for ops / capital partners. */
export type InvestmentCall =
  | "fund"
  | "fund-with-conditions"
  | "restructure"
  | "decline";

export interface StructureInvestmentSummary {
  call: InvestmentCall;
  callLabel: string;
  /** One sentence for the card header. */
  oneLiner: string;
  /** 3–5 bullets: why fund / why not / what to require. */
  bullets: string[];
  band: RiskRewardBand;
  riskLevel: "high" | "medium" | "low";
  rewardLevel: "high" | "medium" | "low";
  justifiesHighRisk: boolean;

  marginUsd: number;
  capitalNeedUsd: number;
  atRiskAfterFirstUsd: number;
  /** Buyer first payment ÷ capital need × 100. */
  buyerFirstCoversCapitalPct: number;
  buyerFirstAmountUsd: number;
  maxLossOnDefaultUsd: number;
  upsideDownsideRatio: number | null;
  exposureDays: number;
  structureComposite: number;
  structureTier: string;
  structureProtocol: string;
  isDefaultStructure: boolean;

  investorApyPct: number;
  expectedInvestorReturnUsd2m: number;
  financedAmountUsd: number;
  advancePaymentPct: number;
  advancePaymentUsd: number;
  /** Financing-engine policy advance (score-based). */
  recommendedAdvancePct: number;
  recommendedAdvanceUsd: number;
  /**
   * Buyer advance needed to cover residual loss (at-risk after 1st / max loss
   * on default). Posts this → downside ≈ $0 → low-risk / high-return framing
   * even when CRAM score is weak.
   */
  lossCoverAdvanceUsd: number;
  lossCoverAdvancePct: number;
  /** Shortfall vs loss-cover advance still needed from the buyer. */
  lossCoverAdvanceShortfallUsd: number;
  /** True when recorded advance already covers max residual loss. */
  lossCoverAlreadyMet: boolean;
  residualRiskScore: number;

  /** @deprecated use oneLiner */
  headline: string;
  /** @deprecated use bullets.join */
  detail: string;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(Math.round(n));
  const s = abs.toLocaleString("en-US");
  return n < 0 ? `-$${s}` : `$${s}`;
}

function riskLevelFrom(
  overall: number,
  vetoed: boolean,
  tier: RiskTier,
  structureComposite: number,
): "high" | "medium" | "low" {
  if (
    vetoed ||
    overall < 55 ||
    tier === "High Risk" ||
    tier === "Veto" ||
    structureComposite < 55
  ) {
    return "high";
  }
  if (overall < 70 || structureComposite < 70 || tier === "Medium-High Risk") {
    return "medium";
  }
  return "low";
}

function rewardLevelFrom(
  apyPct: number,
  marginUsd: number,
  capitalNeedUsd: number,
): "high" | "medium" | "low" {
  const marginOnCapital =
    capitalNeedUsd > 0 ? marginUsd / capitalNeedUsd : 0;
  if (apyPct >= 12 || marginOnCapital >= 0.15) return "high";
  if (apyPct >= 8 || marginOnCapital >= 0.08) return "medium";
  return "low";
}

function bandFor(
  risk: "high" | "medium" | "low",
  reward: "high" | "medium" | "low",
): RiskRewardBand {
  if (risk === "high" && reward === "high") return "high-risk / high-reward";
  if (risk === "high") return "high-risk / moderate-reward";
  if (risk === "low" && reward === "low") return "low-risk / low-reward";
  if (risk === "low") return "low-risk / moderate-reward";
  return "balanced";
}

function decideCall(args: {
  vetoed: boolean;
  marginUsd: number;
  capitalNeedUsd: number;
  atRiskAfterFirstUsd: number;
  buyerFirstCoversCapitalPct: number;
  upsideDownsideRatio: number | null;
  structureComposite: number;
  overall: number;
}): InvestmentCall {
  const {
    vetoed,
    marginUsd,
    capitalNeedUsd,
    atRiskAfterFirstUsd,
    buyerFirstCoversCapitalPct,
    upsideDownsideRatio,
    structureComposite,
    overall,
  } = args;

  if (marginUsd <= 0 || capitalNeedUsd <= 0) return "decline";

  const residualShare =
    capitalNeedUsd > 0 ? atRiskAfterFirstUsd / capitalNeedUsd : 1;
  const firstPaymentStrong = buyerFirstCoversCapitalPct >= 70;
  const residualTight = residualShare <= 0.25;
  const upsideOk =
    upsideDownsideRatio == null || upsideDownsideRatio >= 0.7;

  // Strong cash structure can still fund even when CRAM/structure score is weak.
  if (firstPaymentStrong && residualTight && marginUsd > 0 && upsideOk) {
    if (vetoed || structureComposite < 60 || overall < 60) {
      return "fund-with-conditions";
    }
    return "fund";
  }

  if (buyerFirstCoversCapitalPct >= 50 && marginUsd > atRiskAfterFirstUsd * 0.5) {
    return "fund-with-conditions";
  }

  if (residualShare > 0.5 || !upsideOk || structureComposite < 45) {
    return "restructure";
  }

  return "fund-with-conditions";
}

const CALL_LABEL: Record<InvestmentCall, string> = {
  fund: "Fund",
  "fund-with-conditions": "Fund with conditions",
  restructure: "Restructure before funding",
  decline: "Decline",
};

/**
 * Build the investment summary from deal + financing, running the default
 * (or attached) transaction-structure cash-flow model.
 */
export function computeRiskReward(args: {
  deal: Deal;
  overall: number;
  tier: RiskTier;
  vetoed: boolean;
  financing: FinancingRecommendation;
  tenorMonths?: number;
  /** Optional prebuilt report (tests / what-if). */
  structureReport?: TransactionStructureReport;
}): StructureInvestmentSummary {
  const tenorMonths = args.tenorMonths ?? 2;
  const { deal, financing, overall, tier, vetoed } = args;

  const structureInput = structureForDeal(deal);
  const report =
    args.structureReport ??
    buildTransactionStructureReport(
      structureInput,
      deal.dealValueUSD,
      deal.advancePaymentPct,
      deal.contractType,
    );

  const { kpis, score } = report;
  const capitalNeedUsd = kpis.capitalNeed;
  const marginUsd = kpis.margin;
  const atRiskAfterFirstUsd = kpis.exposureAfterFirstCollection;
  const buyerFirstAmountUsd = score.cashFlow.buyerFirstAmount;
  const buyerFirstCoversCapitalPct =
    capitalNeedUsd > 0
      ? Math.round((buyerFirstAmountUsd / capitalNeedUsd) * 1000) / 10
      : 0;
  const maxLossOnDefaultUsd = kpis.maxLossOnDefault;
  const upsideDownsideRatio = score.cashFlow.upsideDownsideRatio;

  // LP-facing APY in 10–18% band (not financing.interestRate / not 8% platform fee).
  const apy = investorApyPct(overall, financing.uncertaintyPremium);
  const advancePct = Math.max(0, deal.advancePaymentPct || 0);
  const recommendedAdvancePct = financing.requiredAdvancePct;
  const advanceUsd = (deal.dealValueUSD * advancePct) / 100;
  const recommendedAdvanceUsd =
    (deal.dealValueUSD * recommendedAdvancePct) / 100;
  const financedAmountUsd = financing.maxFinancingAmount;
  const expectedInvestorReturnUsd2m = expectedInvestorReturnUsd(
    financedAmountUsd,
    apy,
    tenorMonths,
  );

  // Advance that zeros residual loss: cover whatever is still at risk after
  // the buyer’s first collection (same as max loss if final tranche defaults).
  const residualLossUsd = Math.max(
    atRiskAfterFirstUsd,
    Math.abs(Math.min(0, maxLossOnDefaultUsd)),
  );
  const lossCoverAdvanceUsd = Math.round(residualLossUsd);
  const lossCoverAdvancePct =
    deal.dealValueUSD > 0
      ? Math.round((lossCoverAdvanceUsd / deal.dealValueUSD) * 1000) / 10
      : 0;
  const lossCoverAdvanceShortfallUsd = Math.max(
    0,
    Math.round(lossCoverAdvanceUsd - advanceUsd),
  );
  const lossCoverAlreadyMet = lossCoverAdvanceShortfallUsd <= 0;

  const risk = riskLevelFrom(overall, vetoed, tier, score.composite);
  const reward = rewardLevelFrom(apy, marginUsd, capitalNeedUsd);
  const band = bandFor(risk, reward);

  // Residual risk: share of capital still exposed after buyer first payment,
  // scaled 0–100, with veto floor.
  let residual = Math.round(
    Math.min(100, Math.max(0, (atRiskAfterFirstUsd / Math.max(capitalNeedUsd, 1)) * 100)),
  );
  if (vetoed) residual = Math.max(residual, 40);

  const call = decideCall({
    vetoed,
    marginUsd,
    capitalNeedUsd,
    atRiskAfterFirstUsd,
    buyerFirstCoversCapitalPct,
    upsideDownsideRatio,
    structureComposite: score.composite,
    overall,
  });

  const justifiesHighRisk =
    risk === "high" &&
    (call === "fund" || call === "fund-with-conditions") &&
    buyerFirstCoversCapitalPct >= 70;

  const oneLiner =
    call === "fund"
      ? `Fundable — after buyer 1st, only ${fmtUsd(atRiskAfterFirstUsd)} at risk.`
      : call === "fund-with-conditions"
        ? `Structure OK (${Math.round(score.composite)}/100); residual after 1st is ${fmtUsd(atRiskAfterFirstUsd)}.`
        : call === "restructure"
          ? `Too much still at risk after 1st (${fmtUsd(atRiskAfterFirstUsd)} of ${fmtUsd(capitalNeedUsd)}).`
          : `Not fundable — margin ${fmtUsd(marginUsd)}.`;

  // Actions only — KPIs live in the summary cards (avoid repeating numbers).
  const bullets: string[] = [];

  if (vetoed) {
    bullets.push("Clear veto items (e.g. cargo insurance) before funding.");
  }

  if (!lossCoverAlreadyMet && lossCoverAdvanceUsd > 0) {
    bullets.push(
      `Require buyer advance ${fmtUsd(lossCoverAdvanceUsd)} (${lossCoverAdvancePct}% of deal) to cover residual loss.`,
    );
  }

  if (call === "fund-with-conditions" && !vetoed) {
    bullets.push("Keep buyer 1st payment path strong; confirm collection calendar.");
  } else if (call === "restructure") {
    bullets.push(
      "Raise buyer advance, push supplier final later, or add collateral/insurance.",
    );
  }

  if (structureInput.structureSource === "default") {
    bullets.push(
      "Payment schedule is illustrative — replace with real dates before funding.",
    );
  }

  const detail = bullets.join(" ");

  return {
    call,
    callLabel: CALL_LABEL[call],
    oneLiner,
    bullets,
    band,
    riskLevel: risk,
    rewardLevel: reward,
    justifiesHighRisk,
    marginUsd,
    capitalNeedUsd,
    atRiskAfterFirstUsd,
    buyerFirstCoversCapitalPct,
    buyerFirstAmountUsd,
    maxLossOnDefaultUsd,
    upsideDownsideRatio,
    exposureDays: score.exposureDuration,
    structureComposite: score.composite,
    structureTier: score.tier,
    structureProtocol: score.protocol,
    isDefaultStructure: structureInput.structureSource === "default",
    investorApyPct: apy,
    expectedInvestorReturnUsd2m,
    financedAmountUsd,
    advancePaymentPct: advancePct,
    advancePaymentUsd: advanceUsd,
    recommendedAdvancePct,
    recommendedAdvanceUsd,
    lossCoverAdvanceUsd,
    lossCoverAdvancePct,
    lossCoverAdvanceShortfallUsd,
    lossCoverAlreadyMet,
    residualRiskScore: residual,
    headline: oneLiner,
    detail,
  };
}

/** @deprecated alias — same as StructureInvestmentSummary */
export type RiskRewardSummary = StructureInvestmentSummary;
