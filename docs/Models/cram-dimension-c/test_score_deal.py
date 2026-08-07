#!/usr/bin/env python3
"""Contract tests for the runtime interface. Run before shipping any engine change."""
import subprocess, json, sys
def call(d):
    p=subprocess.run([sys.executable,"score_deal.py"],input=json.dumps(d),capture_output=True,text=True)
    return p.returncode, json.loads(p.stdout)
CASES=[
 ("HFF lane, traveller variety scores",
  {"pol":"PECLL","pod":"TWKHH","mode":"OCEAN","commodity":"Fresh Blueberries","variety":"Sekoya Pop"},
  lambda c,r: c==0 and r["score"]==59 and not r["veto"]),
 ("same lane, Europe variety vetoes",
  {"pol":"PECLL","pod":"TWKHH","mode":"OCEAN","commodity":"Fresh Blueberries","variety":"Ventura"},
  lambda c,r: c==0 and r["veto"] and r["score"] is None),
 ("dirty alias resolves (platform's own bad string)",
  {"pol":"Callao, Chile","pod":"Malaga, China","mode":"OCEAN","commodity":"Fresh Blueberries"},
  lambda c,r: c==0),
 ("ocean to an airport is rejected, not scored",
  {"pol":"PECLL","pod":"MAD","mode":"OCEAN","commodity":"Fresh Blueberries"},
  lambda c,r: c==2 and "mode-invalid" in r["error"]),
 ("air from a seaport is rejected",
  {"pol":"PECLL","pod":"TLV","mode":"AIR","commodity":"Fresh Blueberries"},
  lambda c,r: c==2),
 ("4 air stops vetoes per AC ruling",
  {"pol":"LIM","pod":"TLV","mode":"AIR","stops":4,"commodity":"Fresh Blueberries"},
  lambda c,r: c==0 and r["veto"] and "stops" in r["veto_reason"]),
 ("3 air stops still executable",
  {"pol":"LIM","pod":"TLV","mode":"AIR","stops":3,"commodity":"Fresh Blueberries"},
  lambda c,r: c==0 and not r["veto"]),
 ("stop monotonicity holds",
  None, None),
 ("unclassified variety flags its fallback",
  {"pol":"PECLL","pod":"TWKHH","mode":"OCEAN","commodity":"Fresh Blueberries","variety":"Madeira"},
  lambda c,r: c==0 and "UNCLASSIFIED" in r["shelf_life_source"]),
 ("unknown node fails loudly",
  {"pol":"PECLL","pod":"NOWHERE","mode":"OCEAN","commodity":"Fresh Blueberries"},
  lambda c,r: c==2 and "unknown POD" in r["error"]),
 ("unknown commodity fails loudly",
  {"pol":"PECLL","pod":"TWKHH","mode":"OCEAN","commodity":"Fresh Unicorn"},
  lambda c,r: c==2),
]
fails=0
for name,deal,check in CASES:
    if deal is None:
        s=[call({"pol":"LIM","pod":"TLV","mode":"AIR","stops":n,"commodity":"Fresh Blueberries"})[1] for n in range(4)]
        sc=[x["score"] for x in s]; ok=all(b<=a for a,b in zip(sc,sc[1:]))
        print(f"  {'PASS' if ok else 'FAIL'}  {name}  {sc}"); fails+=not ok; continue
    c,r=call(deal); ok=check(c,r)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if not ok: print(f"        exit={c} {r}"); fails+=1
print(f"\n{len(CASES)-fails}/{len(CASES)} passed")
sys.exit(1 if fails else 0)
