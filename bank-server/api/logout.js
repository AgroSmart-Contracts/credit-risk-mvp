import { clearCookie, sameOrigin, send } from "./_lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST" || !sameOrigin(req)) return send(res, 405, { ok: false });
  return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
}
