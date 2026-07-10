export interface MarketIntelMeta {
  generated_at: string;
  data_as_of: string;
  table_version: string;
  source_files: string[];
  engine_data_row_count: number;
}

export interface MarketIntelSunat {
  ruc: string;
  resolved: boolean;
  razon_social: string | null;
  estado: string | null;
  condicion: string | null;
  fecha_inscripcion: string | null;
  years_in_business: number | null;
  direccion: string | null;
  d2_pts: number | null;
  d2_signal: string | null;
  error?: string | null;
}

export interface MarketIntelCapacityCheck {
  deal_kg: number;
  baseline_monthly_kg: number;
  deal_vs_baseline_pct: number | null;
  peak_monthly_kg: number;
  deal_vs_peak_pct: number | null;
  flag: "WITHIN_CAPACITY" | "STRETCH" | "OVER_CAPACITY_FLAG" | "NO_BASELINE";
}

export interface MarketIntelCounterpartyProfile {
  entity_id: string;
  entity_side: "exporter" | "importer";
  entity_name: string | null;
  confidence: "HIGH" | "MED" | "LOW" | "NO_HISTORY";
  months_active_12mo: number;
  total_shipments: number;
  activity_consistency: number | null;
  capacity_check: MarketIntelCapacityCheck | null;
  sunat: MarketIntelSunat | null;
  d2_years_in_business_pts: number | null;
  d2_years_in_business_signal: string | null;
  top_partners?: Array<{ partner_name: string; share_pct: number }>;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelPriceBenchmark {
  deal_vs_p50_band:
    | "WITHIN_BAND"
    | "OUTSIDE_BAND"
    | "OVER_MARKET_FLAG"
    | "UNDER_MARKET_FLAG"
    | "N/A"
    | null;
  deal_vs_p50_pct: number | null;
  p50: number | null;
  deal_price_usd_per_kg: number | null;
  confidence: string;
  fallback_note?: string | null;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelRouteIntelligence {
  route_signal_table: string | null;
  route_signal_driver: string | null;
  route_signal_pts: number | null;
  lane_maturity: string | null;
  commercial_window_alignment: string | null;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelPairHistory {
  n_prior_shipments: number;
  d3_indicative_pts: number;
  relationship_signal: string;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelPayload {
  meta: MarketIntelMeta;
  deal_inputs: Record<string, unknown>;
  dim_a_supplier: MarketIntelCounterpartyProfile;
  dim_a_buyer: MarketIntelCounterpartyProfile | { status: "NEEDS_INPUT"; reason?: string };
  dim_b_price_benchmark: MarketIntelPriceBenchmark | { status: "NEEDS_INPUT"; reason?: string };
  dim_c_route_intelligence: MarketIntelRouteIntelligence | { status: "NEEDS_INPUT"; reason?: string };
  dim_d3_pair_history: MarketIntelPairHistory | { status: "NEEDS_INPUT"; reason?: string };
}

export interface MarketIntelRateRequest {
  exporterRuc: string;
  importerName?: string;
  destinationCountry?: string;
  variety?: string;
  dealWeek?: string;
  dealKg?: number;
  dealPriceUsdPerKg?: number;
}

export interface MarketIntelRateResponse {
  ok: boolean;
  payload?: MarketIntelPayload;
  error?: string;
  unavailable?: boolean;
}
