/**
 * Build of the bank edition. Data and map modules are swapped for server-fed versions,
 * and the build fails if anything internal (deals, CRAM, scoring, customs) enters it.
 */
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const ROOT = import.meta.dirname;
const SWAP: Record<string, string> = {
  "src/data/bcp/dataset.ts": "src/bank/data/dataset.ts",
  "src/data/bcp/technical.ts": "src/bank/data/technical.ts",
  "src/components/bcp/MapView.tsx": "src/bank/RegionView.tsx",
  "src/components/bcp/FieldImages.tsx": "src/bank/NoFieldImages.tsx",
  "src/components/bcp/EvidenceDrawer.tsx": "src/bank/NoEvidenceDrawer.tsx",
  "src/components/bcp/TechCharts.tsx": "src/bank/NoTechCharts.tsx",
};
const BLOCKED =
  /^src\/(App\.tsx|InternalApp|components\/pre-harvest|data\/(?!bcp\/(series-text|enso-classes))|lib\/(?!bcp\/)|types\/)/;

function bankBoundary(): Plugin {
  return {
    name: "bank-boundary",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const rel = path.relative(ROOT, resolved.id.split("?")[0]).split(path.sep).join("/");
      if (SWAP[rel]) return path.join(ROOT, SWAP[rel]);
      if (BLOCKED.test(rel)) this.error(`Internal module in the bank build: ${rel} (imported by ${importer})`);
      return resolved;
    },
  };
}

export default defineConfig({
  publicDir: false,
  define: { "import.meta.env.VITE_BANK_EDITION": JSON.stringify("1") },
  plugins: [bankBoundary(), react(), tailwindcss()],
  build: {
    outDir: ".bank-build/public",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: path.join(ROOT, "bank.html") },
  },
});
