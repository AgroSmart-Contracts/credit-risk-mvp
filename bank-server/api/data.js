/** The finished results for the signed-in user. The file is outside the public folder. */
import { readFile } from "node:fs/promises";
import { audit, currentUser, send } from "./_lib/auth.js";

let cached;

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false });
  try {
    const user = currentUser(req);
    if (!user) return send(res, 401, { ok: false });
    cached ??= JSON.parse(await readFile(new URL("../private/view-model.json", import.meta.url), "utf8"));
    audit("data_read", req, { user: user.id });
    return send(res, 200, { viewer: user.name, data: cached });
  } catch (err) {
    console.error("data error", err instanceof Error ? err.message : "unknown");
    return send(res, 503, { ok: false });
  }
}
