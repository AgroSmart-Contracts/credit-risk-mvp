#!/usr/bin/env python3
"""CRAM Dimension C · runtime interface. JSON in, JSON out.

  echo '{"pol":"PECLL","pod":"TWKHH","mode":"OCEAN","commodity":"Fresh Blueberries",
         "variety":"Sekoya Pop"}' | python3 score_deal.py

Node:
  const { execFileSync } = require("node:child_process");
  const out = JSON.parse(execFileSync("python3", ["score_deal.py"],
                { input: JSON.stringify(deal), cwd: DIM_C_DIR }));

Exit 0 = scored or vetoed (both valid outcomes; check `veto`).
Exit 2 = bad input (unknown node, mode-invalid lane, missing commodity). Never guesses.
"""
import sys, json, numpy as np, pandas as pd
from score_route import score, MAX_STOPS

def fail(msg, code=2):
    print(json.dumps({"error": msg, "score": None, "veto": None}), flush=True); sys.exit(code)

def resolve_node(nodes, key):
    k = str(key).strip().upper()
    for nid, r in nodes.iterrows():
        if k in (str(nid).upper(), str(r["code"]).upper(), str(r["name"]).upper()): return nid, r
        if k in [a.strip().upper() for a in str(r["aliases"]).split("|")]: return nid, r
    return None, None

def main():
    try: deal = json.load(sys.stdin)
    except Exception as e: fail(f"invalid JSON: {e}")
    nodes = pd.read_csv("nodes.csv").set_index("node_id")
    lanes = pd.read_csv("lanes.csv"); coms = pd.read_csv("commodities.csv")
    vars_ = pd.read_csv("varieties.csv")

    for f in ("pol", "pod", "mode", "commodity"):
        if not deal.get(f): fail(f"missing required field: {f}")
    mode = str(deal["mode"]).upper()
    if mode not in ("OCEAN", "AIR"): fail(f"mode must be OCEAN or AIR, got {deal['mode']}")

    pol_id, pol = resolve_node(nodes, deal["pol"])
    pod_id, pod = resolve_node(nodes, deal["pod"])
    if pol is None: fail(f"unknown POL: {deal['pol']}")
    if pod is None: fail(f"unknown POD: {deal['pod']}")
    for n, side in ((pol, "POL"), (pod, "POD")):
        if n["node_type"] != "BOTH" and (n["node_type"] == "AIRPORT") != (mode == "AIR"):
            fail(f"mode-invalid: {side} {n['name']} is {n['node_type']}, lane is {mode}")

    L = lanes[(lanes.pol_node == pol_id) & (lanes.pod_node == pod_id) & (lanes["mode"] == mode)]
    if L.empty: fail(f"no lane for {pol['name']} -> {pod['name']} by {mode}")
    L = L.iloc[0]

    C = coms[coms.commodity == deal["commodity"]]
    if C.empty: fail(f"unknown commodity: {deal['commodity']}")
    C = C.iloc[0]

    shelf_src, shelf = "commodity_baseline", None
    if deal.get("variety"):
        V = vars_[vars_.variety.str.lower() == str(deal["variety"]).strip().lower()]
        if V.empty:
            shelf_src = "variety_UNKNOWN_fell_back_to_commodity"
        elif pd.isna(V.iloc[0].shelf_life_days):
            shelf_src = f"variety_UNCLASSIFIED({V.iloc[0].variety})_fell_back_to_commodity"
        else:
            shelf = float(V.iloc[0].shelf_life_days)
            shelf_src = f"variety:{V.iloc[0].variety}/{V.iloc[0].ac_class}"

    stops = int(deal.get("stops", 0) or 0)
    if mode == "OCEAN" and stops: stops = 0   # stops are air-only (AC ruling)
    r = score(L, C, stops=stops, cold_treatment_ok=deal.get("cold_treatment_ok", True),
              shelf_override=shelf)

    def clean(o):
        if isinstance(o,(np.integer,)): return int(o)
        if isinstance(o,(np.floating,)): return float(o)
        if isinstance(o,(np.bool_,)): return bool(o)
        if pd.isna(o) if not isinstance(o,(list,dict,str)) else False: return None
        return o
    print(json.dumps({
        "score": r["score"], "veto": r["veto"], "veto_reason": r["reason"] or None,
        "lane_id": L.lane_id, "pol": pol["name"], "pod": pod["name"], "mode": mode,
        "stops": stops if mode == "AIR" else None,
        "commodity": C.commodity, "shelf_life_days": shelf or int(C.shelf_life_days),
        "shelf_life_source": shelf_src,
        "effective_transit_days": r.get("eff_days"), "headroom_days": r.get("headroom"),
        "corridor_flag": r.get("flag"),
        "transit_evidence": L.transit_evidence, "lane_exists_evidence": L.exists_evidence,
        "engine_version": "dimension-c-v2", "max_air_stops": MAX_STOPS,
    }, indent=2, default=clean))

if __name__ == "__main__":
    main()
