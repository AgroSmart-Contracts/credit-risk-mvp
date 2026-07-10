"""
Analytical marts for Veritrade shipment data.

Reads the enriched fact table produced by entity_resolution and writes
four Parquet tables that all downstream analysis consumes:

  fact_shipments        cleaned, column-ordered shipment grain
  dim_exporter_month    (exporter_id, month) monthly scorecard
  dim_importer_month    (importer_id, month) monthly scorecard
  bipartite_flows       (exporter_id, importer_id, month, variety,
                         destination_country) flow grain — feeds all
                         allocation, Sankey, and price-evolution queries
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

# Column order for the final fact_shipments table (dropped: last_shipping_port).
FACT_COLUMN_ORDER = [
    # keys / provenance
    "dua",
    "date",
    "year",
    "month",
    "week",
    "source_file",
    # HS
    "hs_heading",
    "hs_heading_4",
    "hs_code",
    "hs_description",
    # exporter
    "exporter_id",
    "exporter_ruc",
    "exporter_canonical_name",
    "exporter_name",
    # importer
    "importer_id",
    "importer_canonical_name",
    "importer_name",
    # geo / logistics
    "destination_country",
    "destination_port",
    "customs_office",
    "transport_mode",
    "shipping_line",
    "port_agent",
    "customs_broker",
    "freight_forwarder_origin",
    "freight_forwarder_destination",
    "customs_channel",
    # product
    "variety",
    "form",
    "pack_format",
    "organic_flag",
    "commercial_description",
    "description_1",
    "description_2",
    "description_3",
    "description_4",
    "description_5",
    # measures
    "kg_gross",
    "kg_net",
    "qty1",
    "unit1",
    "qty2",
    "unit2",
    "fob_usd",
    "fob_usd_per_unit1",
    "fob_usd_per_unit2",
    "usd_per_kg_net",
]


def build_fact_shipments(enriched: pd.DataFrame) -> pd.DataFrame:
    """Clean, reorder, and finalize the shipment-level fact table."""
    df = enriched.copy()
    df["hs_heading_4"] = df["hs_code"].astype("string").str.slice(0, 4)
    df = df.drop(columns=[c for c in ("last_shipping_port",) if c in df.columns])
    keep = [c for c in FACT_COLUMN_ORDER if c in df.columns]
    extra = [c for c in df.columns if c not in FACT_COLUMN_ORDER]
    return df[keep + extra]


def _weighted_avg(values: pd.Series, weights: pd.Series) -> float:
    """Weighted mean, safe against zero total weight."""
    w = weights.fillna(0)
    v = values.fillna(0)
    total = w.sum()
    if total == 0:
        return float("nan")
    return float((v * w).sum() / total)


def build_dim_exporter_month(fact: pd.DataFrame) -> pd.DataFrame:
    """Per-exporter monthly rollup."""
    grouped = fact.groupby(["exporter_id", "exporter_canonical_name", "month"], dropna=False)

    agg = grouped.agg(
        shipments=("dua", "count"),
        kg_net=("kg_net", "sum"),
        kg_gross=("kg_gross", "sum"),
        fob_usd=("fob_usd", "sum"),
        n_importers=("importer_id", "nunique"),
        n_destinations=("destination_country", "nunique"),
        n_varieties=("variety", "nunique"),
    ).reset_index()

    agg["avg_usd_per_kg"] = agg["fob_usd"] / agg["kg_net"].where(agg["kg_net"] > 0)
    return agg


def build_dim_importer_month(fact: pd.DataFrame) -> pd.DataFrame:
    """Per-importer monthly rollup (importer_id already country-scoped)."""
    f = fact.dropna(subset=["importer_id"])
    grouped = f.groupby(
        ["importer_id", "importer_canonical_name", "destination_country", "month"],
        dropna=False,
    )

    agg = grouped.agg(
        shipments=("dua", "count"),
        kg_net=("kg_net", "sum"),
        kg_gross=("kg_gross", "sum"),
        fob_usd=("fob_usd", "sum"),
        n_exporters=("exporter_id", "nunique"),
        n_varieties=("variety", "nunique"),
    ).reset_index()

    agg["avg_usd_per_kg"] = agg["fob_usd"] / agg["kg_net"].where(agg["kg_net"] > 0)
    return agg


def build_bipartite_flows(fact: pd.DataFrame) -> pd.DataFrame:
    """
    Exporter × importer × month × variety × destination grain.
    The workhorse table for allocation, Sankey, competitor watchlists,
    and any price-evolution query.
    """
    f = fact.dropna(subset=["importer_id"])
    grouped = f.groupby(
        [
            "exporter_id",
            "exporter_canonical_name",
            "importer_id",
            "importer_canonical_name",
            "destination_country",
            "variety",
            "month",
        ],
        dropna=False,
    )
    agg = grouped.agg(
        shipments=("dua", "count"),
        kg_net=("kg_net", "sum"),
        fob_usd=("fob_usd", "sum"),
    ).reset_index()
    agg["avg_usd_per_kg"] = agg["fob_usd"] / agg["kg_net"].where(agg["kg_net"] > 0)
    return agg


def build_all(enriched: pd.DataFrame, marts_dir: str | Path) -> dict[str, Path]:
    """Build all four marts and write to Parquet. Returns a dict of paths."""
    marts_dir = Path(marts_dir)
    marts_dir.mkdir(parents=True, exist_ok=True)

    fact = build_fact_shipments(enriched)
    dim_exp = build_dim_exporter_month(fact)
    dim_imp = build_dim_importer_month(fact)
    flows = build_bipartite_flows(fact)

    paths = {
        "fact_shipments": marts_dir / "fact_shipments.parquet",
        "dim_exporter_month": marts_dir / "dim_exporter_month.parquet",
        "dim_importer_month": marts_dir / "dim_importer_month.parquet",
        "bipartite_flows": marts_dir / "bipartite_flows.parquet",
    }

    fact.to_parquet(paths["fact_shipments"], index=False)
    dim_exp.to_parquet(paths["dim_exporter_month"], index=False)
    dim_imp.to_parquet(paths["dim_importer_month"], index=False)
    flows.to_parquet(paths["bipartite_flows"], index=False)

    return paths
