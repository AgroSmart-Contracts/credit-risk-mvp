import { audit, authenticate, clientIp, isLocked, readJson, sameOrigin, send, sessionCookie } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST" || !sameOrigin(req)) return send(res, 405, { ok: false });
  try {
    const { email, password, code } = await readJson(req);
    const key = `${String(email ?? "").trim().toLowerCase()}|${clientIp(req)}`;
    if (isLocked(key)) {
      audit("login_locked", req, { email });
      return send(res, 429, { ok: false });
    }
    const { user, needsCode } = await authenticate(email, password, code, key);
    if (needsCode) return send(res, 401, { ok: false, needsCode: true });
    if (!user) {
      audit("login_failed", req, { email });
      return send(res, 401, { ok: false });
    }
    audit("login_ok", req, { user: user.id });
    return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(user) });
  } catch (err) {
    console.error("login error", err instanceof Error ? err.message : "unknown");
    return send(res, 503, { ok: false });
  }
}
