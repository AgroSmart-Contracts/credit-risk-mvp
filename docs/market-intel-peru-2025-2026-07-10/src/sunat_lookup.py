"""
SUNAT RUC lookup shim.

Given a Peruvian RUC (11 digits), fetch registration information from
the free public API and return a normalized result. Cached locally to
`marts/sunat_cache/{ruc}.json` so we call the API at most once per RUC.

Provides the CRAM Dim A "years in business" and "estado/condicion" values
that customs-vintage cannot supply.

Fail-safe: if the API is unreachable or the RUC unknown, return a
NEEDS_INPUT result and record the failure — never fabricate.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict
from datetime import date, datetime
from pathlib import Path


CACHE_DIR = Path("marts/sunat_cache")
CACHE_TTL_DAYS = 30
V1_URL_TEMPLATE = "https://api.apis.net.pe/v1/ruc?numero={ruc}"      # free, basic fields only
V2_URL_TEMPLATE = "https://api.apis.net.pe/v2/sunat/ruc?numero={ruc}"  # includes fechaInscripcion, needs token
API_TOKEN_ENV = "APIS_NET_PE_TOKEN"
USER_AGENT = "trumarket-market-intel/0.1"
REQUEST_TIMEOUT_SEC = 10


@dataclass
class SunatRecord:
    ruc: str
    resolved: bool
    razon_social: str | None
    estado: str | None                # ACTIVO / SUSPENSION TEMPORAL / BAJA DEFINITIVA
    condicion: str | None             # HABIDO / NO HABIDO
    fecha_inscripcion: str | None     # ISO date "YYYY-MM-DD"
    years_in_business: float | None   # (as_of - fecha_inscripcion) / 365.25
    ubigeo: str | None
    direccion: str | None
    tipo: str | None
    actividad_economica: str | None
    fetched_at: str
    source: str
    error: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def _cache_path(ruc: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{ruc}.json"


def _load_cache(ruc: str) -> dict | None:
    p = _cache_path(ruc)
    if not p.exists():
        return None
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    fetched = datetime.fromisoformat(data.get("fetched_at", "1970-01-01"))
    age_days = (datetime.now() - fetched).days
    if age_days > CACHE_TTL_DAYS:
        return None
    return data


def _save_cache(ruc: str, data: dict) -> None:
    with open(_cache_path(ruc), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _parse_fecha(s: str | None) -> str | None:
    if not s:
        return None
    m = re.match(r"(\d{2})[/\-](\d{2})[/\-](\d{4})", str(s))
    if m:
        d, mth, y = m.groups()
        return f"{y}-{mth}-{d}"
    m = re.match(r"(\d{4})[/\-](\d{2})[/\-](\d{2})", str(s))
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _years_between(iso_date: str | None, as_of: date) -> float | None:
    if not iso_date:
        return None
    try:
        d = datetime.fromisoformat(iso_date).date()
    except (ValueError, TypeError):
        return None
    return round((as_of - d).days / 365.25, 2)


def _http_get_json(url: str, token: str | None = None) -> dict:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
        return json.loads(resp.read().decode("utf-8"))


def sunat_lookup(
    ruc: str,
    as_of: str | date | None = None,
    force_refresh: bool = False,
) -> SunatRecord:
    """Return a normalized SUNAT record for the given RUC. Cached for CACHE_TTL_DAYS."""
    ruc = str(ruc).strip()
    if not re.fullmatch(r"\d{11}", ruc):
        return SunatRecord(
            ruc=ruc, resolved=False, razon_social=None, estado=None, condicion=None,
            fecha_inscripcion=None, years_in_business=None, ubigeo=None, direccion=None,
            tipo=None, actividad_economica=None,
            fetched_at=datetime.now().isoformat(timespec="seconds"),
            source="local-validation", error="not-a-valid-11-digit-ruc",
        )

    as_of_date = date.fromisoformat(as_of) if isinstance(as_of, str) else (as_of or date.today())

    if not force_refresh:
        cached = _load_cache(ruc)
        if cached:
            years = _years_between(cached.get("fecha_inscripcion"), as_of_date)
            cached["years_in_business"] = years
            return SunatRecord(**{k: cached.get(k) for k in SunatRecord.__dataclass_fields__.keys()})

    token = os.environ.get(API_TOKEN_ENV)
    # Prefer v2 (full fields) if a token is available; else fall back to v1 (basic fields, free).
    url = V2_URL_TEMPLATE.format(ruc=ruc) if token else V1_URL_TEMPLATE.format(ruc=ruc)
    api_tier = "v2" if token else "v1"
    error_note: str | None = None

    def _to_record(raw: dict, source: str) -> SunatRecord:
        fecha_iso = _parse_fecha(raw.get("fechaInscripcion") or raw.get("fecha_inscripcion"))
        return SunatRecord(
            ruc=ruc, resolved=True,
            razon_social=raw.get("razonSocial") or raw.get("nombre") or raw.get("razon_social"),
            estado=raw.get("estado"),
            condicion=raw.get("condicion"),
            fecha_inscripcion=fecha_iso,
            years_in_business=_years_between(fecha_iso, as_of_date),
            ubigeo=raw.get("ubigeo"),
            direccion=(raw.get("direccion") or "").strip() or None,
            tipo=raw.get("tipo") or raw.get("tipoContribuyente"),
            actividad_economica=raw.get("actividadEconomica") or raw.get("actividad_economica"),
            fetched_at=datetime.now().isoformat(timespec="seconds"),
            source=source,
            error=(None if fecha_iso else "no-fecha_inscripcion-in-free-tier (v1 basic; set APIS_NET_PE_TOKEN for full data)"),
        )

    try:
        raw = _http_get_json(url, token=token)
        rec = _to_record(raw, source=f"apis.net.pe {api_tier} ({url})")
    except urllib.error.HTTPError as e:
        rec = SunatRecord(
            ruc=ruc, resolved=False, razon_social=None, estado=None, condicion=None,
            fecha_inscripcion=None, years_in_business=None, ubigeo=None, direccion=None,
            tipo=None, actividad_economica=None,
            fetched_at=datetime.now().isoformat(timespec="seconds"),
            source=url, error=f"http-{e.code}",
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        rec = SunatRecord(
            ruc=ruc, resolved=False, razon_social=None, estado=None, condicion=None,
            fecha_inscripcion=None, years_in_business=None, ubigeo=None, direccion=None,
            tipo=None, actividad_economica=None,
            fetched_at=datetime.now().isoformat(timespec="seconds"),
            source=url, error=f"{type(e).__name__}: {e}",
        )

    _save_cache(ruc, rec.as_dict())
    return rec


def sunat_years_in_business_pts(years: float | None) -> tuple[int | None, str]:
    """Apply CRAM v3.3 Dim A years-in-business rule (Buyer & Supplier: >=10y+15, >=5y+10, >=2y+5, <2y penalty)."""
    if years is None:
        return None, "NEEDS_INPUT"
    if years >= 10:
        return 15, "STRONG"
    if years >= 5:
        return 10, "GOOD"
    if years >= 2:
        return 5, "OK"
    return -10, "NEW_ENTITY"
