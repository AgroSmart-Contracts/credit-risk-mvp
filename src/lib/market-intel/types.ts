/**
 * Mirrors the Python dataclasses in docs/market-intel-peru-2025-2026-07-10
 * (analysis.py: Benchmark/CounterpartyProfile/RouteIntelligence/PairHistory;
 * sunat_lookup.py: SunatRecord) field-for-field — corrected 2026-07-27 after
 * wiring the batch build pipeline surfaced excess-property errors against
 * the real `.as_dict()` output (the previous version of this file was a
 * hand-guessed subset, never checked against an actual live payload).
 */

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
  ubigeo: string | null;
  direccion: string | null;
  tipo: string | null;
  actividad_economica: string | null;
  fetched_at: string;
  source: string;
  error?: string | null;
  /** Not part of SunatRecord itself — stitched on by analysis.py's `_maybe_sunat()` from the separate CRAM points table. */
  d2_pts: number | null;
  d2_signal: string | null;
}

export interface MarketIntelCapacityCheck {
  deal_kg: number;
  baseline_monthly_kg: number;
  deal_vs_baseline_pct: number | null;
  peak_monthly_kg: number;
  deal_vs_peak_pct: number | null;
  flag: "WITHIN_CAPACITY" | "STRETCH" | "OVER_CAPACITY_FLAG" | "NO_BASELINE";
}

export interface MarketIntelPartnerShare {
  partner_id: string | null;
  partner_name: string | null;
  kg_net: number;
  share_pct: number;
}

export interface MarketIntelDestinationShare {
  destination_country: string;
  kg_net: number;
  share_pct: number;
}

export interface MarketIntelCounterpartyProfile {
  entity_id: string;
  entity_side: "exporter" | "importer";
  entity_name: string | null;
  destination_country: string | null;
  as_of: string;
  first_seen: string | null;
  last_seen: string | null;
  vintage_months: number | null;
  months_active_12mo: number;
  total_shipments: number;
  total_kg_net: number;
  total_fob_usd: number;
  avg_monthly_kg_last_6mo: number;
  avg_monthly_kg_last_12mo: number;
  peak_monthly_kg: number;
  peak_monthly_kg_month: string | null;
  wavg_usd_per_kg: number | null;
  peru_variety_share_pct: Record<string, number>;
  variety_mix: Array<{ variety: string; share_pct: number; wavg_usd_kg: number }>;
  top_partners: MarketIntelPartnerShare[];
  top_destinations: MarketIntelDestinationShare[] | null;
  price_positioning: Record<
    string,
    { entity_wavg_usd_kg: number; peru_wavg_usd_kg: number; variance_pct: number; position: string }
  >;
  corridor_positioning: Array<{
    variety: string;
    destination_country: string;
    n_shipments: number;
    entity_kg: number;
    entity_wavg_usd_kg: number;
    peru_wavg_usd_kg: number;
    corridor_kg_market: number;
    entity_share_of_corridor_pct: number;
    variance_pct: number;
    position: string;
  }>;
  activity_consistency: number | null;
  consecutive_month_streak: number;
  capacity_check: MarketIntelCapacityCheck | null;
  confidence: "HIGH" | "MED" | "LOW" | "NO_HISTORY";
  vintage_note: string | null;
  sunat: MarketIntelSunat | null;
  d2_years_in_business_pts: number | null;
  d2_years_in_business_signal: string | null;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelPriceBenchmark {
  variety: string;
  destination_country: string | null;
  deal_week: string;
  window_start: string;
  window_end: string;
  window_weeks: number;
  n_shipments: number;
  n_exporters: number;
  kg_shipped: number;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  confidence: string;
  fallback_note?: string | null;
  deal_price_usd_per_kg?: number | null;
  deal_vs_p50_pct: number | null;
  deal_vs_p50_band:
    | "WITHIN_BAND"
    | "OUTSIDE_BAND"
    | "OVER_MARKET_FLAG"
    | "UNDER_MARKET_FLAG"
    | "N/A"
    | null;
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelRouteIntelligence {
  variety: string;
  destination_country: string;
  period_label: string;
  n_shipments: number;
  n_exporters: number;
  n_importers: number;
  kg_net: number;
  fob_usd: number;
  lane_share_of_variety_pct: number;
  green_channel_pct: number | null;
  orange_channel_pct: number | null;
  red_channel_pct: number | null;
  transport_mode_mix: Record<string, number>;
  exporter_hhi: number;
  importer_hhi: number;
  top_exporters: Array<{ exporter_id: string; exporter_name: string | null; share_pct: number }>;
  top_importers: Array<{ importer_id: string; importer_name: string | null; share_pct: number }>;
  monthly_kg: Record<string, number>;
  peak_month: string | null;
  off_peak_month: string | null;
  peak_off_ratio: number | null;
  in_season_weeks: string[];
  lane_maturity: "DEEP" | "ESTABLISHED" | "THIN" | "SPARSE";
  deal_week: string | null;
  commercial_window_alignment: "IN_SEASON" | "SHOULDER" | "OFF_SEASON" | "NEEDS_INPUT" | null;
  route_signal_inferred: "LOW" | "MED" | "HIGH" | "INSUFFICIENT";
  route_signal_table: string | null;
  route_signal_driver: string | null;
  route_signal_pts: number | null;
  table_version: string | null;
  caveats: string[];
  status?: "NEEDS_INPUT";
  reason?: string;
}

export interface MarketIntelPairHistory {
  exporter_id: string;
  exporter_name: string | null;
  importer_id: string;
  importer_name: string | null;
  destination_country: string | null;
  as_of: string;
  first_shipment: string | null;
  last_shipment: string | null;
  months_since_last: number | null;
  n_prior_shipments: number;
  n_prior_last_12mo: number;
  months_active_together: number;
  cumulative_kg_net: number;
  cumulative_fob_usd: number;
  avg_ticket_kg: number | null;
  price_stability_cv: number | null;
  primary_variety: string | null;
  primary_destination: string | null;
  d3_indicative_pts: number;
  relationship_signal: "STRONG" | "MODERATE" | "WEAK" | "FIRST_TIME" | "DISCONTINUED";
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
