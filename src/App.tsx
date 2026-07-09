import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deals } from "./data/deals";
import { buildRiskAssessment } from "./lib/assessment";
import { recommendFinancingTerms } from "./lib/financing";
import type { Deal, FinancingRecommendation, RiskAssessment, Step } from "./types";
import { StepIndicator } from "./components/StepIndicator";
import { DealSelector } from "./components/DealSelector";
import { CreateDealAssessment } from "./components/CreateDealAssessment";
import { DocumentIngestion } from "./components/DocumentIngestion";
import { RiskDashboard } from "./components/RiskDashboard";
import { FinancingRecommendationPanel } from "./components/FinancingRecommendation";
import { TruMarketLogo } from "./components/TruMarketLogo";

type HomeView = "select" | "create";

function App() {
  const [step, setStep] = useState<Step>(1);
  const [homeView, setHomeView] = useState<HomeView>("select");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [financing, setFinancing] = useState<FinancingRecommendation | null>(
    null,
  );

  const handleSelectDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setAssessment(null);
    setFinancing(null);
    setHomeView("select");
    setStep(2);
  };

  const handleCreateDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setAssessment(null);
    setFinancing(null);
    setHomeView("select");
    setStep(2);
  };

  const handleRunAssessment = () => {
    if (!selectedDeal) return;
    const result = buildRiskAssessment(selectedDeal);
    const terms = recommendFinancingTerms(
      result.overall,
      selectedDeal.dealValueUSD,
    );
    setAssessment(result);
    setFinancing(terms);
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setHomeView("select");
    setSelectedDeal(null);
    setAssessment(null);
    setFinancing(null);
  };

  const header = useMemo(
    () => (
      <header className="border-b border-tm-border bg-tm-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <TruMarketLogo className="h-9 w-auto" />
            <div className="hidden border-l border-tm-border pl-3 sm:block">
              <p className="text-xs text-tm-text-muted">Credit Risk Assessment</p>
            </div>
          </div>
          <span className="hidden text-xs text-tm-text-muted sm:block">
            Documentation-driven · 4-dimension scoring
          </span>
        </div>
        <StepIndicator currentStep={step} />
      </header>
    ),
    [step],
  );

  return (
    <div className="min-h-screen bg-tm-neutral-light">
      {header}

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <AnimatePresence mode="wait">
          {step === 1 && homeView === "select" && (
            <motion.div
              key="step-1-select"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <DealSelector
                deals={deals}
                onSelect={handleSelectDeal}
                onCreateNew={() => setHomeView("create")}
              />
            </motion.div>
          )}

          {step === 1 && homeView === "create" && (
            <motion.div
              key="step-1-create"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <CreateDealAssessment
                onBack={() => setHomeView("select")}
                onCreate={handleCreateDeal}
              />
            </motion.div>
          )}

          {step === 2 && selectedDeal && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <DocumentIngestion
                deal={selectedDeal}
                onBack={() => {
                  setStep(1);
                  setSelectedDeal(null);
                }}
                onRunAssessment={handleRunAssessment}
              />
            </motion.div>
          )}

          {step === 3 && selectedDeal && assessment && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <RiskDashboard
                deal={selectedDeal}
                assessment={assessment}
                onBack={() => setStep(2)}
                onContinue={() => setStep(4)}
              />
            </motion.div>
          )}

          {step === 4 && selectedDeal && assessment && financing && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <FinancingRecommendationPanel
                deal={selectedDeal}
                assessment={assessment}
                financing={financing}
                onBack={() => setStep(3)}
                onAssessAnother={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-tm-border py-6 text-center text-xs text-tm-text-muted">
        TruMarket agro trade-finance credit scoring — demo environment
      </footer>
    </div>
  );
}

export default App;
