"""
One-shot D4 payload CLI.

Given a deal's parameters, returns a single JSON blob combining every CRAM-shaped
signal this project can produce. The receiving agent (or `compute_cram(deal_ref)`)
reads this JSON and folds each dimension into its scorecard.

Usage:
  python -m src.rate --exporter-ruc 20602722628 \
                     --importer "EAGLE TRADING AGRICULTURE MARKETING LTD" \
                     --dest ISRAEL \
                     --variety BLUEBERRY \
                     --deal-week 2025-10-13/2025-10-19 \
                     --deal-kg 25000 \
                     --deal-price 10.67

All parameters except --exporter-ruc are optional. Missing inputs mean the
corresponding dimension returns NEEDS_INPUT — the payload is honest about
what it could and could not evaluate.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

from src.analysis import (
    counterparty_profile,
    pair_history,
    price_benchmark,
    route_intelligence,
)
from src.cram_tables import table_version


def _serialize(obj):
    if hasattr(obj, "as_dict"):
        return obj.as_dict()
    return obj


def _find_importer_id(fact: pd.DataFrame, importer_name: str, destination_country: str) -> str | None:
    if not importer_name:
        return None
    norm = importer_name.upper().strip()
    dest = (destination_country or "").upper().strip()

    matches = fact[
        (fact["importer_canonical_name"].fillna("").str.upper() == norm)
    ]
    if dest:
        matches = matches[matches["destination_country"].str.upper() == dest]

    if len(matches):
        ids = matches["importer_id"].dropna().unique()
        if len(ids):
            return str(ids[0])

    substr = fact[
        fact["importer_canonical_name"].fillna("").str.upper().str.contains(norm, na=False)
    ]
    if dest:
        substr = substr[substr["destination_country"].str.upper() == dest]
    if len(substr):
        ids = substr["importer_id"].dropna().unique()
        if len(ids):
            return str(ids[0])
    return None


def build_payload(
    fact: pd.DataFrame,
    exporter_ruc: str,
    importer_name: str | None,
    destination_country: str | None,
    variety: str | None,
    deal_week: str | None,
    deal_kg: float | None,
    deal_price_usd_per_kg: float | None,
    as_of: str | None = None,
    source_files: list | None = None,
) -> dict:
    """Assemble the full D4 payload from all four library functions + SUNAT."""
    as_of_val = as_of or str(fact["date"].max().date())

    exporter_profile = counterparty_profile(
        fact,
        entity_id=exporter_ruc,
        side="exporter",
        as_of=as_of_val,
        deal_kg=deal_kg,
        sunat=True,
    )

    importer_profile = None
    pair = None
    if importer_name and destination_country:
        importer_id = _find_importer_id(fact, importer_name, destination_country)
        if importer_id:
            importer_profile = counterparty_profile(
                fact,
                entity_id=importer_id,
                side="importer",
                as_of=as_of_val,
                deal_kg=deal_kg,
                sunat=False,
            )
            pair = pair_history(fact, exporter_ruc, importer_id, as_of=as_of_val)

    benchmark = None
    if variety and destination_country and deal_week:
        benchmark = price_benchmark(
            fact,
            variety=variety,
            destination_country=destination_country,
            deal_week=deal_week,
            deal_price_usd_per_kg=deal_price_usd_per_kg,
        )

    route = None
    if variety and destination_country:
        route = route_intelligence(
            fact,
            variety=variety,
            destination_country=destination_country,
            deal_week=deal_week,
        )

    payload = {
        "meta": {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "data_as_of": as_of_val,
            "table_version": table_version(),
            "source_files": source_files or [],
            "engine_data_row_count": int(len(fact)),
        },
        "deal_inputs": {
            "exporter_ruc": exporter_ruc,
            "importer_name": importer_name,
            "destination_country": destination_country,
            "variety": variety,
            "deal_week": deal_week,
            "deal_kg": deal_kg,
            "deal_price_usd_per_kg": deal_price_usd_per_kg,
        },
        "dim_a_supplier": _serialize(exporter_profile),
        "dim_a_buyer": _serialize(importer_profile) if importer_profile else {"status": "NEEDS_INPUT", "reason": "importer_name / destination_country not provided or no matching importer_id in marts"},
        "dim_b_price_benchmark": _serialize(benchmark) if benchmark else {"status": "NEEDS_INPUT", "reason": "variety / destination_country / deal_week required for price benchmark"},
        "dim_c_route_intelligence": _serialize(route) if route else {"status": "NEEDS_INPUT", "reason": "variety / destination_country required for route intelligence"},
        "dim_d3_pair_history": _serialize(pair) if pair else {"status": "NEEDS_INPUT", "reason": "exporter + importer required for pair history"},
    }
    return payload


def main():
    ap = argparse.ArgumentParser(
        description="Emit the full CRAM-shaped market-intel payload for one deal.",
    )
    ap.add_argument("--exporter-ruc", required=True, help="Peruvian RUC of the supplier (11 digits).")
    ap.add_argument("--importer", default=None, help="Consignee / importer name (upper or lower case).")
    ap.add_argument("--dest", default=None, help="Destination country (Spanish name matching customs data, e.g. ESTADOS UNIDOS, ISRAEL, PAISES BAJOS).")
    ap.add_argument("--variety", default=None, help="Commodity variety (BLUEBERRY, MANGO, AVOCADO, STRAWBERRY, etc).")
    ap.add_argument("--deal-week", default=None, help="Deal week in W-SUN period format 'YYYY-MM-DD/YYYY-MM-DD' or 'YYYY-MM-DD'.")
    ap.add_argument("--deal-kg", type=float, default=None, help="Deal size in kg (net).")
    ap.add_argument("--deal-price", type=float, default=None, help="Deal price in USD per kg (FOB).")
    ap.add_argument("--as-of", default=None, help="Retrospective as-of date (ISO). Defaults to freshest data date.")
    ap.add_argument("--marts", default="marts", help="Marts directory (default: ./marts).")
    ap.add_argument("--out", default=None, help="Optional output path for the JSON payload. Defaults to stdout.")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print JSON.")
    args = ap.parse_args()

    marts_dir = Path(args.marts)
    fact_path = marts_dir / "fact_shipments.parquet"
    if not fact_path.exists():
        print(f"ERROR: {fact_path} does not exist. Run `python -m src.refresh` first.", file=sys.stderr)
        sys.exit(2)
    fact = pd.read_parquet(fact_path)

    source_files = sorted(fact["source_file"].dropna().unique().tolist()) if "source_file" in fact.columns else []

    payload = build_payload(
        fact=fact,
        exporter_ruc=args.exporter_ruc,
        importer_name=args.importer,
        destination_country=args.dest,
        variety=args.variety,
        deal_week=args.deal_week,
        deal_kg=args.deal_kg,
        deal_price_usd_per_kg=args.deal_price,
        as_of=args.as_of,
        source_files=source_files,
    )

    text = json.dumps(payload, indent=2 if args.pretty else None, ensure_ascii=False, default=str)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
