"""
Manual ingest + marts rebuild CLI.

Scans `raw/` for xlsx files, ingests each via auto-format detection (Veritrade
or alt-SUNAT), then rebuilds `fact_shipments`, entity resolution, and all marts
from the union of all files.

Idempotent: re-running with no new files produces identical marts.

Usage:
  python -m src.refresh                    # scan raw/, rebuild marts/
  python -m src.refresh --raw path/to/dir  # scan a different raw dir
  python -m src.refresh --dry-run          # report what would happen, don't write
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import pandas as pd

from src.entity_resolution import resolve_entities
from src.ingest import load_file, write_snapshot
from src.marts import build_all


def main():
    ap = argparse.ArgumentParser(description="Ingest raw Excel files and rebuild all marts.")
    ap.add_argument("--raw", default="raw", help="Directory to scan for xlsx (default: ./raw).")
    ap.add_argument("--marts", default="marts", help="Marts directory (default: ./marts).")
    ap.add_argument("--threshold", type=int, default=85, help="Fuzzy-match threshold for importer dedup (default: 85).")
    ap.add_argument("--dry-run", action="store_true", help="Report the plan; do not write.")
    args = ap.parse_args()

    raw_dir = Path(args.raw)
    marts_dir = Path(args.marts)
    if not raw_dir.exists():
        print(f"ERROR: raw dir {raw_dir} does not exist", file=sys.stderr)
        sys.exit(2)

    xlsx_files = sorted(raw_dir.glob("*.xlsx"))
    if not xlsx_files:
        print(f"No .xlsx files in {raw_dir}. Nothing to ingest.")
        sys.exit(0)

    print(f"Found {len(xlsx_files)} files in {raw_dir}:")
    for p in xlsx_files:
        print(f"  - {p.name}  ({p.stat().st_size/1024/1024:.2f} MB)")

    # Baseline metrics (for the diff report)
    fact_path = marts_dir / "fact_shipments.parquet"
    if fact_path.exists():
        old = pd.read_parquet(fact_path)
        old_stats = {
            "rows": len(old),
            "exporters": old["exporter_ruc"].nunique(),
            "importers": old["importer_id"].dropna().nunique(),
            "hs_headings": sorted(old["hs_heading"].dropna().unique().tolist()),
            "date_max": str(old["date"].max().date()),
        }
    else:
        old_stats = None

    if args.dry_run:
        print("\n[dry-run] would ingest all files, resolve entities, rebuild marts.")
        if old_stats:
            print(f"[dry-run] current marts: {old_stats}")
        sys.exit(0)

    # Ingest each file, snapshot, then union
    print("\nIngesting…")
    t0 = time.time()
    all_frames = []
    for p in xlsx_files:
        try:
            df, meta = load_file(p)
            write_snapshot(df, marts_dir, meta)
            all_frames.append(df)
            print(f"  {p.name}: {len(df):,} rows, HS heading {meta.get('hs_heading')}")
        except Exception as e:
            print(f"  {p.name}: FAILED — {type(e).__name__}: {e}", file=sys.stderr)

    if not all_frames:
        print("\nNo files loaded successfully. Aborting.", file=sys.stderr)
        sys.exit(3)

    union = pd.concat(all_frames, ignore_index=True)
    print(f"\nUnion: {len(union):,} rows")

    print("\nEntity resolution…")
    enriched, registry = resolve_entities(union, importer_threshold=args.threshold)

    print("\nBuilding marts…")
    paths = build_all(enriched, marts_dir)
    registry.to_parquet(marts_dir / "importer_registry.parquet", index=False)

    print(f"\nDone in {time.time()-t0:.1f}s.")
    print("Marts written:")
    for name, p in paths.items():
        print(f"  {name:24s}  {p}")

    # Diff report
    new_stats = {
        "rows": len(enriched),
        "exporters": enriched["exporter_ruc"].nunique(),
        "importers": enriched["importer_id"].dropna().nunique(),
        "hs_headings": sorted(enriched["hs_heading"].dropna().unique().tolist()),
        "date_max": str(enriched["date"].max().date()),
    }
    print("\nDiff report:")
    if old_stats:
        for k in new_stats:
            print(f"  {k:16s}  {old_stats[k]}  ->  {new_stats[k]}")
    else:
        print(f"  first build: {new_stats}")


if __name__ == "__main__":
    main()
