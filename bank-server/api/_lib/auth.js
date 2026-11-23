/**
 * Sign-in for the bank edition: invite-only accounts (scrypt password, plus a TOTP code
 * for accounts created with --2fa) and
 * a signed, HttpOnly session cookie. Missing configuration fails closed.
 *
 * BANK_SESSION_SECRET  at least 32 characters
 * BANK_USERS           JSON array from scripts/bank/add-user.mjs
 */
import crypto from "node:crypto";

const COOKIE = "__Host-tm_session";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// Per-instance limits. They slow guessing; the password and TOTP are the real barrier.
const failures = new Map();
const usedCodes = new Map();

export function config() {
  const secret = process.env.BANK_SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("BANK_SESSION_SECRET is not configured");
  const users = JSON.parse(process.env.BANK_USERS ?? "[]");
  if (!Array.isArray(users) || users.length === 0) throw new Error("BANK_USERS is not configured");
  return { secret, users };
}

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);
const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");
const scrypt = (password, salt) =>
  new Promise((resolve, reject) => crypto.scrypt(password, Buffer.from(salt, "base64"), 32, SCRYPT, (e, k) => (e ? reject(e) : resolve(k))));

function base32(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}

export function totp(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function checkCode(user, code) {
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now - 1, now, now + 1]) {
    if (!same(Buffer.from(totp(user.totp, step)), Buffer.from(String(code).padEnd(6).slice(0, 6)))) continue;
    const key = `${user.id}:${step}`;
    if (usedCodes.has(key)) return false;
    usedCodes.set(key, Date.now());
    for (const [k, at] of usedCodes) if (Date.now() - at > 120000) usedCodes.delete(k);
    return true;
  }
  return false;
}

export const clientIp = (req) => String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();

export function isLocked(key) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() > f.until) {
    failures.delete(key);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

const fail = (key) => {
  const f = failures.get(key) ?? { count: 0, until: 0 };
  failures.set(key, { count: f.count + 1, until: Date.now() + LOCK_MS });
};

const DUMMY_SALT = Buffer.alloc(16).toString("base64");

/** { user } for valid credentials, { needsCode } when a code is still missing. Unknown accounts take the same time. */
export async function authenticate(email, password, code, key) {
  const { users } = config();
  const user = users.find((u) => u.email.toLowerCase() === String(email ?? "").trim().toLowerCase());
  const derived = await scrypt(String(password ?? ""), user?.salt ?? DUMMY_SALT);
  const passwordOk = !!user && same(derived, Buffer.from(user.hash, "base64"));
  if (passwordOk && user.totp && !code) return { needsCode: true };
  if (passwordOk && (!user.totp || checkCode(user, code))) {
    failures.delete(key);
    return { user };
  }
  fail(key);
  return {};
}

export function sessionCookie(user) {
  const { secret } = config();
  const payload = Buffer.from(JSON.stringify({ sub: user.id, v: user.version ?? 1, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload, secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

/** The signed-in account, or null. Removing a user or raising their version ends their sessions. */
export function currentUser(req) {
  const { secret, users } = config();
  const raw = String(req.headers.cookie ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !same(Buffer.from(sig), Buffer.from(sign(payload, secret)))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (s.exp < Date.now() / 1000) return null;
    const user = users.find((u) => u.id === s.sub);
    return user && (user.version ?? 1) === s.v ? user : null;
  } catch {
    return null;
  }
}

/** Requests that change state must come from this site. */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers["x-forwarded-host"] ?? req.headers.host);
  } catch {
    return false;
  }
}

export const audit = (event, req, extra = {}) => console.log(JSON.stringify({ audit: event, at: new Date().toISOString(), ip: clientIp(req), ...extra }));

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("Body too large");
  }
  return JSON.parse(raw || "{}");
}
