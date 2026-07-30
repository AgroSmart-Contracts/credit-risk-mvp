"""
Analysis library — CRAM-feed functions built on the marts.

Origin = Peru (implicit). Peru-side view only for now; multi-country
generalization deferred until other-origin Veritrade files land.

First function: `price_benchmark(variety, destination_country, deal_week, ...)`
returns the kg-weighted percentile bands for the deal's corridor using an
adaptive time-first / volume-guaranteed window. This is the CRAM
Dimension B, variable 2 ("price vs market") lookup.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PERCENTILES = (0.10, 0.25, 0.50, 0.75, 0.90)

# Adaptive-window ladder thresholds
TIER1_WINDOW_WEEKS = 4
TIER1_MIN_SHIPMENTS = 20
TIER1_MIN_EXPORTERS = 3

TIER2_MAX_WEEKS = 12
TIER2_MIN_KG = 100_000

TIER3_MAX_WEEKS = 26

MIN_SHIPMENTS_ANY = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


# Veritrade writes the same destination several ways: with and without accents
# ("ESPANA"/"ESPAÑA", "CANADA"/"CANADÁ"), with a bracketed alternate name
# ("TAIWAN {FORMOSA}", "HONG KONG {CHINA}"), and with a trailing political
# qualifier ("TAIWÁN, PROVINCIA DE CHINA"). Matching the raw column with `==`
# therefore reaches only part of a corridor — measured 2026-07-30, exact-match
# lookups saw 25% of Spain's volume, 68% of the Netherlands' and 10% of
# Canada's, and missed Taiwan, Hong Kong, Brazil, Russia and the UAE outright.
_COUNTRY_QUALIFIERS = re.compile(r",\s*(PROVINCIA DE CHINA|FEDERACION)\b")
_COUNTRY_BRACKETS = re.compile(r"\{[^}]*\}")

# Distinct spellings that survive folding but mean the same country.
_COUNTRY_ALIASES = {
    "RUSIA": "FEDERACION RUSA",
}


def canonical_country(name: str | None) -> str | None:
    """
    Fold a destination-country label to a single comparable token: strip
    accents, bracketed alternates and political qualifiers, uppercase, then
    resolve known aliases. Both sides of every destination comparison must go
    through this — see `_COUNTRY_QUALIFIERS` above for why.
    """
    if name is None:
        return None
    folded = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    folded = folded.upper().strip()
    folded = _COUNTRY_BRACKETS.sub("", folded)
    folded = _COUNTRY_QUALIFIERS.sub("", folded)
    folded = re.sub(r"\s+", " ", folded).strip(" ,")
    if not folded:
        return None
    return _COUNTRY_ALIASES.get(folded, folded)


def _with_canonical_destination(fact: pd.DataFrame) -> pd.DataFrame:
    """Attach the folded destination column used by every corridor filter."""
    if "_destination_canonical" in fact.columns:
        return fact
    fact = fact.copy()
    fact["_destination_canonical"] = [
        canonical_country(x) for x in fact["destination_country"]
    ]
    return fact


def _weighted_quantile(values: np.ndarray, weights: np.ndarray, qs: tuple[float, ...]) -> dict[float, float]:
    """Kg-weighted quantiles. Robust to zero-weight rows."""
    if len(values) == 0:
        return {q: float("nan") for q in qs}
    order = np.argsort(values)
    v = np.asarray(values)[order]
    w = np.asarray(weights)[order]
    total = w.sum()
    if total <= 0:
        return {q: float(np.median(v)) for q in qs}
    cum = np.cumsum(w) / total
    return {q: float(np.interp(q, cum, v)) for q in qs}


def _parse_week(week) -> pd.Period:
    """Accept a pandas Period, an ISO-week string, or a date and normalize to a W-SUN Period."""
    if isinstance(week, pd.Period):
        return week
    if isinstance(week, str):
        try:
            return pd.Period(week, freq="W")
        except Exception:
            return pd.Period(pd.to_datetime(week), freq="W")
    return pd.Period(pd.to_datetime(week), freq="W")


# ---------------------------------------------------------------------------
# Weekly per-corridor rollup mart
# ---------------------------------------------------------------------------


def build_dim_variety_destination_week(fact: pd.DataFrame) -> pd.DataFrame:
    """
    Weekly per-corridor rollup (variety, destination_country, week).
    Used for reporting/time-series views and for fast window-size checks.
    Percentiles here are single-week; multi-week benchmarks are computed
    on demand from the underlying shipments (see price_benchmark).
    """
    f = fact.dropna(subset=["variety", "destination_country", "week"]).copy()
    f = f[f["kg_net"] > 0]

    def _week_stats(g: pd.DataFrame) -> pd.Series:
        qs = _weighted_quantile(
            g["usd_per_kg_net"].to_numpy(),
            g["kg_net"].to_numpy(),
            PERCENTILES,
        )
        return pd.Series(
            {
                "n_shipments": len(g),
                "n_exporters": g["exporter_id"].nunique(),
                "kg_net": g["kg_net"].sum(),
                "fob_usd": g["fob_usd"].sum(),
                "wprice_avg": g["fob_usd"].sum() / g["kg_net"].sum(),
                "p10": qs[0.10],
                "p25": qs[0.25],
                "p50": qs[0.50],
                "p75": qs[0.75],
                "p90": qs[0.90],
            }
        )

    out = (
        f.groupby(["variety", "destination_country", "week"], dropna=False)
        .apply(_week_stats, include_groups=False)
        .reset_index()
    )
    return out


# ---------------------------------------------------------------------------
# Adaptive-window benchmark lookup
# ---------------------------------------------------------------------------


@dataclass
class Benchmark:
    variety: str
    destination_country: str | None
    deal_week: str
    window_start: str
    window_end: str
    window_weeks: int
    n_shipments: int
    n_exporters: int
    kg_shipped: float
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float
    confidence: str
    fallback_note: str | None = None
    deal_price_usd_per_kg: float | None = None
    deal_vs_p50_pct: float | None = None
    deal_vs_p50_band: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def _compute_percentiles(rows: pd.DataFrame) -> dict[float, float]:
    return _weighted_quantile(
        rows["usd_per_kg_net"].to_numpy(),
        rows["kg_net"].to_numpy(),
        PERCENTILES,
    )


def _classify_variance(pct: float) -> str:
    """Bucket the deal variance against CRAM Dim B.2 rule thresholds (v3.3 indicative)."""
    if pct is None or pd.isna(pct):
        return "N/A"
    if -15 <= pct <= 15:
        return "WITHIN_BAND"
    if -30 <= pct < -15 or 15 < pct <= 30:
        return "OUTSIDE_BAND"
    if pct > 30:
        return "OVER_MARKET_FLAG"
    return "UNDER_MARKET_FLAG"


def price_benchmark(
    fact: pd.DataFrame,
    variety: str,
    destination_country: str | None,
    deal_week,
    deal_price_usd_per_kg: float | None = None,
    max_week_available: pd.Period | None = None,
) -> Benchmark:
    """
    Compute the price-vs-market benchmark for a deal at (variety, destination, week).

    Adaptive window ladder:
      1. HIGH   — 4-week trailing, ≥20 shipments and ≥3 exporters
      2. MED    — expand backward up to 12 weeks until ≥100k kg net
      3. LOW    — 26-week window, whatever sample exists
      4. SPARSE — drop destination; variety-only benchmark
      5. NEEDS_INPUT — fewer than 3 shipments even at variety-only

    Window is anchored to the freshest week available in `fact` if the deal
    week is beyond it (typical: Veritrade lags 2-4 weeks behind live deals).

    `destination_country` is compared through `canonical_country()`, so the
    corridor sees every spelling Veritrade uses for it. Before that folding was
    added (2026-07-30) most lookups silently reached tier 4 and priced the deal
    off a variety-only, all-destinations sample: across the 169-deal platform
    book, 67 of 87 resolved benchmarks were SPARSE. With folding, 69 reach the
    tier-1 HIGH window and 1 stays SPARSE.
    """
    deal_week_p = _parse_week(deal_week)

    fact = _with_canonical_destination(fact)
    fact["_week_p"] = pd.PeriodIndex(fact["week"], freq="W")
    fact = fact[fact["kg_net"] > 0]

    destination_canonical = canonical_country(destination_country)

    max_available = max_week_available or fact["_week_p"].max()
    anchor_week = min(deal_week_p - 1, max_available)

    def _window_rows(start: pd.Period, end: pd.Period, dest: str | None) -> pd.DataFrame:
        m = (fact["_week_p"] >= start) & (fact["_week_p"] <= end) & (fact["variety"] == variety)
        if dest is not None:
            m &= fact["_destination_canonical"] == dest
        return fact[m]

    def _package(rows: pd.DataFrame, start: pd.Period, end: pd.Period, dest: str | None, confidence: str, note: str | None = None) -> Benchmark:
        qs = _compute_percentiles(rows)
        n = len(rows)
        window_weeks = int((end - start).n) + 1 if n else 0
        b = Benchmark(
            variety=variety,
            destination_country=dest,
            deal_week=str(deal_week_p),
            window_start=str(start),
            window_end=str(end),
            window_weeks=window_weeks,
            n_shipments=n,
            n_exporters=int(rows["exporter_id"].nunique()) if n else 0,
            kg_shipped=float(rows["kg_net"].sum()) if n else 0.0,
            p10=qs[0.10], p25=qs[0.25], p50=qs[0.50], p75=qs[0.75], p90=qs[0.90],
            confidence=confidence,
            fallback_note=note,
        )
        if deal_price_usd_per_kg is not None and not pd.isna(b.p50):
            variance = (deal_price_usd_per_kg - b.p50) / b.p50 * 100
            b.deal_price_usd_per_kg = float(deal_price_usd_per_kg)
            b.deal_vs_p50_pct = round(variance, 2)
            b.deal_vs_p50_band = _classify_variance(variance)
        return b

    # Tier 1: 4-week fixed window
    start1 = anchor_week - (TIER1_WINDOW_WEEKS - 1)
    rows = _window_rows(start1, anchor_week, destination_canonical)
    if len(rows) >= TIER1_MIN_SHIPMENTS and rows["exporter_id"].nunique() >= TIER1_MIN_EXPORTERS:
        return _package(rows, start1, anchor_week, destination_country, "HIGH")

    # Tier 2: expand week-by-week until cumulative kg ≥ 100k, up to 12 weeks
    for w in range(TIER1_WINDOW_WEEKS + 1, TIER2_MAX_WEEKS + 1):
        start = anchor_week - (w - 1)
        rows = _window_rows(start, anchor_week, destination_canonical)
        if rows["kg_net"].sum() >= TIER2_MIN_KG and len(rows) >= MIN_SHIPMENTS_ANY:
            return _package(rows, start, anchor_week, destination_country, "MED")

    # Tier 3: 26-week window whatever the sample
    start3 = anchor_week - (TIER3_MAX_WEEKS - 1)
    rows = _window_rows(start3, anchor_week, destination_canonical)
    if len(rows) >= MIN_SHIPMENTS_ANY:
        return _package(rows, start3, anchor_week, destination_country, "LOW")

    # Tier 4: drop destination, variety-only
    rows = _window_rows(start3, anchor_week, None)
    if len(rows) >= MIN_SHIPMENTS_ANY:
        return _package(
            rows, start3, anchor_week, None, "SPARSE",
            note=f"Corridor {variety}->{destination_country} too thin; benchmark uses all destinations (variety-only fallback).",
        )

    # Tier 5: nothing
    return Benchmark(
        variety=variety,
        destination_country=destination_country,
        deal_week=str(deal_week_p),
        window_start=str(start3), window_end=str(anchor_week), window_weeks=0,
        n_shipments=0, n_exporters=0, kg_shipped=0.0,
        p10=float("nan"), p25=float("nan"), p50=float("nan"), p75=float("nan"), p90=float("nan"),
        confidence="NEEDS_INPUT",
        fallback_note=f"No usable shipments for {variety} up to {anchor_week} even at variety-only grain.",
        deal_price_usd_per_kg=float(deal_price_usd_per_kg) if deal_price_usd_per_kg is not None else None,
    )


# ---------------------------------------------------------------------------
# counterparty_profile — CRAM Dimension A feed
# ---------------------------------------------------------------------------


@dataclass
class CounterpartyProfile:
    entity_id: str
    entity_side: str                    # "exporter" | "importer"
    entity_name: str | None
    destination_country: str | None     # importers are country-scoped; None for exporters
    as_of: str
    first_seen: str | None
    last_seen: str | None
    vintage_months: int | None          # months from first_seen to as_of
    months_active_12mo: int             # months with >=1 shipment in last 12 months up to as_of
    total_shipments: int
    total_kg_net: float
    total_fob_usd: float
    avg_monthly_kg_last_6mo: float
    avg_monthly_kg_last_12mo: float
    peak_monthly_kg: float
    peak_monthly_kg_month: str | None
    wavg_usd_per_kg: float | None       # kg-weighted avg price
    peru_variety_share_pct: dict        # {variety: share of Peru total kg for that variety}
    variety_mix: list                   # [{"variety": ..., "share_pct": ..., "wavg_usd_kg": ...}]
    top_partners: list                  # [{"partner_id":..., "partner_name":..., "share_pct":...}]
    top_destinations: list | None       # only for exporters
    price_positioning: dict             # per-variety wavg vs Peru wavg -> premium/discount tag
    corridor_positioning: list          # per (variety, destination) wavg vs corridor peers
    activity_consistency: float | None  # months_active_12mo / min(12, vintage_months); 0..1
    consecutive_month_streak: int       # longest unbroken run of months with >=1 shipment
    capacity_check: dict | None         # populated if deal_kg provided
    confidence: str                     # "HIGH" | "MED" | "LOW" | "NO_HISTORY"
    vintage_note: str | None            # honest disclosure when customs vintage isn't a reliable years-in-business proxy
    sunat: dict | None                  # SUNAT lookup: razon_social, estado, condicion, years_in_business, CRAM pts
    d2_years_in_business_pts: int | None
    d2_years_in_business_signal: str | None

    def as_dict(self) -> dict:
        return asdict(self)


def _months_between(a: pd.Timestamp, b: pd.Timestamp) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def _partner_shares(entity_shipments: pd.DataFrame, partner_col_id: str, partner_col_name: str) -> list:
    if entity_shipments["kg_net"].sum() == 0:
        return []
    grp = (
        entity_shipments.groupby([partner_col_id, partner_col_name], dropna=False)["kg_net"]
        .sum()
        .sort_values(ascending=False)
    )
    total = grp.sum()
    out = []
    for (pid, pname), kg in grp.head(5).items():
        out.append({"partner_id": pid, "partner_name": pname, "kg_net": float(kg), "share_pct": round(kg / total * 100, 1)})
    return out


def _variety_mix(entity_shipments: pd.DataFrame) -> list:
    grp = entity_shipments.groupby("variety", dropna=False).agg(kg=("kg_net", "sum"), fob=("fob_usd", "sum")).sort_values("kg", ascending=False)
    total = grp["kg"].sum() or 1.0
    out = []
    for variety, row in grp.iterrows():
        out.append(
            {
                "variety": variety if pd.notna(variety) else "UNCLASSIFIED",
                "share_pct": round(row["kg"] / total * 100, 1),
                "wavg_usd_kg": round(row["fob"] / row["kg"], 3) if row["kg"] else None,
            }
        )
    return out


def _price_positioning(entity_shipments: pd.DataFrame, market_fact: pd.DataFrame) -> dict:
    """Per-variety weighted-avg price of the entity vs Peru's overall weighted-avg for the same variety."""
    out = {}
    market = market_fact[market_fact["kg_net"] > 0]
    market_avg_by_variety = (
        market.groupby("variety", dropna=True)
        .apply(lambda g: (g["fob_usd"].sum() / g["kg_net"].sum()) if g["kg_net"].sum() else None, include_groups=False)
        .to_dict()
    )
    entity_by_variety = (
        entity_shipments.groupby("variety", dropna=True)
        .apply(lambda g: (g["fob_usd"].sum() / g["kg_net"].sum()) if g["kg_net"].sum() else None, include_groups=False)
        .to_dict()
    )
    for variety, entity_avg in entity_by_variety.items():
        market_avg = market_avg_by_variety.get(variety)
        if entity_avg is None or market_avg is None or market_avg == 0:
            continue
        variance_pct = (entity_avg - market_avg) / market_avg * 100
        tag = "PREMIUM" if variance_pct >= 5 else ("DISCOUNT" if variance_pct <= -5 else "AT_MARKET")
        out[variety] = {
            "entity_wavg_usd_kg": round(entity_avg, 3),
            "peru_wavg_usd_kg": round(market_avg, 3),
            "variance_pct": round(variance_pct, 1),
            "position": tag,
        }
    return out


def _corridor_positioning(entity_shipments: pd.DataFrame, market_fact: pd.DataFrame, min_shipments: int = 3) -> list:
    """
    Per-(variety, destination) weighted-avg price of the entity vs the same corridor's Peru wavg.
    Only surfaces corridors where the entity has >= min_shipments — statistical floor.
    """
    market = market_fact[market_fact["kg_net"] > 0]
    market_corridor_avg = (
        market.groupby(["variety", "destination_country"], dropna=True)
        .apply(lambda g: {"peru_wavg": g["fob_usd"].sum() / g["kg_net"].sum(), "peru_kg": g["kg_net"].sum()} if g["kg_net"].sum() else None, include_groups=False)
        .dropna()
        .to_dict()
    )

    out = []
    entity_grp = entity_shipments.dropna(subset=["variety", "destination_country"]).groupby(["variety", "destination_country"])
    for (variety, dest), g in entity_grp:
        n = len(g)
        if n < min_shipments:
            continue
        entity_kg = g["kg_net"].sum()
        if entity_kg == 0:
            continue
        entity_avg = g["fob_usd"].sum() / entity_kg
        m = market_corridor_avg.get((variety, dest))
        if m is None or m["peru_wavg"] == 0:
            continue
        variance_pct = (entity_avg - m["peru_wavg"]) / m["peru_wavg"] * 100
        tag = "PREMIUM" if variance_pct >= 5 else ("DISCOUNT" if variance_pct <= -5 else "AT_MARKET")
        out.append(
            {
                "variety": variety,
                "destination_country": dest,
                "n_shipments": n,
                "entity_kg": float(entity_kg),
                "entity_wavg_usd_kg": round(entity_avg, 3),
                "peru_wavg_usd_kg": round(m["peru_wavg"], 3),
                "corridor_kg_market": float(m["peru_kg"]),
                "entity_share_of_corridor_pct": round(entity_kg / m["peru_kg"] * 100, 2),
                "variance_pct": round(variance_pct, 1),
                "position": tag,
            }
        )
    out.sort(key=lambda x: -x["entity_kg"])
    return out


def _confidence(vintage_months: int | None, months_active_12mo: int, total_shipments: int) -> str:
    if total_shipments == 0:
        return "NO_HISTORY"
    if total_shipments >= 30 and months_active_12mo >= 6:
        return "HIGH"
    if total_shipments >= 10 and months_active_12mo >= 3:
        return "MED"
    return "LOW"


def counterparty_profile(
    fact: pd.DataFrame,
    entity_id: str,
    side: str,
    as_of: str | pd.Timestamp | None = None,
    deal_kg: float | None = None,
    sunat: bool = True,
) -> CounterpartyProfile:
    """
    Profile an exporter (RUC-keyed) or importer (fuzzy-cluster-keyed, country-scoped).
    Retrospective — considers only shipments dated <= as_of.
    """
    if side not in ("exporter", "importer"):
        raise ValueError("side must be 'exporter' or 'importer'")

    if as_of is None:
        as_of_ts = fact["date"].max()
    else:
        as_of_ts = pd.to_datetime(as_of)

    f = fact[fact["date"] <= as_of_ts].copy()

    id_col = "exporter_id" if side == "exporter" else "importer_id"
    name_col = "exporter_canonical_name" if side == "exporter" else "importer_canonical_name"

    entity = f[f[id_col] == entity_id].copy()

    entity_name = entity[name_col].mode().iat[0] if len(entity) else None
    destination_country = None
    if side == "importer" and len(entity):
        destination_country = entity["destination_country"].mode().iat[0]

    if len(entity) == 0:
        return CounterpartyProfile(
            entity_id=entity_id, entity_side=side, entity_name=None,
            destination_country=None, as_of=str(as_of_ts.date()),
            first_seen=None, last_seen=None, vintage_months=None,
            months_active_12mo=0, total_shipments=0, total_kg_net=0.0, total_fob_usd=0.0,
            avg_monthly_kg_last_6mo=0.0, avg_monthly_kg_last_12mo=0.0,
            peak_monthly_kg=0.0, peak_monthly_kg_month=None,
            wavg_usd_per_kg=None, peru_variety_share_pct={},
            variety_mix=[], top_partners=[], top_destinations=None,
            price_positioning={}, corridor_positioning=[],
            activity_consistency=None, consecutive_month_streak=0,
            capacity_check=None, confidence="NO_HISTORY", vintage_note=None,
            sunat=None, d2_years_in_business_pts=None, d2_years_in_business_signal=None,
        )

    first_seen = entity["date"].min()
    last_seen = entity["date"].max()
    vintage_months = _months_between(first_seen, as_of_ts)

    entity["_ym"] = entity["date"].dt.to_period("M")
    monthly_kg = entity.groupby("_ym")["kg_net"].sum().sort_index()

    # last 12 months up to as_of
    as_of_period = pd.Period(as_of_ts, freq="M")
    twelve = pd.period_range(as_of_period - 11, as_of_period, freq="M")
    six = pd.period_range(as_of_period - 5, as_of_period, freq="M")
    monthly_12mo = monthly_kg.reindex(twelve, fill_value=0)
    monthly_6mo = monthly_kg.reindex(six, fill_value=0)
    months_active_12mo = int((monthly_12mo > 0).sum())
    avg_kg_12mo = float(monthly_12mo.mean())
    avg_kg_6mo = float(monthly_6mo.mean())

    peak_month_idx = monthly_kg.idxmax()
    peak_month_kg = float(monthly_kg.max())

    total_kg = float(entity["kg_net"].sum())
    total_fob = float(entity["fob_usd"].sum())
    wavg = total_fob / total_kg if total_kg else None

    # Partners
    if side == "exporter":
        top_partners = _partner_shares(entity, "importer_id", "importer_canonical_name")
        top_destinations = (
            entity.groupby("destination_country")["kg_net"]
            .sum()
            .sort_values(ascending=False)
            .head(5)
            .reset_index()
            .rename(columns={"kg_net": "kg"})
        )
        total_dest_kg = top_destinations["kg"].sum() or 1.0
        top_destinations = [
            {"destination_country": r["destination_country"], "kg_net": float(r["kg"]), "share_pct": round(r["kg"] / total_kg * 100, 1)}
            for _, r in top_destinations.iterrows()
        ]
    else:
        top_partners = _partner_shares(entity, "exporter_id", "exporter_canonical_name")
        top_destinations = None

    variety_mix = _variety_mix(entity)

    # Peru-wide variety share (denominator: whole 2025 file, up to as_of)
    peru_variety_kg = f.groupby("variety", dropna=True)["kg_net"].sum()
    entity_variety_kg = entity.groupby("variety", dropna=True)["kg_net"].sum()
    peru_variety_share_pct = {}
    for v, kg in entity_variety_kg.items():
        peru_kg = peru_variety_kg.get(v, 0)
        if peru_kg > 0:
            peru_variety_share_pct[v] = round(kg / peru_kg * 100, 2)

    price_positioning = _price_positioning(entity, f)
    corridor_positioning = _corridor_positioning(entity, f)

    # Activity consistency + consecutive-month streak
    denom = max(1, min(12, vintage_months))
    activity_consistency = round(months_active_12mo / denom, 3)

    all_months_present = sorted(entity["date"].dt.to_period("M").unique())
    streak = best = 0
    prev = None
    for p in all_months_present:
        if prev is None or p == prev + 1:
            streak += 1
        else:
            streak = 1
        best = max(best, streak)
        prev = p
    consecutive_month_streak = int(best)

    # Vintage-note: honest signal about data scope
    total_months_in_data = int(
        (f["date"].max().to_period("M") - f["date"].min().to_period("M")).n
    ) + 1
    vintage_note = None
    if vintage_months <= 12 and total_months_in_data <= 14:
        vintage_note = (
            f"customs-derived vintage limited to the ingested period "
            f"({total_months_in_data} months). Treat as NEEDS_INPUT for CRAM Dim A "
            f"years-in-business until multi-year files are appended (or use SUNAT lookup)."
        )

    capacity_check = None
    if deal_kg is not None:
        baseline = avg_kg_12mo if avg_kg_12mo > 0 else avg_kg_6mo
        capacity_check = {
            "deal_kg": float(deal_kg),
            "baseline_monthly_kg": round(baseline, 0),
            "deal_vs_baseline_pct": round(deal_kg / baseline * 100, 1) if baseline > 0 else None,
            "peak_monthly_kg": round(peak_month_kg, 0),
            "deal_vs_peak_pct": round(deal_kg / peak_month_kg * 100, 1) if peak_month_kg > 0 else None,
            "flag": _capacity_flag(deal_kg, baseline, peak_month_kg, side),
        }

    return CounterpartyProfile(
        entity_id=entity_id, entity_side=side, entity_name=entity_name,
        destination_country=destination_country, as_of=str(as_of_ts.date()),
        first_seen=str(first_seen.date()), last_seen=str(last_seen.date()),
        vintage_months=vintage_months, months_active_12mo=months_active_12mo,
        total_shipments=len(entity), total_kg_net=total_kg, total_fob_usd=total_fob,
        avg_monthly_kg_last_6mo=round(avg_kg_6mo, 0),
        avg_monthly_kg_last_12mo=round(avg_kg_12mo, 0),
        peak_monthly_kg=round(peak_month_kg, 0),
        peak_monthly_kg_month=str(peak_month_idx),
        wavg_usd_per_kg=round(wavg, 3) if wavg else None,
        peru_variety_share_pct=peru_variety_share_pct,
        variety_mix=variety_mix, top_partners=top_partners,
        top_destinations=top_destinations, price_positioning=price_positioning,
        corridor_positioning=corridor_positioning,
        activity_consistency=activity_consistency,
        consecutive_month_streak=consecutive_month_streak,
        capacity_check=capacity_check,
        confidence=_confidence(vintage_months, months_active_12mo, len(entity)),
        vintage_note=vintage_note,
        sunat=_maybe_sunat(side, entity, entity_id, as_of_ts, sunat),
        d2_years_in_business_pts=(_maybe_sunat(side, entity, entity_id, as_of_ts, sunat) or {}).get("d2_pts"),
        d2_years_in_business_signal=(_maybe_sunat(side, entity, entity_id, as_of_ts, sunat) or {}).get("d2_signal"),
    )


def _maybe_sunat(side: str, entity: pd.DataFrame, entity_id: str, as_of_ts, enabled: bool) -> dict | None:
    """SUNAT lookup only for Peruvian exporters (importers are foreign entities)."""
    if not enabled or side != "exporter":
        return None
    try:
        from src.sunat_lookup import sunat_lookup, sunat_years_in_business_pts
    except ImportError:
        return None
    ruc = entity["exporter_ruc"].dropna().mode()
    if len(ruc) == 0:
        return None
    rec = sunat_lookup(str(ruc.iat[0]), as_of=as_of_ts.date() if hasattr(as_of_ts, "date") else as_of_ts)
    d = rec.as_dict()
    pts, signal = sunat_years_in_business_pts(rec.years_in_business)
    d["d2_pts"] = pts
    d["d2_signal"] = signal
    return d


def _capacity_flag(deal_kg: float, baseline: float, peak: float, side: str) -> str:
    """Aligns with CRAM Dim A capacity rule (Buyer: <=50%/>2x; Supplier: <=30%/>100%)."""
    if baseline <= 0:
        return "NO_BASELINE"
    ratio = deal_kg / baseline
    thresh_low, thresh_high = (0.50, 2.0) if side == "importer" else (0.30, 1.0)
    if ratio <= thresh_low:
        return "WITHIN_CAPACITY"
    if ratio > thresh_high:
        return "OVER_CAPACITY_FLAG"
    return "STRETCH"


# ---------------------------------------------------------------------------
# route_intelligence — CRAM Dimension C feed + commercial_window_alignment
# ---------------------------------------------------------------------------


@dataclass
class RouteIntelligence:
    variety: str
    destination_country: str
    period_label: str
    # Volume & players
    n_shipments: int
    n_exporters: int
    n_importers: int
    kg_net: float
    fob_usd: float
    lane_share_of_variety_pct: float     # this lane's kg / all-destinations kg for the variety
    # Operations
    green_channel_pct: float | None
    orange_channel_pct: float | None
    red_channel_pct: float | None
    transport_mode_mix: dict             # {mode: share_pct}
    # Concentration
    exporter_hhi: float                  # 0-10000; <1500 unconcentrated, >2500 concentrated
    importer_hhi: float
    top_exporters: list                  # top 5 with share_pct
    top_importers: list                  # top 5 with share_pct
    # Seasonality
    monthly_kg: dict                     # {"2025-01": kg, ...}
    peak_month: str | None
    off_peak_month: str | None
    peak_off_ratio: float | None         # peak_month_kg / max(off_peak_kg, 1)
    in_season_weeks: list                # ISO week strings where weekly_kg >= 25% of peak week
    # Lane classification + inferred CRAM signal
    lane_maturity: str                   # DEEP | ESTABLISHED | THIN | SPARSE
    # Deal-specific signals (populated if deal_week provided)
    deal_week: str | None
    commercial_window_alignment: str | None   # IN_SEASON | SHOULDER | OFF_SEASON | NEEDS_INPUT
    route_signal_inferred: str                # LOW | MED | HIGH | INSUFFICIENT (customs-derived proxy)
    # Authoritative signal (from CRAM reference tables — Table 3 + 35-day rule)
    route_signal_table: str | None            # HIGH | MED_HIGH | MED | LOW_MED | LOW | NEEDS_INPUT
    route_signal_driver: str | None           # 35D_RULE | PAIR_OVERRIDE | CORRIDOR_DEFAULT | NEEDS_INPUT
    route_signal_pts: int | None              # CRAM Dim C.4 pts for effective flag
    table_version: str | None                 # audit trail
    caveats: list                             # what these signals do NOT include

    def as_dict(self) -> dict:
        return asdict(self)


def _hhi(shares_pct: pd.Series) -> float:
    """Herfindahl-Hirschman Index on percentage shares. Range 0-10000."""
    return float((shares_pct ** 2).sum())


def _lane_maturity(kg: float, n_exp: int, n_imp: int) -> str:
    if kg >= 5_000_000 and n_exp >= 10 and n_imp >= 20:
        return "DEEP"
    if kg >= 500_000 and n_exp >= 3 and n_imp >= 5:
        return "ESTABLISHED"
    if kg >= 50_000 and n_exp >= 2:
        return "THIN"
    return "SPARSE"


def _seasonality(lane: pd.DataFrame) -> tuple[dict, str | None, str | None, float | None, list]:
    """
    Monthly kg rollup, peak/off-peak months, peak/off ratio, and the in-season weeks.
    Off-peak excludes sub-1MT months (sample-shipment artifacts) so the ratio stays
    informative on lanes that mix real commerce with the odd sample container.
    Returns ratio=None if fewer than 3 real commercial months.
    """
    if lane.empty:
        return {}, None, None, None, []
    monthly = lane.groupby("month")["kg_net"].sum().sort_index()
    monthly_dict = {str(k): float(v) for k, v in monthly.items()}
    peak_month = str(monthly.idxmax())

    commercial = monthly[monthly >= 1000]           # months with >=1 MT
    if len(commercial) >= 3:
        off_peak_month = str(commercial.idxmin())
        off_kg = float(commercial.min())
        peak_kg = float(monthly.max())
        ratio = peak_kg / off_kg
    else:
        off_peak_month = str(monthly.idxmin())
        ratio = None                                # too thin to characterise a season

    weekly = lane.groupby("week")["kg_net"].sum().sort_index()
    peak_week_kg = float(weekly.max()) if len(weekly) else 0.0
    in_season = [str(w) for w, v in weekly.items() if v >= 0.25 * peak_week_kg]
    return monthly_dict, peak_month, off_peak_month, ratio, in_season


def _commercial_window_alignment(deal_week: str, in_season_weeks: list, weekly_kg: pd.Series) -> str:
    if deal_week is None:
        return None
    if not in_season_weeks or weekly_kg.empty:
        return "NEEDS_INPUT"
    if deal_week in in_season_weeks:
        return "IN_SEASON"
    peak_week_kg = float(weekly_kg.max())
    week_kg = float(weekly_kg.get(deal_week, 0.0))
    if week_kg >= 0.10 * peak_week_kg:
        return "SHOULDER"
    return "OFF_SEASON"


def _route_signal(lane_maturity: str, green_pct: float | None, window: str | None) -> str:
    if lane_maturity == "SPARSE":
        return "HIGH"
    if lane_maturity in ("DEEP", "ESTABLISHED"):
        if green_pct is not None and green_pct >= 90 and (window is None or window in ("IN_SEASON", None)):
            return "LOW"
        if green_pct is not None and green_pct >= 70:
            return "MED"
        return "MED"
    return "MED"


def route_intelligence(
    fact: pd.DataFrame,
    variety: str,
    destination_country: str,
    deal_week=None,
) -> RouteIntelligence:
    """
    Per-lane summary: volume, players, concentration, ops (customs channel + mode),
    seasonality, and an inferred CRAM Dim C route signal.
    Origin is Peru (implicit).
    """
    f = _with_canonical_destination(fact[fact["kg_net"] > 0])
    lane = f[
        (f["variety"] == variety)
        & (f["_destination_canonical"] == canonical_country(destination_country))
    ]

    # Authoritative table lookup (works even when the lane is empty)
    from src.cram_tables import route_lookup, table_version
    tbl = route_lookup(destination_country=destination_country, commodity=variety)

    if lane.empty:
        return RouteIntelligence(
            variety=variety, destination_country=destination_country,
            period_label=f"{f['date'].min().date()} .. {f['date'].max().date()}",
            n_shipments=0, n_exporters=0, n_importers=0, kg_net=0.0, fob_usd=0.0,
            lane_share_of_variety_pct=0.0,
            green_channel_pct=None, orange_channel_pct=None, red_channel_pct=None,
            transport_mode_mix={},
            exporter_hhi=0.0, importer_hhi=0.0, top_exporters=[], top_importers=[],
            monthly_kg={}, peak_month=None, off_peak_month=None, peak_off_ratio=None,
            in_season_weeks=[], lane_maturity="SPARSE",
            deal_week=str(_parse_week(deal_week)) if deal_week is not None else None,
            commercial_window_alignment=None if deal_week is None else "NEEDS_INPUT",
            route_signal_inferred="INSUFFICIENT",
            route_signal_table=tbl.effective_flag,
            route_signal_driver=tbl.driver,
            route_signal_pts=tbl.effective_pts,
            table_version=table_version(),
            caveats=["No shipments in this corridor for the period observed."] + tbl.caveats,
        )

    # Volume metrics
    n_ship = len(lane)
    n_exp = int(lane["exporter_id"].nunique())
    n_imp = int(lane["importer_id"].dropna().nunique())
    kg = float(lane["kg_net"].sum())
    fob = float(lane["fob_usd"].sum())
    total_variety_kg = float(f[f["variety"] == variety]["kg_net"].sum())
    lane_share = kg / total_variety_kg * 100 if total_variety_kg else 0.0

    # Customs channel
    ch = lane["customs_channel"].dropna().str.upper()
    if len(ch):
        green_pct = (ch.str.startswith("VERDE")).mean() * 100
        red_pct = (ch.str.startswith("ROJO")).mean() * 100
        orange_pct = (ch.str.startswith("NARANJA") | ch.str.startswith("ORANGE")).mean() * 100
    else:
        green_pct = red_pct = orange_pct = None

    # Transport mode
    modes = lane["transport_mode"].dropna()
    mode_mix = {str(k): round(v * 100, 1) for k, v in (modes.value_counts(normalize=True)).items()}

    # Concentration
    exp_shares = lane.groupby(["exporter_id", "exporter_canonical_name"])["kg_net"].sum()
    exp_shares_pct = (exp_shares / exp_shares.sum() * 100).sort_values(ascending=False)
    exp_hhi = _hhi(exp_shares_pct)
    top_exp = [
        {"exporter_id": eid, "exporter_name": ename, "share_pct": round(s, 1)}
        for (eid, ename), s in exp_shares_pct.head(5).items()
    ]

    imp = lane.dropna(subset=["importer_id"])
    if len(imp):
        imp_shares = imp.groupby(["importer_id", "importer_canonical_name"])["kg_net"].sum()
        imp_shares_pct = (imp_shares / imp_shares.sum() * 100).sort_values(ascending=False)
        imp_hhi = _hhi(imp_shares_pct)
        top_imp = [
            {"importer_id": iid, "importer_name": iname, "share_pct": round(s, 1)}
            for (iid, iname), s in imp_shares_pct.head(5).items()
        ]
    else:
        imp_hhi = 0.0
        top_imp = []

    # Seasonality
    monthly_dict, peak_m, off_m, peak_off, in_season = _seasonality(lane)
    weekly = lane.groupby("week")["kg_net"].sum().sort_index()

    dw_str = None
    window_alignment = None
    if deal_week is not None:
        dw_str = str(_parse_week(deal_week))
        window_alignment = _commercial_window_alignment(dw_str, in_season, weekly)

    # Lane maturity & inferred signal
    maturity = _lane_maturity(kg, n_exp, n_imp)
    signal = _route_signal(maturity, green_pct, window_alignment)

    caveats = [
        "Customs channel is Peru-side (SUNAT green/orange/red) -- does not capture destination-country customs friction.",
        "route_signal_inferred is derived from lane maturity + Peru-side ops + seasonality. It does NOT include transit ceiling, transshipment norms, resale liquidity, or destination market fragility -- use route_signal_table for authoritative C4.",
    ]
    if maturity == "SPARSE":
        caveats.append("Lane is sparse; treat with caution.")
    if window_alignment == "OFF_SEASON":
        caveats.append("Deal week is off the observed commercial window; verify the deal is not a stock-clearance or opportunistic play.")

    caveats.extend(tbl.caveats)

    return RouteIntelligence(
        variety=variety, destination_country=destination_country,
        period_label=f"{lane['date'].min().date()} .. {lane['date'].max().date()}",
        n_shipments=n_ship, n_exporters=n_exp, n_importers=n_imp, kg_net=kg, fob_usd=fob,
        lane_share_of_variety_pct=round(lane_share, 2),
        green_channel_pct=round(green_pct, 1) if green_pct is not None else None,
        orange_channel_pct=round(orange_pct, 1) if orange_pct is not None else None,
        red_channel_pct=round(red_pct, 1) if red_pct is not None else None,
        transport_mode_mix=mode_mix,
        exporter_hhi=round(exp_hhi, 0), importer_hhi=round(imp_hhi, 0),
        top_exporters=top_exp, top_importers=top_imp,
        monthly_kg=monthly_dict, peak_month=peak_m, off_peak_month=off_m,
        peak_off_ratio=round(peak_off, 1) if peak_off is not None else None,
        in_season_weeks=in_season,
        lane_maturity=maturity,
        deal_week=dw_str,
        commercial_window_alignment=window_alignment,
        route_signal_inferred=signal,
        route_signal_table=tbl.effective_flag,
        route_signal_driver=tbl.driver,
        route_signal_pts=tbl.effective_pts,
        table_version=table_version(),
        caveats=caveats,
    )


# ---------------------------------------------------------------------------
# pair_history — CRAM Dimension D.3 feed
# ---------------------------------------------------------------------------


@dataclass
class PairHistory:
    exporter_id: str
    exporter_name: str | None
    importer_id: str
    importer_name: str | None
    destination_country: str | None
    as_of: str
    first_shipment: str | None
    last_shipment: str | None
    months_since_last: int | None
    n_prior_shipments: int
    n_prior_last_12mo: int
    months_active_together: int
    cumulative_kg_net: float
    cumulative_fob_usd: float
    avg_ticket_kg: float | None
    price_stability_cv: float | None       # coefficient of variation on usd_per_kg_net across pair shipments
    primary_variety: str | None
    primary_destination: str | None
    d3_indicative_pts: int                 # CRAM D.3 point rule application
    relationship_signal: str               # STRONG | MODERATE | WEAK | FIRST_TIME | DISCONTINUED

    def as_dict(self) -> dict:
        return asdict(self)


def _d3_points(n_prior: int) -> int:
    """CRAM v3.3 D.3 point rule."""
    if n_prior >= 10:
        return 15
    if n_prior >= 5:
        return 12
    if n_prior >= 1:
        return 8
    return -12


def _relationship_signal(n_prior: int, months_since_last: int | None, cv: float | None) -> str:
    if n_prior == 0:
        return "FIRST_TIME"
    if months_since_last is not None and months_since_last >= 6:
        return "DISCONTINUED"
    if n_prior >= 5 and (cv is None or cv <= 0.15):
        return "STRONG"
    if n_prior >= 5:
        return "MODERATE"
    if n_prior >= 1:
        return "MODERATE" if (cv is None or cv <= 0.25) else "WEAK"
    return "WEAK"


def pair_history(
    fact: pd.DataFrame,
    exporter_id: str,
    importer_id: str,
    as_of: str | pd.Timestamp | None = None,
) -> PairHistory:
    """
    Repeat-pair evidence from customs — feeds CRAM Dim D.3 as a proxy for
    outside-TM relationship history. Given an exporter+importer, returns
    prior-shipment count, months co-active, cumulative kg/FOB, and a
    price-stability signal (CV of USD/kg across the pair's shipments).
    """
    if as_of is None:
        as_of_ts = fact["date"].max()
    else:
        as_of_ts = pd.to_datetime(as_of)

    f = fact[fact["date"] <= as_of_ts]
    pair = f[(f["exporter_id"] == exporter_id) & (f["importer_id"] == importer_id)]

    def _mode(series):
        m = series.dropna().mode()
        return m.iat[0] if len(m) else None

    exporter_name = _mode(pair["exporter_canonical_name"]) if len(pair) else None
    importer_name = _mode(pair["importer_canonical_name"]) if len(pair) else None
    destination_country = _mode(pair["destination_country"]) if len(pair) else None

    if pair.empty:
        return PairHistory(
            exporter_id=exporter_id, exporter_name=exporter_name,
            importer_id=importer_id, importer_name=importer_name,
            destination_country=destination_country,
            as_of=str(as_of_ts.date()),
            first_shipment=None, last_shipment=None, months_since_last=None,
            n_prior_shipments=0, n_prior_last_12mo=0, months_active_together=0,
            cumulative_kg_net=0.0, cumulative_fob_usd=0.0,
            avg_ticket_kg=None, price_stability_cv=None,
            primary_variety=None, primary_destination=None,
            d3_indicative_pts=_d3_points(0), relationship_signal=_relationship_signal(0, None, None),
        )

    first_ship = pair["date"].min()
    last_ship = pair["date"].max()
    months_since_last = _months_between(last_ship, as_of_ts)

    as_of_period = pd.Period(as_of_ts, freq="M")
    twelve_start = (as_of_period - 11).start_time
    n_last_12mo = int((pair["date"] >= twelve_start).sum())

    months_active_together = int(pair["date"].dt.to_period("M").nunique())

    kg = float(pair["kg_net"].sum())
    fob = float(pair["fob_usd"].sum())
    n = len(pair)
    avg_ticket = kg / n if n else None

    price_series = pair.loc[pair["kg_net"] > 0, "usd_per_kg_net"].replace([float("inf"), -float("inf")], pd.NA).dropna()
    if len(price_series) >= 2 and price_series.mean() != 0:
        cv = float(price_series.std() / price_series.mean())
    else:
        cv = None

    primary_variety = pair.groupby("variety")["kg_net"].sum().idxmax() if pair["variety"].notna().any() else None
    primary_destination = pair.groupby("destination_country")["kg_net"].sum().idxmax()

    return PairHistory(
        exporter_id=exporter_id, exporter_name=exporter_name,
        importer_id=importer_id, importer_name=importer_name,
        destination_country=destination_country,
        as_of=str(as_of_ts.date()),
        first_shipment=str(first_ship.date()), last_shipment=str(last_ship.date()),
        months_since_last=months_since_last,
        n_prior_shipments=n, n_prior_last_12mo=n_last_12mo,
        months_active_together=months_active_together,
        cumulative_kg_net=kg, cumulative_fob_usd=fob,
        avg_ticket_kg=round(avg_ticket, 1) if avg_ticket else None,
        price_stability_cv=round(cv, 3) if cv is not None else None,
        primary_variety=primary_variety, primary_destination=primary_destination,
        d3_indicative_pts=_d3_points(n),
        relationship_signal=_relationship_signal(n, months_since_last, cv),
    )
