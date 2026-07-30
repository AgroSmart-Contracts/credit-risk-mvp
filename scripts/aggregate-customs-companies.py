#!/usr/bin/env python3
"""
Aggregate Veritrade + Datasur customs shipments into per-company profiles
used by the sandbox counterparty scorer.

Sources (credit-risk-mvp/docs + Desktop):
  - Veritrade_UL-20111724_PE_E_20260109105908(new).csv  (blueberries HS 0810)
  - Veritrade_UL-20111724_PE_E_20260109110033.xlsx      (coffee HS 0901)
  - 10843_20260128213854_20260128213855.xlsx           (Datasur)

Output: src/data/customs-company-aggregates.json
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError as e:
    raise SystemExit("openpyxl required: pip install openpyxl") from e

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DESKTOP = Path.home() / "Desktop"
OUT = ROOT / "src" / "data" / "customs-company-aggregates.json"

SOURCES = [
    DOCS / "Veritrade_UL-20111724_PE_E_20260109105908(new).csv",
    DESKTOP / "Veritrade_UL-20111724_PE_E_20260109105908(new).csv",
    DOCS / "Veritrade_UL-20111724_PE_E_20260109110033.xlsx",
    DOCS / "10843_20260128213854_20260128213855.xlsx",
]


def company_group_key(raw: str) -> str:
    s = (raw or "").strip().upper()
    s = re.sub(r"[ÃÂ]", "", s)
    # Align with scripts/lib/company-name.ts companyGroupKey
    aliases = {
        "AGRO SMART CONTRACTS, LDA.": "AGRO SMART CONTRACTS LDA",
        "AGRO SMART CONTRACTS": "AGRO SMART CONTRACTS LDA",
        "AGROSMART CONTRACTS LDA": "AGRO SMART CONTRACTS LDA",
        "TRU MARKET BLOCKCHAIN S.A.C": "TRU MARKET BLOCKCHAIN S.A.C.",
        "TRU MARKET BLOCKCHAIN": "TRU MARKET BLOCKCHAIN S.A.C.",
        "BIO FARMING PERU S.A.C": "BIO FARMING PERU S.A.C.",
        "BIO FARMIN PERU S.A.C": "BIO FARMING PERU S.A.C.",
        "LIMAX SP ZOO": "LIMAX SP. Z O.O.",
        "LIMAX SP. Z O.O": "LIMAX SP. Z O.O.",
        "EAGLE TRADING AGRICULTURE MARKETING LTD.": "EAGLE TRADING AGRICULTURE MARKETING LTD",
        "A.S.M INTERNATIONAL": "A.S.M INTERNATIONAL",
        "ASM INTERNATIONAL FSSAI": "A.S.M INTERNATIONAL",
        "ALLIED TRADE GLOBAL CORP": "ALLIED TRADE GLOBAL",
        "HOLY FRUIT PERU": "HOLY FRUIT PERU",
        "AGRICOLA VINASOL SAC": "AGRICOLA VIÑASOL SAC",
    }
    if s in aliases:
        s = aliases[s]
    s = s.replace(",", "").replace(".", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_number(val) -> float:
    if val is None or val == "":
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "")
    if not s or s.lower() in {"nan", "none"}:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val.date()
    if hasattr(val, "year"):
        return val
    s = str(val).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


class Agg:
    __slots__ = (
        "name",
        "roles",
        "rucs",
        "kg_net",
        "fob_usd",
        "shipments",
        "dest_countries",
        "dest_ports",
        "origin_offices",
        "partners",
        "dates",
        "sources",
    )

    def __init__(self, name: str):
        self.name = name
        self.roles = set()
        self.rucs = set()
        self.kg_net = 0.0
        self.fob_usd = 0.0
        self.shipments = 0
        self.dest_countries = set()
        self.dest_ports = set()
        self.origin_offices = set()
        self.partners = set()
        self.dates = []
        self.sources = set()


def ensure_agg(store: dict, key: str, display: str) -> Agg:
    if key not in store:
        store[key] = Agg(display.strip() or key)
    return store[key]


def add_shipment(
    store: dict,
    *,
    exporter: str,
    importer: str,
    exporter_ruc: str,
    kg_net: float,
    fob: float,
    dest_country: str,
    dest_port: str,
    origin_office: str,
    date,
    source: str,
):
    exp_key = company_group_key(exporter)
    imp_key = company_group_key(importer)
    if exp_key:
        a = ensure_agg(store, exp_key, exporter)
        a.roles.add("exporter")
        if exporter_ruc:
            a.rucs.add(str(exporter_ruc).strip())
        a.kg_net += kg_net
        a.fob_usd += fob
        a.shipments += 1
        if dest_country:
            a.dest_countries.add(dest_country.strip().upper())
        if dest_port:
            a.dest_ports.add(dest_port.strip().upper())
        if origin_office:
            a.origin_offices.add(origin_office.strip().upper())
        if imp_key:
            a.partners.add(imp_key)
        if date:
            a.dates.append(date)
        a.sources.add(source)
    if imp_key:
        a = ensure_agg(store, imp_key, importer)
        a.roles.add("importer")
        a.kg_net += kg_net
        a.fob_usd += fob
        a.shipments += 1
        if dest_country:
            a.dest_countries.add(dest_country.strip().upper())
        if dest_port:
            a.dest_ports.add(dest_port.strip().upper())
        if origin_office:
            a.origin_offices.add(origin_office.strip().upper())
        if exp_key:
            a.partners.add(exp_key)
        if date:
            a.dates.append(date)
        a.sources.add(source)


def load_veritrade_csv(path: Path, store: dict):
    raw = path.read_bytes().replace(b"\x00", b"")
    text = raw.decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    header_idx = next(i for i, ln in enumerate(lines) if ln.startswith("Partida Aduanera"))
    reader = csv.DictReader(lines[header_idx:])
    n = 0
    for row in reader:
        add_shipment(
            store,
            exporter=row.get("Exportador") or "",
            importer=row.get("Importador") or "",
            exporter_ruc=str(row.get("Cod. Tributario") or ""),
            kg_net=parse_number(row.get("Kg Neto")),
            fob=parse_number(row.get("U$ FOB Tot")),
            dest_country=row.get("Pais de Destino") or "",
            dest_port=row.get("Puerto de destino") or "",
            origin_office=row.get("Aduana") or "",
            date=parse_date(row.get("Fecha")),
            source=path.name,
        )
        n += 1
    print(f"  {path.name}: {n} rows")


def load_veritrade_xlsx(path: Path, store: dict):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = None
    header_idx = -1
    for i, row in enumerate(rows):
        if row and row[0] == "Partida Aduanera":
            header = [str(c) if c is not None else "" for c in row]
            header_idx = i
            break
    if not header:
        wb.close()
        print(f"  {path.name}: no header found")
        return
    idx = {name: i for i, name in enumerate(header)}

    def cell(row, name):
        i = idx.get(name)
        return row[i] if i is not None and i < len(row) else None

    n = 0
    for row in rows:
        if not row or row[0] is None:
            continue
        add_shipment(
            store,
            exporter=str(cell(row, "Exportador") or ""),
            importer=str(cell(row, "Importador") or ""),
            exporter_ruc=str(cell(row, "Cod. Tributario") or ""),
            kg_net=parse_number(cell(row, "Kg Neto")),
            fob=parse_number(cell(row, "U$ FOB Tot")),
            dest_country=str(cell(row, "Pais de Destino") or ""),
            dest_port=str(cell(row, "Puerto de destino") or ""),
            origin_office=str(cell(row, "Aduana") or ""),
            date=parse_date(cell(row, "Fecha")),
            source=path.name,
        )
        n += 1
    wb.close()
    print(f"  {path.name}: {n} rows (header at {header_idx})")


def load_datasur_xlsx(path: Path, store: dict):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb["Datasur"] if "Datasur" in wb.sheetnames else wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    idx = {str(name): i for i, name in enumerate(header) if name is not None}

    def cell(row, name):
        i = idx.get(name)
        return row[i] if i is not None and i < len(row) else None

    n = 0
    for row in rows:
        if not row:
            continue
        year = cell(row, "AÑO")
        month = cell(row, "MES")
        day = cell(row, "DIA")
        date = None
        try:
            if year and month and day:
                date = datetime(int(year), int(month), int(day)).date()
        except (TypeError, ValueError):
            date = None
        add_shipment(
            store,
            exporter=str(cell(row, "EXPORTADOR") or ""),
            importer=str(cell(row, "CONSIGNATARIO") or ""),
            exporter_ruc=str(cell(row, "RUC") or ""),
            kg_net=parse_number(cell(row, "PESO NETO")),
            fob=parse_number(cell(row, "US$ FOB")),
            dest_country=str(cell(row, "PAÍS DE DESTINO") or cell(row, "PAIS DE DESTINO") or ""),
            dest_port=str(cell(row, "PUERTO DE DESTINO") or ""),
            origin_office=str(cell(row, "ADUANA") or ""),
            date=date,
            source=path.name,
        )
        n += 1
    wb.close()
    print(f"  {path.name}: {n} rows")


def months_span(dates) -> float | None:
    if not dates:
        return None
    dmin, dmax = min(dates), max(dates)
    days = (dmax - dmin).days
    return round(days / 30.44, 2)


def main():
    store: dict[str, Agg] = {}
    seen_paths = set()
    print("Ingesting customs…")
    for path in SOURCES:
        if not path.exists():
            print(f"  skip missing {path}")
            continue
        # Prefer docs copy over Desktop duplicate of the same CSV
        resolved = path.resolve()
        if resolved in seen_paths:
            print(f"  skip duplicate {path.name}")
            continue
        # Also skip Desktop CSV if docs CSV already loaded (same content)
        if path.name.endswith("(new).csv") and any(
            p.name.endswith("(new).csv") for p in seen_paths
        ):
            print(f"  skip duplicate {path.name}")
            continue
        seen_paths.add(resolved)
        if path.suffix.lower() == ".csv":
            load_veritrade_csv(path, store)
        elif "10843" in path.name:
            load_datasur_xlsx(path, store)
        else:
            load_veritrade_xlsx(path, store)

    companies = []
    for key, a in sorted(store.items(), key=lambda kv: -kv[1].shipments):
        # Exporter route diversity = distinct destination countries
        # Importer route diversity = distinct origin offices (loading corridors)
        route_count = (
            len(a.dest_countries)
            if "exporter" in a.roles
            else len(a.origin_offices) or len(a.dest_ports) or len(a.dest_countries)
        )
        active_months = months_span(a.dates)
        mt = a.kg_net / 1000.0
        monthly_usd = None
        if active_months and active_months >= 1:
            monthly_usd = a.fob_usd / active_months
        elif a.fob_usd > 0:
            monthly_usd = a.fob_usd / 12.0
        companies.append(
            {
                "key": key,
                "name": a.name,
                "roles": sorted(a.roles),
                "rucs": sorted(a.rucs),
                "shipments": a.shipments,
                "kgNet": round(a.kg_net, 2),
                "fobUsd": round(a.fob_usd, 2),
                "volumeMt": round(mt, 3),
                "routeCount": route_count,
                "partnerCount": len(a.partners),
                "destCountries": sorted(a.dest_countries),
                "activityMonths": active_months,
                "monthlyFobUsd": round(monthly_usd, 2) if monthly_usd is not None else None,
                "sources": sorted(a.sources),
            }
        )

    payload = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "sourceFiles": [p.name for p in seen_paths],
        "companyCount": len(companies),
        "companies": companies,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(companies)} companies → {OUT}")


if __name__ == "__main__":
    main()
