import type { FinancingRecommendation } from "../types";

/**
 * Extra APY for thin counterparty data, additive on top of the score-based
 * riskPremium below. Without this, a deal whose score got shrunk toward
 * neutral because most fields are blank prices identically to a deal that
 * genuinely earned the same score with a full profile — the uncertainty is
 * real risk to an investor and should show up as premium, not get absorbed
 * into a mid-pack score bucket. Buckets are a starting point, not calibrated
 * against realized outcomes (same caveat as every other constant in this
 * engine — see docs/counterparty-risk-scoring-method-outline-2026-07-30.md).
 */
/** Exported so investor-APY / scoring can share the same uncertainty buckets. */
export function uncertaintyPremiumFor(
  counterpartyCoveragePct: number | null,
): number {
  if (counterpartyCoveragePct == null) return 0;
  if (counterpartyCoveragePct >= 80) return 0;
  if (counterpartyCoveragePct >= 60) return 0.5;
  if (counterpartyCoveragePct >= 40) return 1.0;
  if (counterpartyCoveragePct >= 20) return 1.75;
  return 2.5;
}

export function recommendFinancingTerms(
  overall: number,
  dealValueUSD: number,
  counterpartyCoveragePct: number | null = null,
): FinancingRecommendation {
  let maxFinancingPct: number;
  if (overall >= 80) maxFinancingPct = 100;
  else if (overall >= 70) maxFinancingPct = 80;
  else if (overall >= 60) maxFinancingPct = 70;
  else if (overall >= 50) maxFinancingPct = 50;
  else maxFinancingPct = 0;

  let requiredAdvancePct: number;
  if (overall >= 75) requiredAdvancePct = 0;
  else if (overall >= 65) requiredAdvancePct = 10;
  else if (overall >= 55) requiredAdvancePct = 20;
  else requiredAdvancePct = 30;

  const baseRate = 6.0;
  let riskPremium: number;
  if (overall >= 80) riskPremium = 0.5;
  else if (overall >= 70) riskPremium = 1.5;
  else if (overall >= 60) riskPremium = 2.5;
  else if (overall >= 50) riskPremium = 4.0;
  else riskPremium = 6.0;
  const uncertaintyPremium = uncertaintyPremiumFor(counterpartyCoveragePct);

  let collateralRequired: string;
  if (overall >= 80) collateralRequired = "None";
  else if (overall >= 70)
    collateralRequired = "Optional (reduces rate by 0.5%)";
  else if (overall >= 60)
    collateralRequired = "Warehouse receipt OR buyer guarantee";
  else if (overall >= 50)
    collateralRequired = "Inventory pledge + insurance";
  else collateralRequired = "Full collateral (>100% deal value)";

  let decision: string;
  let approvalLevel: string;
  if (overall >= 75) {
    decision = "AUTO-APPROVE";
    approvalLevel = "Automated";
  } else if (overall >= 60) {
    decision = "MANUAL REVIEW";
    approvalLevel = "Credit Manager";
  } else if (overall >= 45) {
    decision = "SENIOR APPROVAL";
    approvalLevel = "Credit Director";
  } else {
    decision = "RECOMMEND REJECT";
    approvalLevel = "Executive Override Only";
  }

  return {
    maxFinancingAmount: dealValueUSD * (maxFinancingPct / 100),
    maxFinancingPct,
    requiredAdvanceAmount: dealValueUSD * (requiredAdvancePct / 100),
    requiredAdvancePct,
    interestRate: baseRate + riskPremium + uncertaintyPremium,
    baseRate,
    riskPremium,
    uncertaintyPremium,
    counterpartyCoveragePct,
    collateralRequired,
    decision,
    approvalLevel,
  };
}
