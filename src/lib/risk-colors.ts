import type { RiskTier } from "../types";

export interface TierColors {
  arc: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  bar: string;
}

export function getTierColors(tier: RiskTier): TierColors {
  switch (tier) {
    case "Low Risk":
      return {
        arc: "#0f9d6b",
        badge: "border-tm-primary bg-tm-primary/10 text-tm-primary-dark",
        badgeBg: "#0f9d6b20",
        badgeText: "#0b4732",
        bar: "bg-tm-primary",
      };
    case "Medium-Low Risk":
      return {
        arc: "#4ea4d9",
        badge: "border-tm-blue bg-tm-blue/10 text-tm-blue",
        badgeBg: "#4ea4d920",
        badgeText: "#2b7cb5",
        bar: "bg-tm-blue",
      };
    case "Medium-High Risk":
      return {
        arc: "#d9a93b",
        badge: "border-tm-accent bg-tm-accent/10 text-tm-accent-dark",
        badgeBg: "#d9a93b20",
        badgeText: "#b8893f",
        bar: "bg-tm-accent",
      };
    case "High Risk":
      return {
        arc: "#f25e6b",
        badge: "border-tm-danger bg-tm-danger/10 text-tm-danger-dark",
        badgeBg: "#f25e6b20",
        badgeText: "#d9486e",
        bar: "bg-tm-danger",
      };
    case "Veto":
      return {
        arc: "#8b1e2e",
        badge: "border-tm-danger-dark bg-tm-danger-dark/15 text-tm-danger-dark",
        badgeBg: "#8b1e2e20",
        badgeText: "#8b1e2e",
        bar: "bg-tm-danger-dark",
      };
  }
}

export function getScoreBarColor(score: number): string {
  if (score >= 75) return "bg-tm-primary";
  if (score >= 60) return "bg-tm-blue";
  if (score >= 45) return "bg-tm-accent";
  return "bg-tm-danger";
}

export function getDecisionStyle(decision: string): {
  className: string;
  icon: "check" | "eye" | "alert" | "x";
} {
  if (decision === "AUTO-APPROVE") {
    return { className: "bg-tm-primary/10 text-tm-primary-dark border-tm-primary", icon: "check" };
  }
  if (decision === "MANUAL REVIEW") {
    return { className: "bg-tm-blue/10 text-tm-blue border-tm-blue", icon: "eye" };
  }
  if (decision === "SENIOR APPROVAL") {
    return { className: "bg-tm-accent/10 text-tm-accent-dark border-tm-accent", icon: "alert" };
  }
  return { className: "bg-tm-danger/10 text-tm-danger-dark border-tm-danger", icon: "x" };
}

export function formatDecisionLabel(decision: string): string {
  switch (decision) {
    case "AUTO-APPROVE":
      return "Auto-approve";
    case "MANUAL REVIEW":
      return "Manual review";
    case "SENIOR APPROVAL":
      return "Senior approval";
    case "RECOMMEND REJECT":
      return "Recommend reject";
    default:
      return decision;
  }
}
