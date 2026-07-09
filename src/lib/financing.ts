import type { FinancingRecommendation } from "../types";

export function recommendFinancingTerms(
  overall: number,
  dealValueUSD: number,
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
    interestRate: baseRate + riskPremium,
    baseRate,
    riskPremium,
    collateralRequired,
    decision,
    approvalLevel,
  };
}
