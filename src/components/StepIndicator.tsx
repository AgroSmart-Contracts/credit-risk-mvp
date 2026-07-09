import type { Step } from "../types";

interface StepIndicatorProps {
  currentStep: Step;
}

const STEPS: Step[] = [1, 2, 3, 4];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-6">
      {STEPS.map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? "h-3.5 w-3.5 bg-tm-primary"
                  : isCompleted
                    ? "h-2.5 w-2.5 bg-tm-text-muted"
                    : "h-2.5 w-2.5 bg-tm-border"
              }`}
            />
            {index < STEPS.length - 1 && (
              <div
                className={`h-px w-12 sm:w-16 transition-colors duration-300 ${
                  isCompleted ? "bg-tm-text-muted" : "bg-tm-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
