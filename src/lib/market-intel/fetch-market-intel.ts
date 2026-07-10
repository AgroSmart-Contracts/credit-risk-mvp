import type { Deal } from "../../types";
import { buildMarketIntelRequest } from "./deal-params";
import type { MarketIntelPayload, MarketIntelRateResponse } from "./types";

export async function fetchMarketIntelForDeal(
  deal: Deal,
): Promise<MarketIntelPayload | null> {
  const request = buildMarketIntelRequest(deal);
  if (!request) return null;

  try {
    const res = await fetch("/api/market-intel-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      console.warn("[market-intel] HTTP", res.status);
      return null;
    }

    const data = (await res.json()) as MarketIntelRateResponse;
    if (!data.ok || !data.payload) {
      if (data.unavailable) {
        console.warn("[market-intel] engine unavailable:", data.error);
      }
      return null;
    }

    return data.payload;
  } catch (err) {
    console.warn("[market-intel] fetch failed", err);
    return null;
  }
}

export function attachMarketIntel(deal: Deal, payload: MarketIntelPayload | null): Deal {
  if (!payload) return deal;
  return {
    ...deal,
    marketIntel: payload,
    supplierRuc: deal.supplierRuc ?? (payload.deal_inputs.exporter_ruc as string | undefined),
  };
}
