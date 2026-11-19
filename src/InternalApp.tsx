import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deals as sampleDeals } from "./data/deals";
import {
  platformCounterparties,
  platformDealsBlocked,
} from "./data/platform-deals";
import {
  prescoredByDealId,
  prescoredByMongoId,
  prescoredPlatformDeals,
} from "./data/prescored-deals";
import { buildRiskAssessment } from "./lib/assessment";
import { createBlankDeal } from "./lib/deal-builder";
import { recommendFinancingTerms } from "./lib/financing";
import type { Deal, FinancingRecommendation, RiskAssessment, Step } from "./types";
import type { TransactionStructureInput } from "./lib/transaction-structure/types";
import type { AppView } from "./types/platform";
import { AppNav } from "./components/AppNav";
import { TopBar } from "./components/Sidebar";
import { HIDDEN_APP_TABS } from "./components/app-tabs";
import { StepIndicator } from "./components/StepIndicator";
import { DealSelector } from "./components/DealSelector";
import { DocumentIngestion } from "./components/DocumentIngestion";
import { RiskDashboard } from "./components/RiskDashboard";
import { FinancingRecommendationPanel } from "./components/FinancingRecommendation";
import { CounterpartyScoresTab } from "./components/CounterpartyScoresTab";
import { PrescoredDealsTab } from "./components/PrescoredDealsTab";
import { DealMissingFieldsTab } from "./components/DealMissingFieldsTab";
import { RouteRiskTableTab } from "./components/RouteRiskTableTab";
import { BlueberryCramAnalysisTab } from "./components/BlueberryCramAnalysisTab";

const VIEW_TITLE: Record<AppView, { title: string; sub: string }> = {
  assess: { title: "Credit Risk Assessment", sub: "Score a trade-finance deal from its documents" },
  "pre-harvest": { title: "Pre-harvest loans", sub: "Crop-stage financing · satellite, weather and market monitoring" },
  counterparties: { title: "Counterparty scores", sub: "Scored platform counterparties" },
  platform: { title: "Platform deals", sub: "Pre-scored TruMarket deals" },
  missing: { title: "Missing fields", sub: "Data gaps per deal" },
  "route-table": { title: "Route risk", sub: "Origin–destination risk table" },
  "blueberry-cram": { title: "Blueberry CRAM", sub: "Blueberry credit risk analysis" },
};

/**
 * The internal TruMarket credit-risk tools (deal assessment, platform deals,
 * CRAM analysis). Loaded on demand inside the app shell, so opening the bank's
 * pre-harvest workspace never parses this code or its data.
 */
export default function InternalApp({ view, onView, onPlatformCount }: { view: AppView; onView: (v: AppView) => void; onPlatformCount: (n: number) => void }) {
  const setView = onView;
  useEffect(() => {
    onPlatformCount(prescoredPlatformDeals.length);
  }, [onPlatformCount]);
  const [step, setStep] = useState<Step>(1);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [financing, setFinancing] = useState<FinancingRecommendation | null>(
    null,
  );

  const missingDealCount =
    prescoredPlatformDeals.filter(
      (e) => e.deal.fieldsNeedingConfirmation.length > 0,
    ).length + platformDealsBlocked.length;

  const openPrescored = (dealId: string) => {
    const entry = prescoredByDealId.get(dealId);
    if (!entry) return;
    setSelectedDeal(entry.deal);
    setAssessment(entry.assessment);
    setFinancing(entry.financing);
    setView("assess");
    setStep(3);
  };

  const handleSelectDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setAssessment(null);
    setFinancing(null);
    setView("assess");
    setStep(2);
  };

  const handleCreateDeal = () => {
    setSelectedDeal(createBlankDeal());
    setAssessment(null);
    setFinancing(null);
    setView("assess");
    setStep(2);
  };

  const handleRunAssessment = (dealToAssess: Deal, stayOnFinancing = false) => {
    setSelectedDeal(dealToAssess);
    const result = buildRiskAssessment(dealToAssess);
    const terms = recommendFinancingTerms(
      result.overall,
      dealToAssess.dealValueUSD,
      result.counterpartyCoveragePct,
    );
    setAssessment(result);
    setFinancing(terms);
    setView("assess");
    setStep(stayOnFinancing ? 4 : 3);
  };

  const handleApplyStructure = (structure: TransactionStructureInput) => {
    if (!selectedDeal) return;
    // Re-score but keep the financing page open so what-if Apply updates live.
    handleRunAssessment({ ...selectedDeal, transactionStructure: structure }, true);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedDeal(null);
    setAssessment(null);
    setFinancing(null);
  };

  const openByMongoId = (mongoId: string) => {
    const entry = prescoredByMongoId.get(mongoId);
    if (entry) {
      openPrescored(entry.deal.id);
    }
  };

  const handleViewChange = (next: AppView) => {
    // Hidden nav tabs stay in code but are not selectable.
    if (HIDDEN_APP_TABS.has(next)) return;
    setView(next);
    if (next === "assess" && !selectedDeal) {
      setStep(1);
    }
  };

  const backFromRiskDashboard = () => {
    if (selectedDeal && prescoredByDealId.has(selectedDeal.id)) {
      setView("platform");
      setStep(1);
      setSelectedDeal(null);
      setAssessment(null);
      setFinancing(null);
      return;
    }
    setStep(2);
  };

  return (
    <>
      <TopBar
        title={VIEW_TITLE[view].title}
        sub={VIEW_TITLE[view].sub}
        right={<span className="hidden shrink-0 text-xs text-tm-text-muted sm:block">TruMarket · Credit risk</span>}
      />

      <AppNav
        view={view}
        onChange={handleViewChange}
        scoredCount={platformCounterparties.length}
        platformCount={prescoredPlatformDeals.length}
        missingCount={missingDealCount}
      />

      {view === "assess" && <StepIndicator currentStep={step} />}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-8">
        <AnimatePresence mode="wait">
          {view === "counterparties" && (
            <motion.div
              key="counterparties"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <CounterpartyScoresTab
                onAssessDealId={openByMongoId}
                onGoToMissingFields={() => setView("missing")}
              />
            </motion.div>
          )}

          {view === "platform" && (
            <motion.div
              key="platform"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <PrescoredDealsTab onSelect={openPrescored} />
            </motion.div>
          )}

          {view === "missing" && (
            <motion.div
              key="missing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <DealMissingFieldsTab onViewDeal={openPrescored} />
            </motion.div>
          )}

          {view === "route-table" && (
            <motion.div
              key="route-table"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <RouteRiskTableTab />
            </motion.div>
          )}

          {view === "blueberry-cram" && (
            <motion.div
              key="blueberry-cram"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <BlueberryCramAnalysisTab />
            </motion.div>
          )}

          {view === "assess" && step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-3xl"
            >
              <DealSelector
                deals={sampleDeals}
                onSelect={handleSelectDeal}
                onCreateNew={handleCreateDeal}
              />
            </motion.div>
          )}

          {view === "assess" && step === 2 && selectedDeal && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-3xl"
            >
              <DocumentIngestion
                deal={selectedDeal}
                onBack={handleReset}
                onRunAssessment={handleRunAssessment}
              />
            </motion.div>
          )}

          {view === "assess" && step === 3 && selectedDeal && assessment && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-3xl"
            >
              <RiskDashboard
                deal={selectedDeal}
                assessment={assessment}
                onBack={backFromRiskDashboard}
                onContinue={() => setStep(4)}
              />
            </motion.div>
          )}

          {view === "assess" &&
            step === 4 &&
            selectedDeal &&
            assessment &&
            financing && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="mx-auto max-w-5xl"
              >
                <FinancingRecommendationPanel
                  deal={selectedDeal}
                  assessment={assessment}
                  financing={financing}
                  onBack={() => setStep(3)}
                  onAssessAnother={handleReset}
                  onApplyStructure={handleApplyStructure}
                />
              </motion.div>
            )}
        </AnimatePresence>
      </main>

      <footer className={`border-t border-tm-border py-6 text-center text-xs text-tm-text-muted print:hidden`}>
        TruMarket agro trade-finance credit scoring · CRAM data from
        platform CSV enrichment (does not mutate live TruMarket schemas)
      </footer>
    </>
  );
}
