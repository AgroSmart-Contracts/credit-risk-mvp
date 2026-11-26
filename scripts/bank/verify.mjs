/** Attacks the built bank package locally: every route, without and with a session. */
import crypto from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PKG = path.resolve(import.meta.dirname, "../../.bank-build");
const b32 = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const password = "verify-only-" + crypto.randomBytes(8).toString("hex");
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
process.env.BANK_SESSION_SECRET = crypto.randomBytes(32).toString("hex");
process.env.BANK_USERS = JSON.stringify([{ id: "u1", name: "Verify User", email: "verify@bank.test", salt: salt.toString("base64"), hash: hash.toString("base64"), totp: b32, version: 1 }, { id: "u2", name: "Password User", email: "password@bank.test", salt: salt.toString("base64"), hash: hash.toString("base64"), version: 1 }]);
const log = console.log;
console.log = (...a) => (String(a[0]).startsWith('{"audit"') ? undefined : log(...a));

const api = {};
for (const n of ["login", "logout", "data"]) api[n] = (await import(pathToFileURL(path.join(PKG, "api", `${n}.js`)))).default;
const { totp } = await import(pathToFileURL(path.join(PKG, "api/_lib/auth.js")));
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  const fn = p.startsWith("/api/") ? api[p.slice(5)] : null;
  if (fn) return fn(req, res);
  if (p.startsWith("/api/")) return (res.statusCode = 404), res.end();
  const f = path.normalize(path.join(PKG, "public", p === "/" ? "index.html" : p));
  if (!f.startsWith(path.join(PKG, "public")) || !existsSync(f) || statSync(f).isDirectory()) return (res.statusCode = 404), res.end();
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
let failed = 0;
const check = (name, ok) => {
  if (!ok) failed++;
  log(`${ok ? "pass" : "FAIL"}  ${name}`);
};
// Browsers send Origin on a POST; the default here is this site, as a browser would.
const post = (u, body, h = {}) => fetch(base + u, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...h }, body: JSON.stringify(body) });
const step = Math.floor(Date.now() / 30000);

check("data without a session is refused", (await fetch(`${base}/api/data`)).status === 401);
check("forged cookie is refused", (await fetch(`${base}/api/data`, { headers: { cookie: "__Host-tm_session=eyJzdWIiOiJ1MSJ9.forged" } })).status === 401);
for (const u of ["/private/view-model.json", "/api/private/view-model.json", "/pre-harvest/sentinel-ica-0177.json", "/api/market-intel-rate", "/api/pre-harvest-data"]) check(`${u} is not served`, (await fetch(base + u)).status === 404);
check("wrong password is refused", (await post("/api/login", { email: "verify@bank.test", password: "wrong", code: totp(b32, step) })).status === 401);
check("right password with a wrong code is refused", (await post("/api/login", { email: "verify@bank.test", password, code: "000000" })).status === 401);
check("login with no Origin or Referer is refused", (await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "verify@bank.test", password, code: totp(b32, step) }) })).status === 405);
check("login from another site is refused", (await post("/api/login", { email: "verify@bank.test", password, code: totp(b32, step) }, { Origin: "https://evil.test" })).status === 405);
const ok = await post("/api/login", { email: "verify@bank.test", password, code: totp(b32, step) });
const cookie = ok.headers.get("set-cookie") ?? "";
check("valid login works", ok.status === 200);
check("cookie is HttpOnly, Secure, SameSite=Strict", /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie));
check("a used code cannot be replayed", (await post("/api/login", { email: "verify@bank.test", password, code: totp(b32, step) })).status === 401);
check("password-only account signs in", (await post("/api/login", { email: "password@bank.test", password })).status === 200);
check("password-only account refuses a wrong password", (await post("/api/login", { email: "password@bank.test", password: "wrong" })).status === 401);
check("malformed login body is rejected", (await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: "{nope" })).status === 400);
check("non-text credentials are rejected", (await post("/api/login", { email: { a: 1 }, password: ["x"] })).status === 401);
check("oversized password is rejected", (await post("/api/login", { email: "password@bank.test", password: "x".repeat(300) })).status === 401);
const session = cookie.split(";")[0];
const data = await fetch(`${base}/api/data`, { headers: { cookie: session } });
const text = await data.text();
check("data with a session works", data.status === 200 && data.headers.get("cache-control") === "no-store");
for (const k of ['"weight"', '"lat"', '"lon"', '"ring"', '"parcelId"', "Villacur", "Santiago"]) check(`response has no ${k}`, !text.includes(k));
const [p, s] = session.split("=")[1].split(".");
check("tampered session is refused", (await fetch(`${base}/api/data`, { headers: { cookie: `__Host-tm_session=${p}x.${s}` } })).status === 401);
for (let i = 0; i < 6; i++) await post("/api/login", { email: "lock@bank.test", password: "x", code: "000000" });
check("repeated failures are locked out", (await post("/api/login", { email: "lock@bank.test", password: "x", code: "000000" })).status === 429);
// A client-set X-Forwarded-For must not buy fresh attempts.
for (let i = 0; i < 6; i++) await post("/api/login", { email: "spoof@bank.test", password: "x", code: "000000" }, { "X-Forwarded-For": `203.0.113.${i}` });
check("a forged X-Forwarded-For does not reset the lockout", (await post("/api/login", { email: "spoof@bank.test", password: "x", code: "000000" }, { "X-Forwarded-For": "198.51.100.7" })).status === 429);
server.close();
log(failed ? `${failed} FAILED` : "all checks passed");
process.exit(failed ? 1 : 0);
