/** The signed-in user's data, fetched from the server after login and held in memory only. */
import type { Portfolio } from "../lib/bcp/types";
import type { TechSeries } from "../data/bcp/technical";

export interface BankData {
  portfolio: Portfolio;
  series: Record<string, TechSeries>;
}

let data: BankData | null = null;
export const setBankData = (d: BankData) => {
  data = d;
};
export const bankData = () => {
  if (!data) throw new Error("Bank data is not loaded");
  return data;
};
