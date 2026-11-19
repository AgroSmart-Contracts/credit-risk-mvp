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

/**
 * Scored on first read, not on import: the internal tool opens without running
 * the CRAM model over every platform deal; a deal is scored when a screen needs
 * its assessment (and the result is kept).
 */
class LazyPrescored implements PrescoredDeal {
  readonly source = "platform" as const;
  private a?: RiskAssessment;
  private f?: FinancingRecommendation;
  readonly deal: Deal;
  readonly mongoId: string;
  constructor(deal: Deal, mongoId: string) {
    this.deal = deal;
    this.mongoId = mongoId;
  }
  get assessment(): RiskAssessment {
    return (this.a ??= buildRiskAssessment(this.deal));
  }
  get financing(): FinancingRecommendation {
    return (this.f ??= recommendFinancingTerms(this.assessment.overall, this.deal.dealValueUSD, this.assessment.counterpartyCoveragePct));
  }
}

export const prescoredPlatformDeals: PrescoredDeal[] = platformDealsReadyForCounterparty.map(
  (record) => new LazyPrescored(platformDealToDeal(record), record.mongoId),
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
