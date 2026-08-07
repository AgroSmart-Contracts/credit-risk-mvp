#!/usr/bin/env python3
"""Extract blueberry varieties + travel profile from a Veritrade PE export book.

  VERITRADE_CSV=/path/to/Veritrade.csv python3 extract_varieties.py

Reads the free-text `Descripcion Comercial` field, pulls whatever follows
VARIEDAD / VARIETY / VAR., canonicalises it, and computes each variety's
observed ocean travel profile. The `max_observed_ocean_d` column is the
empirical shelf-life ceiling: a cargo that ships and sells at N days implies
shelf life > N. Used to sanity-check AC's variety classes in varieties.csv.
"""
import pandas as pd, numpy as np, re, os, sys

SRC = os.environ.get("VERITRADE_CSV")
MIN_KG = 250_000

# free-text variety field: capture after the label, stop at the first boilerplate token
LABEL = re.compile(r"VARIEDAD(?:ES)?\s*:?\s*|VARIETY\s*:?\s*|\bVAR\.\s*")
STOP  = re.compile(r"\b(SE\sACOGE|ACOGE|USO|CAL\b|CALIBRE|CONSUMO|COLD|DRAWBACK|ARANDANO|ARANDANOS"
                   r"|AR NDANOS|BLUEBERR|FRESCO|FRESCOS|CAJAS|EN\b|KG|D\s?S|PARA|HUMANO|ORGANIC"
                   r"|CONVENCIONAL|PESO|NETO|PROPIO|MANILA)\b")
# longest-first: 'SEKOYA POP' must match before 'SEKOYA', 'ABRIL BLUE' before 'ABRIL'
CANON = [("CAROLINA MAGICA","Carolina Magica"),("MAGICA","Magica"),("M GICA","Magica"),
    ("SEKOYA POP","Sekoya Pop"),("SEKOYA BEAUTY","Sekoya Beauty"),("SEKOYA","Sekoya"),
    ("VENTURA","Ventura"),("ABRIL BLUE","Abril Blue"),("ABRIL","Abril"),
    ("ATLAS BLUE","Atlas Blue"),("ATLAS","Atlas"),("BILOXI","Biloxi"),("MATIAS","Matias"),
    ("ROCIO","Rocio"),("ROSITA","Rosita"),("RAYMI BLU","Raymi Blu"),("RAYMI","Raymi"),
    ("ALESSIA BLUE","Alessia Blue"),("ALESSIA","Alessia"),("MADEIRA","Madeira"),
    ("EUREKA SUNRISE","Eureka Sunrise"),("EUREKA","Eureka"),("ARANA","Arana"),
    ("EMERALD","Emerald"),("SNOWCHASER","Snowchaser"),("DIVINO","Divino")]

# ocean transit norms by destination country (days). REPLACE WITH BL ACTUALS when available.
TRANSIT = {"COLOMBIA":7,"PANAMÁ":6,"COSTA RICA":8,"CHILE":7,"ECUADOR":4,"MÉXICO":12,
    "ESTADOS UNIDOS":13,"CANADÁ":16,"BRASIL":12,"ESPAÑA":19,"PORTUGAL":20,"REINO UNIDO":21,
    "PAÍSES BAJOS":21,"ALEMANIA":22,"BÉLGICA":21,"FRANCIA":21,"ITALIA":22,"POLONIA":24,
    "TURQUÍA":26,"ISRAEL":35,"ARABIA SAUDITA":28,"EMIRATOS ÁRABES UNIDOS":30,"QATAR":30,
    "INDIA":28,"CHINA":28,"HONG KONG":30,"TAIWÁN, PROVINCIA DE CHINA":30,"SINGAPUR":30,
    "MALASIA":31,"TAILANDIA":34,"RUSIA":30}
FAR = ["TAIWÁN, PROVINCIA DE CHINA","CHINA","HONG KONG","SINGAPUR","MALASIA","TAILANDIA",
       "EMIRATOS ÁRABES UNIDOS","ARABIA SAUDITA","INDIA"]

def num(s): return pd.to_numeric(s.str.replace(".","",regex=False).str.replace(",",".",regex=False), errors="coerce")

def varieties_in(desc):
    found = set()
    for m in LABEL.finditer(desc):
        tail = desc[m.end():m.end()+42]
        stop = STOP.search(tail)
        seg  = tail[:stop.start()] if stop else tail
        for raw, name in CANON:
            if raw in seg:
                found.add(name); seg = seg.replace(raw, " ")
    return found

def main():
    if not SRC: sys.exit("set VERITRADE_CSV")
    df = pd.read_csv(SRC, dtype=str, keep_default_na=False)
    df["kg"]  = num(df["Kg Neto"]); df["fob"] = num(df["U$ FOB Tot"])
    df["transit"] = df["Pais de Destino"].map(TRANSIT)
    df["vs"] = df["Descripcion Comercial"].str.upper().map(varieties_in)
    stated = (df.vs.map(len) > 0)
    print(f"{len(df)} rows · variety stated on {stated.sum()} ({stated.mean()*100:.0f}%)")

    rows = []   # explode, splitting kg across multi-variety declarations
    for r in df.itertuples():
        if not r.vs: continue
        for v in r.vs:
            rows.append((v, r.kg/len(r.vs), r.fob/len(r.vs), r.transit,
                         getattr(r, "_11"), r.Via, r.Exportador))
    e = pd.DataFrame(rows, columns=["variety","kg","fob","transit","dest","via","exp"])
    oc = e[(e.via == "MARÍTIMO") & e.transit.notna()]

    out = []
    for v, g in oc.groupby("variety"):
        if g.kg.sum() < MIN_KG: continue
        w = np.repeat(g.transit.values, np.maximum((g.kg/1000).round().astype(int), 1))
        out.append(dict(variety=v, kg_2025_ocean=int(g.kg.sum()),
            mean_transit_d=round(np.average(g.transit, weights=g.kg), 1),
            max_observed_ocean_d=int(w.max()), p90_observed_ocean_d=int(np.percentile(w, 90)),
            pct_far_asia_mena=round(g[g.dest.isin(FAR)].kg.sum()/g.kg.sum()*100, 1),
            usd_kg=round(g.fob.sum()/g.kg.sum(), 2), n_exporters=int(g.exp.nunique())))
    o = pd.DataFrame(out).sort_values("max_observed_ocean_d", ascending=False)
    o["signal"] = np.where(o.n_exporters >= 10, "STRONG",
                  np.where(o.n_exporters >= 4, "MODERATE", "WEAK — few exporters"))
    o.to_csv("varieties_observed.csv", index=False)
    print(f"\n{len(o)} varieties >= {MIN_KG/1000:.0f}t written to varieties_observed.csv")
    print(o.to_string(index=False))

if __name__ == "__main__":
    main()
