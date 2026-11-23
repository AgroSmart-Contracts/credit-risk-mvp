/** Bank edition of src/data/bcp/dataset.ts: reads the server's finished results. */
import { bankData } from "../store";

export const PORTFOLIO = bankData().portfolio;
export const loanById = (id: string) => PORTFOLIO.loans.find((l) => l.id === id);
export const applicationById = (id: string) => PORTFOLIO.applications.find((a) => a.id === id);
