/**
 * Builds the self-contained bank package in .bank-build: public files, sign-in functions
 * and the private results. Deploy that folder alone, so internal code is never uploaded.
 *   npm run build:bank
 *   cd .bank-build && vercel deploy --prod
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, ".bank-build");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });

if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f !== ".vercel") rmSync(path.join(OUT, f), { recursive: true, force: true });
run("npx", ["tsx", "scripts/bank/build-view-model.ts"]);
const vm = path.join(OUT, "private/view-model.json");
const keep = path.join(ROOT, "node_modules/.tmp-bank-vm.json");
mkdirSync(path.dirname(keep), { recursive: true });
renameSync(vm, keep);
run("npx", ["vite", "build", "--config", "vite.bank.config.ts"]);
renameSync(path.join(OUT, "public/bank.html"), path.join(OUT, "public/index.html"));
for (const f of ["logo.svg", "logo-mark.svg"]) cpSync(path.join(ROOT, "public", f), path.join(OUT, "public", f));
cpSync(path.join(ROOT, "bank-server/api"), path.join(OUT, "api"), { recursive: true });
mkdirSync(path.join(OUT, "private"), { recursive: true });
renameSync(keep, vm);

writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ name: "trumarket-bank", private: true, type: "module", engines: { node: "24.x" } }, null, 2));
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
writeFileSync(
  path.join(OUT, "vercel.json"),
  JSON.stringify(
    {
      framework: null,
      buildCommand: "",
      installCommand: "",
      outputDirectory: "public",
      functions: { "api/data.js": { includeFiles: "private/**" } },
      rewrites: [{ source: "/((?!api/|assets/|logo\\.svg|logo-mark\\.svg).*)", destination: "/index.html" }],
      headers: [
        {
          source: "/(.*)",
          headers: [
            { key: "Content-Security-Policy", value: csp },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ],
        },
      ],
    },
    null,
    2,
  ),
);
run("node", ["scripts/bank/scan.mjs"]);
console.log("bank package ready: .bank-build");
