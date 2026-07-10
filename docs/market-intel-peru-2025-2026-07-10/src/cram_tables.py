"""
CRAM v0.1 reference-table loader.

Reads the JSON config at config/cram_tables_v0.1.json and exposes the lookups
that route_intelligence (and any future D4 consumer) needs.

Design contract (per project-cram-reference-tables memory):
  - Encode lookup values only. Rationale text lives in the vault.
  - Table is the *prior*; actual booking data overrides it.
  - Missing row -> NEEDS_INPUT (do not fabricate).
  - Every consumer records `table_version` alongside `engine_version`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path

from unidecode import unidecode


def _norm(s: str) -> str:
    """Accent-strip + uppercase + trim so 'PAÍSES BAJOS' and 'PAISES BAJOS' match."""
    return unidecode(str(s)).upper().strip()

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "cram_tables_v0.1.json"


@lru_cache(maxsize=4)
def load_tables(config_path: str | Path = None) -> dict:
    p = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@dataclass
class ProductLookup:
    commodity: str
    group: int | None
    perishability_class: str | None
    perishability_pts: int | None
    season_window: str | None
    is_open_item: bool
    resolved: bool

    def as_dict(self) -> dict:
        return asdict(self)


def product_lookup(commodity: str, tables: dict = None) -> ProductLookup:
    t = tables or load_tables()
    c = commodity.upper()
    per = t["perishability"].get(c)
    group = t["commodity_to_group"].get(c)
    season = t["season_windows"].get(c)
    if per is None:
        return ProductLookup(
            commodity=c, group=group, perishability_class=None, perishability_pts=None,
            season_window=season, is_open_item=False, resolved=False,
        )
    return ProductLookup(
        commodity=c, group=group,
        perishability_class=per["class"], perishability_pts=per["pts"],
        season_window=season, is_open_item=bool(per.get("open", False)), resolved=True,
    )


@dataclass
class RouteLookup:
    corridor_key: str
    destination_country: str
    corridor_default_flag: str | None
    ocean_transit_days_typ: list | None
    direct_ocean: bool | None
    predominant_transport: str | None         # "AIR" | "OCEAN" | None
    cold_treatment_required: bool | None
    customs_norm_days: object | None
    corridor_confirmed: bool
    thirty_five_day_rule_triggers: bool
    air_cold_treatment_stack_triggers: bool
    pair_flag: str | None
    pair_confirmed: bool
    pair_reason_short: str | None
    effective_flag: str | None                # final C4 signal after all rules
    effective_pts: int | None                 # CRAM pts for effective flag
    driver: str                               # AIR_COLD_TREATMENT_STACK | 35D_RULE | PAIR_OVERRIDE | CORRIDOR_DEFAULT | NEEDS_INPUT
    caveats: list

    def as_dict(self) -> dict:
        return asdict(self)


def _flag_pts(flag: str, tables: dict) -> int | None:
    if not flag:
        return None
    return tables["flag_to_cram_pts"].get(flag)


def _typ_transit_max(corridor: dict) -> int | None:
    t = corridor.get("ocean_transit_days_typ")
    if not t:
        return None
    if isinstance(t, list):
        return max(t)
    return int(t)


def route_lookup(
    destination_country: str,
    commodity: str | None = None,
    tables: dict = None,
) -> RouteLookup:
    """
    Return the authoritative C4 route-risk flag for a PE-origin corridor.

    Precedence (matches Table 3 rule + 35-day rule):
      1. If corridor's typical ocean transit > 35d AND commodity is a
         perishable G1-G3 fresh -> effective flag floors at HIGH.
      2. Else if a Product x Market pair row exists -> pair flag wins.
      3. Else -> corridor default.
      4. If nothing matches -> NEEDS_INPUT.
    """
    t = tables or load_tables()
    dest = _norm(destination_country)
    corridor_key = f"PE->{dest}"
    # Accent-tolerant lookup: try normalized, then normalize all keys and match
    corridor = t["corridor_defaults"].get(corridor_key)
    if corridor is None:
        for k, v in t["corridor_defaults"].items():
            if _norm(k) == corridor_key:
                corridor = v
                corridor_key = k
                break

    pl = product_lookup(commodity, t) if commodity else None
    group = pl.group if pl else None
    caveats = []

    is_perishable_fresh = bool(pl and pl.resolved and pl.group and pl.group in [1, 2, 3])

    # Rule 1: air-cold-treatment stack (independent of ocean transit).
    air_cold_treatment_triggers = bool(
        corridor
        and is_perishable_fresh
        and (corridor.get("predominant_transport") == "AIR")
        and corridor.get("cold_treatment_required")
    )

    # Rule 2: 35-day ocean rule.
    thirty_five_triggers = False
    if corridor and is_perishable_fresh:
        typ_max = _typ_transit_max(corridor)
        # Only applies when the corridor is actually shipped by ocean; skip pure-air corridors.
        if corridor.get("predominant_transport") != "AIR":
            if typ_max and typ_max > t["rules"]["perishable_ocean_transit_ceiling_days"]:
                thirty_five_triggers = True

    pair_key = f"G{group}|{dest}" if group else None
    pair = t["product_x_market_pairs"].get(pair_key) if pair_key else None
    if pair is None and pair_key:
        for k, v in t["product_x_market_pairs"].items():
            if _norm(k) == pair_key:
                pair = v
                break

    corridor_default_flag = corridor["flag"] if corridor else None
    pair_flag = pair["flag"] if pair else None

    effective_flag = None
    driver = "NEEDS_INPUT"
    if air_cold_treatment_triggers:
        effective_flag = t["rules"]["air_cold_treatment_stack_floor_flag"]
        driver = "AIR_COLD_TREATMENT_STACK"
        if pair_flag and pair_flag != effective_flag:
            caveats.append(f"Pair flag {pair_flag} would apply; air+cold-treatment stack rule reaches the same floor.")
    elif thirty_five_triggers:
        effective_flag = t["rules"]["perishable_ocean_transit_floor_flag"]
        driver = "35D_RULE"
        if pair_flag and pair_flag != effective_flag:
            caveats.append(f"Pair flag {pair_flag} superseded by 35-day rule floor.")
    elif pair_flag:
        effective_flag = pair_flag
        driver = "PAIR_OVERRIDE"
    elif corridor_default_flag:
        effective_flag = corridor_default_flag
        driver = "CORRIDOR_DEFAULT"
    else:
        caveats.append(f"No corridor row for PE->{dest} and no pair row for group {group}. Add a table entry or supply manually.")

    if pl and pl.is_open_item:
        caveats.append(f"{pl.commodity} perishability class is an open item in v0.1 tables ({pl.perishability_class}).")

    if corridor and not corridor.get("confirmed"):
        caveats.append("Corridor transit/customs figures are PROPOSED (public logistics norms). Verify against TM's own BL data before final scoring.")

    if pair and not pair.get("confirmed"):
        caveats.append("Pair flag is PROPOSED (not yet AC-confirmed).")

    return RouteLookup(
        corridor_key=corridor_key,
        destination_country=dest,
        corridor_default_flag=corridor_default_flag,
        ocean_transit_days_typ=corridor.get("ocean_transit_days_typ") if corridor else None,
        direct_ocean=corridor.get("direct_ocean") if corridor else None,
        predominant_transport=corridor.get("predominant_transport") if corridor else None,
        cold_treatment_required=corridor.get("cold_treatment_required") if corridor else None,
        customs_norm_days=corridor.get("customs_norm_days") if corridor else None,
        corridor_confirmed=bool(corridor and corridor.get("confirmed")),
        thirty_five_day_rule_triggers=thirty_five_triggers,
        air_cold_treatment_stack_triggers=air_cold_treatment_triggers,
        pair_flag=pair_flag,
        pair_confirmed=bool(pair and pair.get("confirmed")),
        pair_reason_short=pair.get("reason_short") if pair else None,
        effective_flag=effective_flag,
        effective_pts=_flag_pts(effective_flag, t) if effective_flag else None,
        driver=driver,
        caveats=caveats,
    )


def table_version(tables: dict = None) -> str:
    return (tables or load_tables())["version"]
