"""
Entity resolution for Veritrade shipment data.

Three concerns, kept independent:
  1. Exporter canonicalization (via stable RUC).
  2. Importer canonicalization (fuzzy dedup WITHIN destination country).
  3. Product taxonomy (variety, organic flag, pack format, form) from
     the six free-text description fields.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter

import pandas as pd
from rapidfuzz import fuzz, process
from unidecode import unidecode

# ---------------------------------------------------------------------------
# 1. Exporter canonicalization
# ---------------------------------------------------------------------------


def canonicalize_exporters(df: pd.DataFrame) -> pd.DataFrame:
    """Add `exporter_id` (== RUC) and `exporter_canonical_name` (most-frequent
    variant per RUC). No RUC → fall back to the raw name as its own entity.
    """
    df = df.copy()

    df["exporter_id"] = df["exporter_ruc"].fillna(df["exporter_name"])

    def _most_common(s: pd.Series) -> str:
        vals = s.dropna()
        if vals.empty:
            return None
        return Counter(vals).most_common(1)[0][0]

    canonical_names = (
        df.groupby("exporter_id")["exporter_name"].agg(_most_common).rename("exporter_canonical_name")
    )
    df = df.merge(canonical_names, left_on="exporter_id", right_index=True, how="left")
    return df


# ---------------------------------------------------------------------------
# 2. Importer canonicalization
# ---------------------------------------------------------------------------

_CORP_SUFFIX_PATTERNS = [
    r"\bS\.?\s?A\.?\s?C?\b",           # S.A., SAC, SA
    r"\bE\.?\s?I\.?\s?R\.?\s?L\b",     # EIRL
    r"\bS\.?\s?R\.?\s?L\b",            # SRL
    r"\bLIMITED\b|\bLTD\b|\bLIMITADA\b",
    r"\bINC\b|\bINCORPORATED\b",
    r"\bCORP\b|\bCORPORATION\b",
    r"\bCO\b|\bCOMPANY\b|\bCOMPANIA\b|\bCIA\b",
    r"\bLLC\b|\bL\.?L\.?C\b",
    r"\bGMBH\b|\bMBH\b",
    r"\bAG\b|\bBV\b|\bNV\b|\bKG\b(?!\s*NET)",
    r"\bPTY\b|\bPTE\b",
    r"\bGROUP\b|\bGRUPO\b",
    r"\bHOLDING(S)?\b",
    r"\bINTERNATIONAL\b|\bINTL\b|\bINTERNACIONAL\b",
    r"\bTRADING\b|\bTRADE\b",
    r"\bIMPORT(S|ERS)?\b|\bIMPORTADORA\b",
    r"\bEXPORT(S|ERS)?\b|\bEXPORTADORA\b",
    r"\bDE\s+C\.?\s?V\.?\b",           # SA de CV
]

_CORP_SUFFIX_RE = re.compile("|".join(_CORP_SUFFIX_PATTERNS))


def _normalize_name(name: str | None) -> str:
    """Strip accents, upper, drop punctuation, drop corporate suffixes, collapse whitespace."""
    if not isinstance(name, str) or not name.strip():
        return ""
    s = unidecode(name).upper()
    s = re.sub(r"[^\w\s]", " ", s)
    s = _CORP_SUFFIX_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _cluster_names(names: list[str], threshold: int = 85) -> dict[str, str]:
    """
    Greedy fuzzy clustering. Returns a map from each input name → its cluster head.
    Uses token_set_ratio which handles reorderings and extra tokens well.
    """
    if not names:
        return {}

    unique = list(dict.fromkeys(names))
    unique_sorted = sorted(unique, key=len, reverse=True)

    parent: dict[str, str] = {n: n for n in unique_sorted}

    for i, name in enumerate(unique_sorted):
        if parent[name] != name:
            continue
        candidates = unique_sorted[i + 1 :]
        candidates = [c for c in candidates if parent[c] == c]
        if not candidates:
            continue
        matches = process.extract(
            name,
            candidates,
            scorer=fuzz.token_set_ratio,
            score_cutoff=threshold,
            limit=None,
        )
        for match_name, score, _idx in matches:
            parent[match_name] = name
    return parent


def _short_hash(text: str, n: int = 8) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:n]


def canonicalize_importers(
    df: pd.DataFrame,
    threshold: int = 85,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Fuzzy dedup importer names WITHIN destination_country.

    Composite key: (fuzzy_cluster_head, destination_country) → importer_id (hash).
    Display label: most frequent raw variant in the cluster.

    Returns (df_with_ids, importer_registry).
    """
    df = df.copy()
    df["_importer_norm"] = df["importer_name"].map(_normalize_name)

    cluster_head: dict[tuple[str, str], str] = {}

    for country, group in df.groupby("destination_country", dropna=False):
        norms = [n for n in group["_importer_norm"].unique() if n]
        parent = _cluster_names(norms, threshold=threshold)
        for norm in group["_importer_norm"].unique():
            head = parent.get(norm, norm) if norm else ""
            cluster_head[(norm, country)] = head

    df["_cluster_head"] = [
        cluster_head.get((n, c), n) for n, c in zip(df["_importer_norm"], df["destination_country"])
    ]

    display_label = (
        df[df["_cluster_head"] != ""]
        .groupby(["_cluster_head", "destination_country"])["importer_name"]
        .agg(lambda s: Counter(s.dropna()).most_common(1)[0][0] if len(s.dropna()) else None)
        .rename("importer_canonical_name")
        .reset_index()
    )
    df = df.merge(display_label, on=["_cluster_head", "destination_country"], how="left")

    df["importer_id"] = [
        _short_hash(f"{h}|{c}") if h else pd.NA
        for h, c in zip(df["_cluster_head"], df["destination_country"])
    ]

    registry = (
        df.dropna(subset=["importer_id"])
        .groupby(["importer_id", "importer_canonical_name", "destination_country"], dropna=False)
        .agg(
            shipments=("dua", "count"),
            fob_usd=("fob_usd", "sum"),
            kg_net=("kg_net", "sum"),
            raw_name_variants=("importer_name", lambda s: sorted(set(s.dropna()))),
        )
        .reset_index()
        .sort_values("fob_usd", ascending=False)
    )
    registry["n_raw_variants"] = registry["raw_name_variants"].map(len)

    df = df.drop(columns=["_importer_norm", "_cluster_head"])
    return df, registry


# ---------------------------------------------------------------------------
# 3. Product taxonomy
# ---------------------------------------------------------------------------

VARIETY_KEYWORDS = {
    "BLUEBERRY": [r"\bARANDANO", r"\bBLUEBERR", r"\bBLUE\s+BERRY"],
    "RASPBERRY": [r"\bFRAMBUESA", r"\bRASPBERR"],
    "STRAWBERRY": [r"\bFRESA", r"\bFRUTILLA", r"\bSTRAWBERR"],
    "BLACKBERRY": [r"\bMORA\b", r"\bBLACKBERR"],
    "CRANBERRY": [r"\bARANDANO\s+ROJO", r"\bCRANBERR"],
    "GOOSEBERRY": [r"\bAGUAYMANTO", r"\bGOLDENBERR", r"\bGOOSEBERR", r"\bPHYSALIS"],
    "MANGO": [r"\bMANGO"],
    "PINEAPPLE": [r"\bPINA\b", r"\bPINEAPPLE"],
    "AVOCADO": [r"\bPALTA", r"\bAVOCADO"],
    "CHERRY": [r"\bCEREZA", r"\bCHERRY"],
    "GRAPE": [r"\bUVA\b", r"\bGRAPE"],
    "PASSIONFRUIT": [r"\bMARACUYA", r"\bPASSION"],
    "SOURSOP": [r"\bGUANABANA", r"\bSOURSOP"],
    "CAMU_CAMU": [r"\bCAMU\s+CAMU"],
    "LUCUMA": [r"\bLUCUMA"],
    "MAMEY": [r"\bMAMEY", r"\bSAPOTE"],
    "TAMARIND": [r"\bTAMARINDO", r"\bTAMARIND"],
    "CHERIMOYA": [r"\bCHIRIMOYA", r"\bCHERIMOYA"],
    "COCONA": [r"\bCOCONA"],
    "AGUAJE": [r"\bAGUAJE"],
    # Added 2026-07-28: HS0901 (coffee, 9,784 rows) and HS1801 (cacao, 2,734
    # rows) are already ingested into fact_shipments.parquet but had no
    # variety keyword at all, so price_benchmark()/counterparty_profile()
    # could never find them (Tier 5 NEEDS_INPUT regardless of real sample
    # size). Confirmed against real commercial_description text in the mart:
    # "CAFE VERDE EN GRANO ... GREEN COFFEE BEANS ..." (coffee) and "CACAO EN
    # GRANO ... COCOA BEANS ..." (cacao).
    "COFFEE": [r"\bCAFE\b", r"\bCOFFEE"],
    "CACAO": [r"\bCACAO", r"\bCOCOA"],
}

FORM_KEYWORDS = {
    "IQF": [r"\bIQF\b", r"\bINDIVIDUALLY\s+QUICK\s+FROZEN"],
    "PUREE": [r"\bPURE(E|A)\b", r"\bPULPA"],
    "JUICE": [r"\bJUGO\b", r"\bJUICE\b"],
    "CONCENTRATE": [r"\bCONCENTRA"],
    "WHOLE": [r"\bENTERO", r"\bWHOLE\b"],
    "SLICED": [r"\bREBANAD", r"\bSLICED\b"],
    "DICED": [r"\bDICED\b", r"\bCUBE"],
    "POWDER": [r"\bPOLVO\b", r"\bPOWDER\b"],
}

PACK_KEYWORDS = {
    "CLAMSHELL": [r"\bCLAMSHELL", r"\bCLAM\s+SHELL"],
    "BULK": [r"\bBULK\b", r"\bGRANEL"],
    "BAG": [r"\bBOLSA\b", r"\bBAG\b", r"\bPOUCH"],
    "BOX": [r"\bCAJA\b", r"\bBOX\b", r"\bCARTON"],
    "DRUM": [r"\bTAMBOR\b", r"\bDRUM\b", r"\bCILINDRO"],
}

ORGANIC_PATTERNS = [r"\bORG[AÁ]NIC[OA]?\b", r"\bORGANIC\b", r"\bBIO(?=\s)"]
CONVENTIONAL_PATTERNS = [r"\bCONVENCIONAL\b", r"\bCONVENTIONAL\b"]


def _match_first(patterns_by_label: dict, text: str) -> str | None:
    for label, patterns in patterns_by_label.items():
        for p in patterns:
            if re.search(p, text):
                return label
    return None


def parse_product_taxonomy(df: pd.DataFrame) -> pd.DataFrame:
    """Extract variety, form, pack, organic flag from concatenated description fields."""
    df = df.copy()

    desc_cols = [
        "commercial_description",
        "description_1",
        "description_2",
        "description_3",
        "description_4",
        "description_5",
    ]
    concat = (
        df[desc_cols]
        .fillna("")
        .agg(" ".join, axis=1)
        .map(lambda s: unidecode(s).upper())
    )

    df["variety"] = concat.map(lambda t: _match_first(VARIETY_KEYWORDS, t))
    df["form"] = concat.map(lambda t: _match_first(FORM_KEYWORDS, t))
    df["pack_format"] = concat.map(lambda t: _match_first(PACK_KEYWORDS, t))

    def _organic_flag(t: str) -> str | None:
        if any(re.search(p, t) for p in ORGANIC_PATTERNS):
            return "ORGANIC"
        if any(re.search(p, t) for p in CONVENTIONAL_PATTERNS):
            return "CONVENTIONAL"
        return None

    df["organic_flag"] = concat.map(_organic_flag)
    return df


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def resolve_entities(
    df: pd.DataFrame,
    importer_threshold: int = 85,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Run all three resolution steps and return (enriched_df, importer_registry)."""
    df = canonicalize_exporters(df)
    df, registry = canonicalize_importers(df, threshold=importer_threshold)
    df = parse_product_taxonomy(df)
    return df, registry
