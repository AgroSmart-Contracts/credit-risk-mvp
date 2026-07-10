import type { Deal } from "../../types";
import type {
  MarketIntelCounterpartyProfile,
  MarketIntelPriceBenchmark,
} from "./types";

function isNeedsInput(
  block: { status?: string; confidence?: string } | null | undefined,
): boolean {
  if (!block) return true;
  if (block.status === "NEEDS_INPUT") return true;
  if ("confidence" in block && block.confidence === "NO_HISTORY") return true;
  return false;
}

function supplierCompletionFromActivity(monthsActive: number): number {
  const pct = (monthsActive / 12) * 100;
  return Math.min(30, pct * 0.3);
}

function capacityToQualityPts(
  flag: string | undefined,
): number {
  switch (flag) {
    case "WITHIN_CAPACITY":
      return 18;
    case "STRETCH":
      return 10;
    case "OVER_CAPACITY_FLAG":
      return 0;
    default:
      return 5;
  }
}

function sunatYearsToMvpYears(years: number | null | undefined): number | null {
  if (years == null || !Number.isFinite(years)) return null;
  const y = Math.floor(years);
  if (y <= 5) return 10;
  if (y <= 10) return 20;
  if (y <= 20) return 30;
  return 30;
}

function d2PtsToMvpYears(d2Pts: number | null | undefined): number | null {
  if (d2Pts == null) return null;
  if (d2Pts >= 15) return 30;
  if (d2Pts >= 10) return 20;
  if (d2Pts >= 5) return 10;
  if (d2Pts < 0) return 10;
  return 12;
}

export interface MarketIntelSupplierBreakdown {
  yearsPts: number;
  licensePts: number;
  activityPts: number;
  capacityPts: number;
  yearsLabel: string;
  licenseLabel: string;
  activityLabel: string;
  capacityLabel: string;
  source: "market-intel";
}

export function marketIntelSupplierBreakdown(
  deal: Deal,
): MarketIntelSupplierBreakdown | null {
  const intel = deal.marketIntel;
  if (!intel || isNeedsInput(intel.dim_a_supplier)) return null;

  const sup = intel.dim_a_supplier as MarketIntelCounterpartyProfile;

  let yearsPts = 12;
  let yearsLabel = "Not disclosed";
  if (sup.sunat?.years_in_business != null) {
    yearsPts = sunatYearsToMvpYears(sup.sunat.years_in_business) ?? 12;
    yearsLabel = `${sup.sunat.years_in_business.toFixed(1)}y (SUNAT)`;
  } else if (sup.d2_years_in_business_pts != null) {
    yearsPts = d2PtsToMvpYears(sup.d2_years_in_business_pts) ?? 12;
    yearsLabel = `CRAM d2 ${sup.d2_years_in_business_signal ?? ""}`.trim();
  } else if (sup.months_active_12mo > 0) {
    yearsLabel = `${sup.months_active_12mo}/12 mo active (customs)`;
  }

  let licensePts = 15;
  let licenseLabel = "Valid (default)";
  const sunat = sup.sunat;
  if (sunat?.resolved) {
    const estadoOk = !sunat.estado || sunat.estado === "ACTIVO";
    const condicionOk = !sunat.condicion || sunat.condicion === "HABIDO";
    licensePts = estadoOk && condicionOk ? 15 : 0;
    licenseLabel =
      licensePts > 0
        ? `SUNAT ${sunat.estado ?? "—"} / ${sunat.condicion ?? "—"}`
        : `SUNAT flag — ${sunat.estado ?? ""} ${sunat.condicion ?? ""}`.trim();
  }

  const activityPts = supplierCompletionFromActivity(sup.months_active_12mo);
  const activityLabel = `${sup.months_active_12mo}/12 months active (${sup.confidence} confidence)`;

  const capacityPts = capacityToQualityPts(sup.capacity_check?.flag);
  const capacityLabel = sup.capacity_check
    ? `${sup.capacity_check.flag} — ${sup.capacity_check.deal_vs_baseline_pct ?? "?"}% of monthly baseline`
    : "No capacity check";

  return {
    yearsPts,
    licensePts,
    activityPts,
    capacityPts,
    yearsLabel,
    licenseLabel,
    activityLabel,
    capacityLabel,
    source: "market-intel",
  };
}

export interface MarketIntelBuyerBreakdown {
  yearsPts: number;
  licensePts: number;
  activityPts: number;
  paymentPts: number;
  yearsLabel: string;
  licenseLabel: string;
  activityLabel: string;
  paymentLabel: string;
}

export function marketIntelBuyerBreakdown(
  deal: Deal,
): MarketIntelBuyerBreakdown | null {
  const intel = deal.marketIntel;
  if (!intel || isNeedsInput(intel.dim_a_buyer as MarketIntelCounterpartyProfile)) {
    return null;
  }

  const buyer = intel.dim_a_buyer as MarketIntelCounterpartyProfile;

  let yearsPts = 12;
  let yearsLabel = "Not disclosed";
  if (buyer.sunat?.years_in_business != null) {
    yearsPts = sunatYearsToMvpYears(buyer.sunat.years_in_business) ?? 12;
    yearsLabel = `${buyer.sunat.years_in_business.toFixed(1)}y`;
  }

  const licensePts = 15;
  const licenseLabel = "Valid (default)";
  const activityPts = supplierCompletionFromActivity(buyer.months_active_12mo) * 0.8;
  const activityLabel = `${buyer.months_active_12mo}/12 mo import activity`;
  const paymentPts = 4;
  const paymentLabel = "Customs activity proxy";

  return {
    yearsPts,
    licensePts,
    activityPts,
    paymentPts,
    yearsLabel,
    licenseLabel,
    activityLabel,
    paymentLabel,
  };
}

export function marketIntelRelationshipPts(deal: Deal): {
  pts: number;
  label: string;
} | null {
  const intel = deal.marketIntel;
  if (!intel) return null;
  const pair = intel.dim_d3_pair_history;
  if (pair.status === "NEEDS_INPUT" || pair.d3_indicative_pts == null) {
    return null;
  }
  return {
    pts: pair.d3_indicative_pts,
    label: `${pair.relationship_signal} — ${pair.n_prior_shipments} prior customs shipments`,
  };
}

export function marketIntelRoutePts(deal: Deal): {
  pts: number;
  label: string;
} | null {
  const intel = deal.marketIntel;
  if (!intel) return null;
  const route = intel.dim_c_route_intelligence;
  if (route.status === "NEEDS_INPUT" || route.route_signal_pts == null) {
    return null;
  }
  return {
    pts: route.route_signal_pts,
    label: `${route.route_signal_table ?? "—"} (${route.route_signal_driver ?? "table"})`,
  };
}

export function marketIntelPriceBenchmarkAdj(deal: Deal): {
  pts: number;
  label: string;
} | null {
  const intel = deal.marketIntel;
  if (!intel) return null;
  const bench = intel.dim_b_price_benchmark as MarketIntelPriceBenchmark;
  if (bench.status === "NEEDS_INPUT" || !bench.deal_vs_p50_band) return null;

  switch (bench.deal_vs_p50_band) {
    case "OVER_MARKET_FLAG":
      return {
        pts: -12,
        label: `OVER_MARKET +${bench.deal_vs_p50_pct ?? "?"}% vs P50`,
      };
    case "UNDER_MARKET_FLAG":
      return {
        pts: -10,
        label: `UNDER_MARKET ${bench.deal_vs_p50_pct ?? "?"}% vs P50`,
      };
    case "OUTSIDE_BAND":
      return {
        pts: -5,
        label: `Outside band ${bench.deal_vs_p50_pct ?? "?"}% vs P50`,
      };
    case "WITHIN_BAND":
      return {
        pts: 3,
        label: `Within market band (${bench.deal_vs_p50_pct ?? "?"}% vs P50)`,
      };
    default:
      return null;
  }
}

export function marketIntelSupplierConcentrationConcern(deal: Deal): string | null {
  const intel = deal.marketIntel;
  if (!intel || isNeedsInput(intel.dim_a_supplier)) return null;
  const top = intel.dim_a_supplier.top_partners?.[0];
  if (top && top.share_pct >= 50) {
    return `Supplier ${top.share_pct}% volume to ${top.partner_name}`;
  }
  return null;
}
