#!/usr/bin/env python3
"""CRAM Dimension C (Trade-Route) scoring engine v2.
Point values traced to bcp-cram-architecture-2026-07-12.md §4.B/§6.2. Base 70.
Replaces the hand-maintained route-risk-given-commodity-by-mode CSV.
"""
import pandas as pd, numpy as np, itertools, sys

BASE = 70
FLAG_PTS   = {"LOW": 12, "MED": 3, "HIGH": -15}
STOP_PTS   = {0: 0, 1: -5, 2: -12, 3: -25}          # AIR only. >=4 => VETO (AC 2026-07-30)
HUB_DWELL  = {0: 0.0, 1: 0.5, 2: 1.0, 3: 1.5}
MAX_STOPS  = 3
CT_MISSING = -5          # cold-treatment protocol required by market but absent
RULE_35D   = 35          # AC 2026-07-09: ocean >35d floors perishables at HIGH

def transit_points(eff_days, shelf_days, perish_class):
    """Spec §4.B transit bands, expressed against shelf-life headroom."""
    if perish_class == "NON_PERISHABLE":
        return 12 if eff_days <= 30 else (-8 if eff_days > 60 else 4)
    ratio = eff_days / shelf_days
    if ratio <= 0.25: return 14
    if ratio <= 0.45: return 6
    if ratio <= 0.65: return -2
    if ratio <= 0.85: return -10
    return -20

def score(lane, com, stops=0, cold_treatment_ok=True, shelf_override=None):
    """shelf_override: variety-level shelf life (varieties.csv) replaces the commodity baseline."""
    mode = lane["mode"]
    if mode == "AIR" and stops > MAX_STOPS:
        return dict(score=None, veto=True, reason=f"AIR {stops} stops > {MAX_STOPS} (AC ruling)")
    dwell = HUB_DWELL.get(stops, 0) if mode == "AIR" else 0
    eff = lane["transit_days_p90"] + dwell + lane["customs_days"]
    shelf = shelf_override if shelf_override else com["shelf_life_days"]
    if eff >= shelf:
        return dict(score=None, veto=True, reason=f"effective transit {eff:.1f}d >= shelf life {shelf}d")
    flag = lane["corridor_flag"]
    if (mode == "OCEAN" and lane["transit_days_p50"] > RULE_35D
            and com["perish_class"] in ("PERISHABLE", "ULTRA")):
        flag = "HIGH"
    pts = (transit_points(eff, shelf, com["perish_class"])
           + (STOP_PTS.get(stops, 0) if mode == "AIR" else 0)
           + FLAG_PTS[flag]
           + com["perish_points"]
           + (0 if cold_treatment_ok else CT_MISSING))
    return dict(score=int(np.clip(BASE + pts, 0, 100)), veto=False,
                reason="", eff_days=round(eff, 1), headroom=round(shelf - eff, 1), flag=flag)

def build(nodes_f="nodes.csv", lanes_f="lanes.csv", com_f="commodities.csv"):
    nodes = pd.read_csv(nodes_f).set_index("node_id")
    lanes = pd.read_csv(lanes_f)
    coms  = pd.read_csv(com_f)
    rows = []
    for _, L in lanes.iterrows():
        pol, pod = nodes.loc[L.pol_node], nodes.loc[L.pod_node]
        # INVARIANT 1 - mode validity
        for n, side in ((pol, "POL"), (pod, "POD")):
            ok = n.node_type == "BOTH" or (n.node_type == "AIRPORT") == (L["mode"] == "AIR")
            assert ok, f"MODE-INVALID: {L.lane_id} {side} {n['name']} is {n.node_type} but lane is {L['mode']}"
        for _, C in coms.iterrows():
            stop_range = range(0, MAX_STOPS + 2) if L["mode"] == "AIR" else [0]
            for s in stop_range:
                r = score(L, C, stops=s)
                rows.append(dict(lane_id=L.lane_id, pol=pol["name"], pod=pod["name"],
                    pol_code=pol["code"], pod_code=pod["code"], country=pod["country_iso"],
                    mode=L["mode"], stops=s if L["mode"] == "AIR" else None,
                    commodity=C.commodity, perish_class=C.perish_class,
                    score="VETO" if r["veto"] else r["score"], veto_reason=r["reason"],
                    eff_days=r.get("eff_days"), headroom_days=r.get("headroom"),
                    corridor_flag=r.get("flag"), exists=L.exists_evidence,
                    transit_evidence=L.transit_evidence))
    return pd.DataFrame(rows)

def build_variety_table(commodity="Fresh Blueberries"):
    """lane x variety decision table - variety overrides the commodity shelf life."""
    nodes=pd.read_csv("nodes.csv").set_index("node_id"); lanes=pd.read_csv("lanes.csv")
    C=pd.read_csv("commodities.csv"); C=C[C.commodity==commodity].iloc[0]
    V=pd.read_csv("varieties.csv"); V=V[V.shelf_life_days.notna()]
    rows=[]
    for _,L in lanes.iterrows():
        pod=nodes.loc[L.pod_node]
        for _,vr in V.iterrows():
            for s in (range(0,MAX_STOPS+2) if L["mode"]=="AIR" else [0]):
                r=score(L,C,stops=s,shelf_override=vr.shelf_life_days)
                rows.append(dict(lane_id=L.lane_id,pod=pod["name"],country=pod["country_iso"],mode=L["mode"],
                    stops=s if L["mode"]=="AIR" else None,variety=vr.variety,variety_class=vr.ac_class,
                    shelf_life_days=int(vr.shelf_life_days),score="VETO" if r["veto"] else r["score"],
                    eff_days=r.get("eff_days"),headroom_days=r.get("headroom"),veto_reason=r["reason"]))
    return pd.DataFrame(rows)

if __name__ == "__main__":
    t = build()
    t.to_csv("route-risk-table-v2.csv", index=False)
    print(f"rows: {len(t)}   lanes: {t.lane_id.nunique()}   commodities: {t.commodity.nunique()}")
    print(f"veto rows: {(t.score=='VETO').sum()}")
    vt = build_variety_table()
    vt.to_csv("route-risk-blueberry-by-variety.csv", index=False)
    print(f"variety table: {len(vt)} rows / {vt.variety.nunique()} varieties")
