#!/usr/bin/env python3
"""JSON stdin/stdout wrapper for src.rate.build_payload (Node/Vercel integration)."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd

MI_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MI_DIR))

from src.rate import build_payload  # noqa: E402


def sanitize_json(value):
    if isinstance(value, dict):
        return {k: sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_json(v) for v in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def main() -> int:
    raw = sys.stdin.read()
    params = json.loads(raw)

    fact_path = MI_DIR / "marts" / "fact_shipments.parquet"
    if not fact_path.exists():
        print(json.dumps({"error": f"missing {fact_path}"}), file=sys.stderr)
        return 2

    fact = pd.read_parquet(fact_path)
    source_files = (
        sorted(fact["source_file"].dropna().unique().tolist())
        if "source_file" in fact.columns
        else []
    )

    payload = build_payload(
        fact=fact,
        exporter_ruc=params["exporterRuc"],
        importer_name=params.get("importerName"),
        destination_country=params.get("destinationCountry"),
        variety=params.get("variety"),
        deal_week=params.get("dealWeek"),
        deal_kg=params.get("dealKg"),
        deal_price_usd_per_kg=params.get("dealPriceUsdPerKg"),
        source_files=source_files,
    )

    print(json.dumps(sanitize_json(payload), ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
