/** Loaders for the heavier BCP pages (Recharts, Leaflet, A4 reports), and an idle prefetch. */
export const loadLoanFile = () => import("./LoanFile");
export const loadMap = () => import("./MapView");
export const loadReports = () => import("./Reports");

/** Warm the heavier pages one after another when the browser is idle. */
export function prefetchBcpPages() {
  void loadLoanFile().then(loadMap).then(loadReports);
}
