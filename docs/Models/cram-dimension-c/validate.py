#!/usr/bin/env python3
"""Invariant tests for CRAM Dimension C v2. Non-zero exit = build must not ship."""
import pandas as pd, sys
t = pd.read_csv("route-risk-table-v2.csv"); nodes = pd.read_csv("nodes.csv").set_index("node_id")
lanes = pd.read_csv("lanes.csv"); fails = []

# I1 - mode validity (also asserted at build time)
nt = dict(zip(nodes["code"], nodes["node_type"]))
for _, r in t.iterrows():
    for c in (r.pol_code, r.pod_code):
        if nt.get(c) not in ("BOTH", None) and (nt.get(c) == "AIRPORT") != (r["mode"] == "AIR"):
            fails.append(f"I1 mode-invalid: {r.lane_id} {c}")

# I2 - stop monotonicity: more stops never scores higher
air = t[(t["mode"] == "AIR") & (t.score != "VETO")].copy()
air["score"] = air.score.astype(int)
for (lane, com), g in air.groupby(["lane_id", "commodity"]):
    s = g.sort_values("stops").score.tolist()
    if any(b > a for a, b in zip(s, s[1:])):
        fails.append(f"I2 non-monotonic: {lane} {com} {s}")

# I3 - air must not score below ocean on the same POD country when air is faster
oc = t[(t["mode"] == "OCEAN") & (t.score != "VETO")].copy(); oc["score"] = oc.score.astype(int)
a0 = air[air.stops == 0]
for _, a in a0.iterrows():
    m = oc[(oc.country == a.country) & (oc.commodity == a.commodity)]
    for _, o in m.iterrows():
        if a.eff_days < o.eff_days and a.score < o.score:
            fails.append(f"I3 air<ocean though faster: {a.country}/{a.commodity} air {a.score}@{a.eff_days}d vs ocean {o.score}@{o.eff_days}d")

# I4 - veto ruling honoured
bad = t[(t["mode"] == "AIR") & (t.stops >= 4) & (t.score != "VETO")]
if len(bad): fails.append(f"I4 {len(bad)} rows with >=4 air stops not vetoed")

print(f"checked {len(t)} rows / {t.lane_id.nunique()} lanes")
if fails:
    print(f"\n{len(fails)} FAILURES"); [print("  -", f) for f in fails[:20]]; sys.exit(1)
print("\nALL INVARIANTS PASS")
print("  I1 mode validity        OK")
print("  I2 stop monotonicity    OK")
print("  I3 air>=ocean if faster OK")
print("  I4 >=4 air stops veto   OK")
