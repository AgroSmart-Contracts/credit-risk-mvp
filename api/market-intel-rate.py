import json
import math
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

MI_DIR = Path(__file__).resolve().parents[1] / "docs" / "market-intel-peru-2025-2026-07-10"
sys.path.insert(0, str(MI_DIR))
os.chdir(MI_DIR)

import pandas as pd  # noqa: E402
from src.rate import build_payload  # noqa: E402


def sanitize_json(value):
    if isinstance(value, dict):
        return {k: sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_json(v) for v in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            exporter_ruc = body.get("exporterRuc", "").strip()
            if not exporter_ruc:
                self._json(400, {"ok": False, "error": "exporterRuc is required"})
                return

            fact_path = MI_DIR / "marts" / "fact_shipments.parquet"
            fact = pd.read_parquet(fact_path)
            source_files = (
                sorted(fact["source_file"].dropna().unique().tolist())
                if "source_file" in fact.columns
                else []
            )

            payload = build_payload(
                fact=fact,
                exporter_ruc=exporter_ruc,
                importer_name=body.get("importerName"),
                destination_country=body.get("destinationCountry"),
                variety=body.get("variety"),
                deal_week=body.get("dealWeek"),
                deal_kg=body.get("dealKg"),
                deal_price_usd_per_kg=body.get("dealPriceUsdPerKg"),
                source_files=source_files,
            )

            self._json(200, {"ok": True, "payload": sanitize_json(payload)})
        except Exception as exc:
            self._json(500, {"ok": False, "error": str(exc)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
