/**
 * BCP pre-harvest bank workspace: data model (spec 2026-11-19, section 5.1).
 * Every screen and report reads from one dataset of this shape; no component
 * hard-codes a figure.
 */

/** Copy in both languages: Spanish (Peru, banking register) is the final copy; English for the toggle. */
export interface Tx {
  es: string;
  en: string;
}
export type Lang = "es" | "en";

export type State = "verde" | "ambar" | "naranja" | "rojo" | "veto";
export type ConditionState = State | "observacion";
export type Provenance = "doc_verificado" | "declarado" | "satelital" | "estimado";
export type Driver = "volumen" | "calidad" | "precio" | "cobranza" | "prestatario";
export type CheckStatus = "ok" | "pending" | "warn" | "fail";

export interface Tranche {
  id: "T1" | "T2" | "T3";
  pct: 30 | 40;
  /** Maximum; T2 final amount is sized on the verified volume (aforo). */
  amountUsd: number;
  status: "liberado" | "pendiente" | "congelado" | "previsto";
  milestoneDate: string;
  checklist: { label: Tx; status: CheckStatus }[];
  bankConformityDate?: string;
  /** Short line under the checklist (e.g. "Monto final = volumen verificado en el aforo"). */
  note?: Tx;
}

export interface CoveragePoint {
  date: string;
  value: number;
  note?: Tx;
}

export interface Condition {
  group: "Prestatario" | "Cultivo y volumen" | "Precio y calidad" | "Uso de fondos y cobranza";
  label: Tx;
  atApproval: Tx;
  today: Tx;
  threshold: Tx;
  state: ConditionState;
  effectOnRepayment: Tx;
  provenance: Provenance;
  source: Tx;
  /** The source is real data (not example data). */
  real?: boolean;
}

export interface UseOfFundsLine {
  item: Tx;
  budgetUsd: number;
  reconciledUsd: number;
  /** Paid by TruMarket directly to the supplier, USD. */
  directPayUsd: number;
  fieldMatch: Tx;
}

export interface Decision {
  date: string;
  lane: "tm_contract" | "bank";
  title: Tx;
  basis: Tx;
  evidence: Tx[];
  engineVersion: string;
  responsible: Tx;
  /** Bank lane only. */
  dueDate?: string;
  /** Bank lane: the bank's conformity date once given. */
  conformityDate?: string;
}

export interface AuditEntry {
  date: string;
  event: Tx;
  responsible: Tx;
  rule: Tx;
  evidence: Tx;
  engineVersion: string;
}

/** A cause behind a coverage change, in plain language (alert card "Ver por qué"). */
export interface Cause {
  status: "confirmado" | "observacion" | "bajo_control";
  text: Tx;
  /** Coverage effect, e.g. "-0.20x" or "-0.10x a -0.20x". */
  effect: Tx;
  /** The condition row (Spanish label) whose evidence explains this cause. */
  condition?: string;
}

/** One scoring dimension: points at approval and today, and its weight in the score. */
export interface ScoreDim {
  dim: Tx;
  weight: number;
  approval: number;
  today: number;
  /** What moved it, in plain words (when it moved). */
  why?: Tx;
}

export interface Loan {
  id: string;
  crop: Tx;
  zone: Tx;
  areaHa: number;
  campaign: string;
  approvalDate: string;
  dayOfCycle: number;
  cycleDays: number;
  lineUsd: number;
  disbursedUsd: number;
  frozenUsd: number;
  dueAtMaturityUsd: number;
  maturityDate: string;
  state: State;
  stateSince: string;
  coverageAtApproval: number;
  coverageToday: number;
  /** Estimated, never confirmed: shown as a range with an "Estimado" badge. */
  projection?: { low: number; high: number; cause: Tx };
  driverDeltas: Record<Driver, number>;
  breakEvenPriceUsdKg: number;
  expectedPriceUsdKg: number;
  approvalPriceUsdKg: number;
  expectedVolumeChangePct: number;
  sbsRating: "Normal" | "CPP" | "Deficiente" | "Dudoso" | "Pérdida";
  scoreAtApproval: number;
  scoreToday: number;
  approvedTier: "A" | "B" | "C" | "D";
  scoreDims: ScoreDim[];
  tranches: Tranche[];
  coverageHistory: CoveragePoint[];
  conditions: Condition[];
  useOfFunds: {
    tranche: string;
    lines: UseOfFundsLine[];
    cashWithdrawnUsd: number;
    threeSources: { facturas: boolean; satelite: boolean; aforo: "ok" | "pending" | "fail"; aforoDate: string };
  }[];
  decisions: Decision[];
  auditLog: AuditEntry[];
  /** What is happening, one line, impact language (portfolio table). */
  summary: Tx;
  /** Next milestone and the money at stake. */
  next: { date: string; label: Tx; amountUsd: number };
  causes: Cause[];
  /** Situation card bullets (loan file, dark card). Bold segments marked with **. */
  situation: Tx[];
}

export interface PortfolioChange {
  loanId: string | null;
  date: string;
  from: ConditionState | "neutral";
  to: ConditionState;
  impact: Tx;
  cause: Tx;
  /** Evidence behind the change: a loan and the condition row (Spanish label). */
  evidence?: { loanId: string; condition: string };
}

export interface ExceptionNotice {
  loanId: string;
  since: string;
  state: State;
  oneLine: Tx;
  whatHappened: Tx[];
  impact: Tx[];
  actions: Tx[];
  bankDecision: Tx[];
  evidence: Tx[];
  plan: Tx;
  ifNotMet: Tx;
  nextUpdate: string;
}

export interface UpcomingMilestone {
  date: string;
  loanId: string;
  milestone: Tx;
  amountUsd: number;
}

export interface Portfolio {
  cutoff: string;
  applications: Application[];
  monthFrom: string;
  engineVersion: string;
  loans: Loan[];
  changes: PortfolioChange[];
  exceptions: ExceptionNotice[];
  upcoming: UpcomingMilestone[];
  /** Portfolio-wide estimate (El Niño), never confirmed until the field estimates. */
  projection: { low: number; high: number; text: Tx };
  /** Share of the line through the main packhouse (concentration). */
  mainPackhousePct: number;
  controls: {
    bureauRechecked: [number, number];
    assignmentRegistered: [number, number];
    insuranceInForce: [number, number];
  };
}

/** A row of the application file: a check at application, with its provenance. */
export interface AppCheck {
  group: Condition["group"];
  label: Tx;
  value: Tx;
  state: ConditionState;
  effect: Tx;
  provenance: Provenance;
  source: Tx;
  /** The source is real data (not example data). */
  real?: boolean;
}

/** A loan application awaiting the bank's decision (discretionary: bank lane). */
export interface Application {
  id: string;
  crop: Tx;
  zone: Tx;
  areaHa: number;
  campaign: string;
  receivedDate: string;
  decisionDueDate: string;
  requestedUsd: number;
  tenorDays: number;
  dueAtMaturityUsd: number;
  tranches: { id: "T1" | "T2" | "T3"; pct: number; amountUsd: number; milestone: Tx }[];
  /** Coverage at application; null when a veto makes the harvest unverifiable. */
  coverage: number | null;
  breakEvenPriceUsdKg: number | null;
  expectedPriceUsdKg: number;
  score: number;
  tier: "A" | "B" | "C" | "D";
  veto: boolean;
  scoreDims: ScoreDim[];
  recommendation: "aprobar" | "rechazar";
  /** One sentence, money first. */
  summary: Tx;
  reasons: Tx[];
  checks: AppCheck[];
}
