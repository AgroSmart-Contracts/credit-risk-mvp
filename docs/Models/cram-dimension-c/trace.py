#!/usr/bin/env python3
"""Explain one (lane x commodity) score line by line."""
import pandas as pd, sys
from score_route import score, transit_points, BASE, FLAG_PTS, STOP_PTS, HUB_DWELL, RULE_35D
nodes=pd.read_csv("nodes.csv").set_index("node_id"); lanes=pd.read_csv("lanes.csv"); coms=pd.read_csv("commodities.csv")
def trace(lane_id, commodity, stops=0):
    L=lanes[lanes.lane_id==lane_id].iloc[0]; C=coms[coms.commodity==commodity].iloc[0]
    pol,pod=nodes.loc[L.pol_node],nodes.loc[L.pod_node]
    print(f"\n{'='*66}\n{pol['name']} ({pol['code']}) -> {pod['name']} ({pod['code']})  ·  {L['mode']}")
    print(f"{commodity}   [{C.perish_class}, shelf life {C.shelf_life_days}d]")
    print('='*66)
    dwell=HUB_DWELL.get(stops,0) if L['mode']=='AIR' else 0
    eff=L.transit_days_p90+dwell+L.customs_days
    print(f"  transit p50 {L.transit_days_p50}d   p90 {L.transit_days_p90}d  ({L.transit_evidence})")
    print(f"+ customs                {L.customs_days}d")
    if L['mode']=='AIR': print(f"+ hub dwell ({stops} stops)     {dwell}d")
    print(f"= EFFECTIVE TRANSIT     {eff}d      vs shelf life {C.shelf_life_days}d")
    print(f"  headroom              {C.shelf_life_days-eff:+.1f}d")
    r=score(L,C,stops=stops)
    if r['veto']:
        print(f"\n  >>> GATE 1 FAILED: {r['reason']}")
        print(f"  >>> SCORE = VETO\n"); return
    flag=L.corridor_flag; note=""
    if L['mode']=='OCEAN' and L.transit_days_p50>RULE_35D and C.perish_class in ('PERISHABLE','ULTRA'):
        flag="HIGH"; note=f"  (floored by 35-day rule; corridor default was {L.corridor_flag})"
    tp=transit_points(eff,C.shelf_life_days,C.perish_class)
    sp=STOP_PTS.get(stops,0) if L['mode']=='AIR' else 0
    print(f"\n  base                            {BASE:>4}")
    print(f"  transit   ratio {eff/C.shelf_life_days:.2f}          {tp:>+4}")
    if L['mode']=='AIR': print(f"  stops     {stops}                     {sp:>+4}")
    print(f"  flag      {flag:<9}             {FLAG_PTS[flag]:>+4}{note}")
    print(f"  perish    {C.perish_class:<14}    {C.perish_points:>+4}")
    print(f"  {'-'*36}\n  SCORE                           {r['score']:>4}\n")
if __name__=="__main__":
    trace("PECLL-TWKHH-O","Fresh Blueberries")
