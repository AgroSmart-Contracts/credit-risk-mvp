export type {
  CashFlowResult,
  DealPurpose,
  ResolvedTransactionStructure,
  StructureTier,
  TransactionStructureInput,
  TransactionStructureScore,
} from "./types";
export {
  getDealTransactionStructure,
  inferBuyerTranchesFromPaymentTerms,
  inferStructureFromDeal,
  structureFieldLabels,
} from "./infer-from-deal";
export {
  computeCashFlow,
  computeTransactionStructureScore,
  isStructureFieldUndisclosed,
  resolveTransactionStructure,
} from "./scoring";
