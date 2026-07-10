import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { MarketIntelRateRequest, MarketIntelRateResponse } from "../src/lib/market-intel/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MARKET_INTEL_DIR = join(
  REPO_ROOT,
  "docs",
  "market-intel-peru-2025-2026-07-10",
);

function readJsonBody(req: IncomingMessage): Promise<MarketIntelRateRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as MarketIntelRateRequest);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: MarketIntelRateResponse): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function spawnMarketIntelRate(
  params: MarketIntelRateRequest,
): Promise<MarketIntelRateResponse> {
  return new Promise((resolve) => {
    const scriptPath = join(MARKET_INTEL_DIR, "scripts", "rate-json.py");
    if (!existsSync(scriptPath)) {
      resolve({
        ok: false,
        unavailable: true,
        error: "market-intel script missing",
      });
      return;
    }

    const child = spawn("python3", [scriptPath], {
      cwd: MARKET_INTEL_DIR,
      env: { ...process.env, PYTHONPATH: MARKET_INTEL_DIR },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", () => {
      resolve({
        ok: false,
        unavailable: true,
        error: "python3 not available",
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          unavailable: code === 127,
          error: stderr.trim() || `python exited ${code}`,
        });
        return;
      }
      try {
        const payload = JSON.parse(stdout);
        resolve({ ok: true, payload });
      } catch {
        resolve({
          ok: false,
          error: stderr.trim() || "invalid JSON from market-intel engine",
        });
      }
    });

    child.stdin.write(JSON.stringify(params));
    child.stdin.end();
  });
}

export async function handleMarketIntelRate(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.exporterRuc?.trim()) {
      sendJson(res, 400, { ok: false, error: "exporterRuc is required" });
      return;
    }

    const result = await spawnMarketIntelRate(body);
    sendJson(res, result.ok ? 200 : result.unavailable ? 503 : 500, result);
  } catch (err) {
    sendJson(res, 400, {
      ok: false,
      error: err instanceof Error ? err.message : "bad request",
    });
  }
}
