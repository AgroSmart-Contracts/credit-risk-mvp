import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface KeyRiskFactorsProps {
  concerns: string[];
  mitigating: string[];
}

export function KeyRiskFactors({ concerns, mitigating }: KeyRiskFactorsProps) {
  if (concerns.length === 0 && mitigating.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {concerns.length > 0 && (
        <div className="rounded-xl border border-tm-accent/30 bg-tm-accent/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-tm-accent-dark" />
            <h3 className="text-sm font-semibold text-tm-black">Concerns</h3>
          </div>
          <ul className="space-y-2">
            {concerns.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-sm text-tm-text before:shrink-0 before:content-['•']"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mitigating.length > 0 && (
        <div className="rounded-xl border border-tm-primary/30 bg-tm-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-tm-primary" />
            <h3 className="text-sm font-semibold text-tm-black">
              Mitigating factors
            </h3>
          </div>
          <ul className="space-y-2">
            {mitigating.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-sm text-tm-text before:shrink-0 before:content-['•']"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
