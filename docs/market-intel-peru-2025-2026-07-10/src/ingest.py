"""
Veritrade (Peru) customs-export Excel ingestion.

Handles any HS-heading file that follows the standard Veritrade layout:
  row 0-4  banner (HS partida, period, record count)
  row 5    column headers (33 columns, fixed order)
  row 6+   shipment-level data

Output: a typed pandas DataFrame with snake_case English columns, plus
derived fields (usd_per_kg_net, year, month, week, hs_heading, source_file).
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook

RAW_COLUMNS = [
    "hs_code",
    "hs_description",
    "customs_office",
    "dua",
    "date",
    "exporter_ruc",
    "exporter_name",
    "importer_name",
    "kg_gross",
    "kg_net",
    "qty1",
    "unit1",
    "qty2",
    "unit2",
    "fob_usd",
    "fob_usd_per_unit1",
    "fob_usd_per_unit2",
    "destination_country",
    "destination_port",
    "last_shipping_port",
    "transport_mode",
    "port_agent",
    "customs_broker",
    "commercial_description",
    "description_1",
    "description_2",
    "description_3",
    "description_4",
    "description_5",
    "shipping_line",
    "freight_forwarder_origin",
    "freight_forwarder_destination",
    "customs_channel",
]

NUMERIC_COLS = [
    "kg_gross",
    "kg_net",
    "qty1",
    "qty2",
    "fob_usd",
    "fob_usd_per_unit1",
    "fob_usd_per_unit2",
]

STRING_COLS_UPPER = [
    "customs_office",
    "exporter_name",
    "importer_name",
    "destination_country",
    "destination_port",
    "last_shipping_port",
    "transport_mode",
    "shipping_line",
    "freight_forwarder_origin",
    "freight_forwarder_destination",
    "port_agent",
    "customs_broker",
]


def _read_banner(path: Path) -> dict:
    """Parse the first two rows of the Veritrade sheet to extract HS heading and period."""
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    banner_cells = []
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=3, values_only=True)):
        banner_cells.extend([str(c) for c in row if c is not None])
        if i >= 2:
            break
    wb.close()
    banner = " | ".join(banner_cells)

    hs_match = re.search(r"\[Partida\]\s*(\d{2,10})", banner)
    hs_heading = hs_match.group(1) if hs_match else None

    period_match = re.search(
        r"DE\s+([A-Z]{3})\.?-?(\d{4})\s+A\s+([A-Z]{3})\.?-?(\d{4})", banner
    )
    period = None
    if period_match:
        period = {
            "start_month": period_match.group(1),
            "start_year": int(period_match.group(2)),
            "end_month": period_match.group(3),
            "end_year": int(period_match.group(4)),
        }
    return {"hs_heading": hs_heading, "period": period, "banner_raw": banner}


def _coerce_numeric(s: pd.Series) -> pd.Series:
    """Coerce a column to float. Handles strings with commas or dots as thousand separators."""
    if pd.api.types.is_numeric_dtype(s):
        return s.astype("float64")
    cleaned = (
        s.astype(str)
        .str.strip()
        .replace({"": None, "nan": None, "None": None})
    )
    return pd.to_numeric(cleaned, errors="coerce")


def load_veritrade_file(path: str | Path) -> tuple[pd.DataFrame, dict]:
    """
    Load one Veritrade Excel file into a typed DataFrame.

    Returns (df, metadata) where metadata carries the parsed HS heading, period,
    and source-file provenance.
    """
    path = Path(path)
    meta = _read_banner(path)
    meta["source_file"] = path.name

    df = pd.read_excel(path, sheet_name=0, header=5)

    if df.shape[1] != len(RAW_COLUMNS):
        raise ValueError(
            f"Unexpected column count: got {df.shape[1]}, expected {len(RAW_COLUMNS)}. "
            f"Veritrade layout may have changed."
        )

    df.columns = RAW_COLUMNS

    df = df.dropna(how="all").reset_index(drop=True)

    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)

    for c in NUMERIC_COLS:
        df[c] = _coerce_numeric(df[c])

    for c in STRING_COLS_UPPER:
        df[c] = df[c].astype("string").str.strip().str.upper()

    df["exporter_ruc"] = df["exporter_ruc"].astype("string").str.strip()
    df["hs_code"] = df["hs_code"].astype("string").str.strip()

    df["hs_heading"] = meta.get("hs_heading")
    df["source_file"] = meta["source_file"]

    df["usd_per_kg_net"] = df["fob_usd"] / df["kg_net"].where(df["kg_net"] > 0)
    df["year"] = df["date"].dt.year.astype("Int64")
    df["month"] = df["date"].dt.to_period("M").astype("string")
    df["week"] = df["date"].dt.to_period("W").astype("string")

    return df, meta


def data_quality_report(df: pd.DataFrame) -> pd.DataFrame:
    """Compact per-column QC: null count, unique count, dtype."""
    rows = []
    for c in df.columns:
        rows.append(
            {
                "column": c,
                "dtype": str(df[c].dtype),
                "nulls": int(df[c].isna().sum()),
                "null_pct": round(df[c].isna().mean() * 100, 2),
                "unique": int(df[c].nunique(dropna=True)),
            }
        )
    return pd.DataFrame(rows)


def write_snapshot(df: pd.DataFrame, marts_dir: str | Path, meta: dict) -> Path:
    """Write a per-file Parquet snapshot into marts/raw_snapshots/."""
    marts_dir = Path(marts_dir)
    out_dir = marts_dir / "raw_snapshots"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(meta["source_file"]).stem
    out_path = out_dir / f"{stem}.parquet"
    df.to_parquet(out_path, index=False)
    return out_path


# ---------------------------------------------------------------------------
# Alternative-source loader (raw SUNAT / DrawbackPro-style extract)
# Different column names, no banner rows, DIA/MES/AÑO split. Maps to the same
# canonical schema so downstream layers don't care about the source format.
# ---------------------------------------------------------------------------

ALT_COLUMN_MAP = {
    "PARTIDA ARANCELARIA": "hs_code",
    "DESCRIPCIÓN ARANCELARIA": "hs_description",
    "ADUANA": "customs_office",
    "RUC": "exporter_ruc",
    "EXPORTADOR": "exporter_name",
    "CONSIGNATARIO": "importer_name",
    "PESO BRUTO": "kg_gross",
    "PESO NETO": "kg_net",
    "CANTIDAD": "qty1",
    "UNIDAD MEDIDA": "unit1",
    "CANTIDAD COMERCIAL": "qty2",
    "UNIDAD COMERCIAL": "unit2",
    "US$ FOB": "fob_usd",
    "US$ FOB UNIT": "fob_usd_per_unit1",
    "PAÍS DE DESTINO": "destination_country",
    "PUERTO DE DESTINO": "destination_port",
    "VÍA DE TRANSPORTE": "transport_mode",
    "AGENTE DE ADUANA": "customs_broker",
    "EMPRESA DE TRANSPORTE": "shipping_line",
    "AGENTE DE CARGA EN ORIGEN": "freight_forwarder_origin",
    "PRODUCTO": "commercial_description",
    "DESCRIPCIÓN COMERCIAL 1": "description_1",
    "DESCRIPCIÓN COMERCIAL 2": "description_2",
    "DESCRIPCIÓN COMERCIAL 3": "description_3",
    "DESCRIPCIÓN COMERCIAL 4": "description_4",
}


def _detect_format(path: Path) -> str:
    """Peek at the first row to distinguish Veritrade banner vs alt raw extract."""
    df = pd.read_excel(path, sheet_name=0, nrows=1, header=None)
    first_cells = [str(c) for c in df.iloc[0].values if pd.notna(c)]
    joined = " | ".join(first_cells).upper()
    if "PERU - EXPORTACIONES" in joined or "[PARTIDA]" in joined:
        return "veritrade"
    if "DIA" in first_cells and "MES" in first_cells and "AÑO" in first_cells:
        return "alt_sunat"
    return "unknown"


def load_alt_source_file(path: str | Path) -> tuple[pd.DataFrame, dict]:
    """
    Load a raw-SUNAT / DrawbackPro-style Excel export and map it to the canonical
    fact schema. HS heading is derived from the first 4 digits of the HS code
    column (banner is absent in this format).
    """
    path = Path(path)
    df = pd.read_excel(path, sheet_name=0)

    missing = [c for c in ALT_COLUMN_MAP if c not in df.columns]
    if missing:
        raise ValueError(f"Alt-format file missing expected columns: {missing[:5]}")

    df = df.rename(columns=ALT_COLUMN_MAP)

    # Compose date from DIA + MES + AÑO
    df["date"] = pd.to_datetime(
        dict(year=df["AÑO"], month=df["MES"], day=df["DIA"]),
        errors="coerce",
    )

    # Compose DUA from DUA + SERIE
    if "SERIE" in df.columns:
        df["dua"] = df["DUA"].astype(str).str.strip() + "-" + df["SERIE"].astype(str).str.strip()
    else:
        df["dua"] = df["DUA"].astype(str).str.strip()

    # Fields present in canonical schema but not in alt source
    for c in ("fob_usd_per_unit2", "last_shipping_port", "port_agent",
              "freight_forwarder_destination", "customs_channel", "description_5"):
        if c not in df.columns:
            df[c] = pd.NA

    for c in RAW_COLUMNS:
        if c not in df.columns:
            df[c] = pd.NA
    df = df[RAW_COLUMNS].copy()

    for c in NUMERIC_COLS:
        df[c] = _coerce_numeric(df[c])
    for c in STRING_COLS_UPPER:
        df[c] = df[c].astype("string").str.strip().str.upper()
    df["exporter_ruc"] = df["exporter_ruc"].astype("string").str.strip()
    df["hs_code"] = df["hs_code"].astype("string").str.strip()

    df = df.dropna(subset=["hs_code"]).reset_index(drop=True)

    # Derive HS heading (first 4 digits, padding leading zero if the source dropped it)
    hs_heading = None
    if len(df):
        sample = df["hs_code"].dropna().iloc[0] if df["hs_code"].notna().any() else ""
        s = sample.zfill(10) if len(sample) < 10 else sample
        hs_heading = s[:4]
    df["hs_heading"] = hs_heading
    df["source_file"] = path.name

    df["usd_per_kg_net"] = df["fob_usd"] / df["kg_net"].where(df["kg_net"] > 0)
    df["year"] = df["date"].dt.year.astype("Int64")
    df["month"] = df["date"].dt.to_period("M").astype("string")
    df["week"] = df["date"].dt.to_period("W").astype("string")

    meta = {
        "hs_heading": hs_heading,
        "period": None,
        "source_file": path.name,
        "banner_raw": "(alt raw-SUNAT source, no banner)",
    }
    return df, meta


def load_file(path: str | Path) -> tuple[pd.DataFrame, dict]:
    """Auto-detect and load either Veritrade or alt-source format."""
    path = Path(path)
    fmt = _detect_format(path)
    if fmt == "veritrade":
        return load_veritrade_file(path)
    if fmt == "alt_sunat":
        return load_alt_source_file(path)
    raise ValueError(f"Unrecognized file format for {path.name}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m src.ingest <path/to/file.xlsx> [<marts_dir>]")

    src = sys.argv[1]
    marts = sys.argv[2] if len(sys.argv) > 2 else "marts"

    df, meta = load_file(src)
    out = write_snapshot(df, marts, meta)
    print(f"loaded {len(df):,} rows | HS heading {meta['hs_heading']} | -> {out}")
