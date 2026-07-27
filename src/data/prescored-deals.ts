import { platformDealsReadyForCounterparty } from "./platform-deals";
import { buildRiskAssessment } from "../lib/assessment";
import { recommendFinancingTerms } from "../lib/financing";
import { platformDealToDeal } from "../lib/platform-deal-mapper";
import type { Deal, FinancingRecommendation, RiskAssessment } from "../types";

/** Platform CSV deals with CRAM already run — selectable like the fixed sample deals. */
export interface PrescoredDeal {
  deal: Deal;
  assessment: RiskAssessment;
  financing: FinancingRecommendation;
  mongoId: string;
  source: "platform";
}

function buildPrescored(deal: Deal, mongoId: string): PrescoredDeal {
  const assessment = buildRiskAssessment(deal);
  const financing = recommendFinancingTerms(assessment.overall, deal.dealValueUSD);
  return { deal, assessment, financing, mongoId, source: "platform" };
}

export const prescoredPlatformDeals: PrescoredDeal[] =
  platformDealsReadyForCounterparty.map((record) =>
    buildPrescored(platformDealToDeal(record), record.mongoId),
  );

export const prescoredByDealId = new Map(
  prescoredPlatformDeals.map((entry) => [entry.deal.id, entry]),
);

export const prescoredByMongoId = new Map(
  prescoredPlatformDeals.map((entry) => [entry.mongoId, entry]),
);

export const prescoredDealList: Deal[] = prescoredPlatformDeals.map(
  (entry) => entry.deal,
);
