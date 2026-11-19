#!/usr/bin/env python3
"""Build nodes.csv - typed node master for CRAM Dimension C (Trade-Route).
Sources: Veritrade PE blueberry export book 2025 (mode evidence) + CRAM demo corridor list (aliases).
Rule: mode OBSERVED in customs data => confirmed. Mode NOT observed => reference-derived, needs review.
"""
import pandas as pd, csv, unicodedata, sys, os

SRC = os.environ.get("VERITRADE_CSV")
def num(s): return pd.to_numeric(s.str.replace('.','',regex=False).str.replace(',','.',regex=False),errors='coerce')

# id, code_type, code, name, country_iso, node_type, cold_chain_grade, aliases (|-sep)
NODES = [
 # ---- observed in Veritrade 2025 (mode confirmed by declarations) ----
 ("MIA","BOTH","USMIA/MIA","Miami","US","BOTH","A","MIAMI|Miami, United States"),
 ("BLB","UNLOCODE","PABLB","Balboa","PA","SEAPORT","B","BALBOA"),
 ("PSJ","UNLOCODE","ECPSJ","Posorja","EC","SEAPORT","B","POSORJA"),
 ("SHA","UNLOCODE","CNSHA","Shanghai","CN","SEAPORT","A","SHANGHAI|Shanghai, China"),
 ("GYE","UNLOCODE","ECGYE","Guayaquil","EC","SEAPORT","B","GUAYAQUIL"),
 ("MJS","UNLOCODE","CLMJS","Mejillones","CL","SEAPORT","B","MEJILLONES"),
 ("DVR","UNLOCODE","GBDVR","Dover","GB","SEAPORT","B","DOVER"),
 ("VAP","UNLOCODE","CLVAP","Valparaiso","CL","SEAPORT","A","VALPARAISO"),
 ("ROD","UNLOCODE","PABLB-ROD","Rodman","PA","SEAPORT","B","RODMAN"),
 ("CLD","UNLOCODE","CRCAL?","Caldera","??","SEAPORT","C","CALDERA"),   # AMBIGUOUS: Caldera CR vs Caldera CL
 ("LAX","IATA","LAX","Los Angeles Intl","US","BOTH","A","LOS ANGELES"),
 ("SAI","UNLOCODE","CLSAI","San Antonio","CL","SEAPORT","A","SAN ANTONIO|SAN Antonio, Chile|San Antonio, Chile"),
 ("MAD","IATA","MAD","Madrid Barajas","ES","AIRPORT","A","MADRID|Madrid, Spain"),
 ("BOG","IATA","BOG","El Dorado / Bogota","CO","AIRPORT","B","BOGOTA"),
 ("AMS","IATA","AMS","Amsterdam Schiphol","NL","AIRPORT","A","AMSTERDAM|Amsterdam, Netherlands"),
 ("YYZ","IATA","YYZ","Toronto Pearson","CA","AIRPORT","B","PEARSON INTERNATIONAL APT/TORONTO"),
 ("CDG","IATA","CDG","Paris Charles-de-Gaulle","FR","AIRPORT","A","CHARLES-DE-GAULLE APT/PARIS"),
 ("PTY","IATA","PTY","Panama Tocumen","PA","AIRPORT","B","PANAMA CITY"),
 ("ATL","IATA","ATL","Atlanta Hartsfield","US","AIRPORT","A","ATLANTA"),
 ("PHL","UNLOCODE","USPHL","Philadelphia","US","BOTH","A","PHILADELPHIA"),
 ("UIO","IATA","UIO","Quito Mariscal Sucre","EC","AIRPORT","B","QUITO"),
 ("DLC","UNLOCODE","CNDLC","Dalian","CN","SEAPORT","B","DALIAN"),
 ("JFK","IATA","JFK","New York JFK","US","AIRPORT","A","JOHN F.KENNEDY APT/NEW YORK|NEW YORK"),
 ("SAL","IATA","SAL","San Salvador","SV","AIRPORT","C","SAN SALVADOR"),
 ("GRU","IATA","GRU","Sao Paulo Guarulhos","BR","AIRPORT","B","GUARULHOS APT/SAO PAOLO|Guarulhos, Brazil"),
 ("BUN","UNLOCODE","COBUN","Buenaventura","CO","SEAPORT","C","BUENAVENTURA|Buenaventura, Colombia"),
 ("PBO","UNLOCODE","ECPBO","Puerto Bolivar","EC","SEAPORT","B","PUERTO BOLIVAR|Puerto Bolivar, Ecuador"),
 ("SCL","IATA","SCL","Santiago Arturo Merino","CL","AIRPORT","B","SANTIAGO"),
 ("CTG","UNLOCODE","COCTG","Cartagena","CO","SEAPORT","B","CARTAGENA"),
 ("ONX","UNLOCODE","PAONX","Colon / Manzanillo","PA","SEAPORT","B","COLON|MANZANILLO"),
 ("POA","IATA","POA","Porto Alegre","BR","AIRPORT","C","PORTO ALEGRE"),
 ("MDE","IATA","MDE","Medellin Rionegro","CO","AIRPORT","C","MEDELLIN"),
 ("GCT","UNLOCODE","USGCY","Gloucester City NJ","US","SEAPORT","A","GLOUCESTER CITY"),
 ("MVD","IATA","MVD","Montevideo Carrasco","UY","BOTH","C","MONTEVIDEO"),
 ("VVI","IATA","VVI","Santa Cruz Viru Viru","BO","AIRPORT","C","VIRU VIRU"),
 ("SJO","IATA","SJO","San Jose CR","CR","AIRPORT","C","SAN JOSE"),
 ("KIN","UNLOCODE","JMKIN","Kingston","JM","SEAPORT","C","KINGSTON"),
 ("AEP","IATA","AEP","Buenos Aires Jorge Newbery","AR","AIRPORT","C","JORGE NEWBURY APT/BUENOS AIRES"),
 ("EZE","IATA","EZE","Buenos Aires Ezeiza","AR","AIRPORT","B","MINISTRO PISTARINI APT/BUENOS AIR"),
 ("IAH","IATA","IAH","Houston Bush Intl","US","AIRPORT","B","GEORGE BUSH INTERCONTINENTAL APT/HOUSTON|HOUSTON"),
 ("HKG","BOTH","HKHKG/HKG","Hong Kong","HK","BOTH","A","HONG KONG|Hong Kong, Hong Kong"),
 ("YUL","IATA","YUL","Montreal Trudeau","CA","AIRPORT","B","MONTREAL-DORVAL APT"),
 ("MEX","IATA","MEX","Mexico City","MX","AIRPORT","C","MEXICO CITY"),
 ("VLI","UNLOCODE","NLVLI","Vlissingen","NL","SEAPORT","B","VLISSINGEN"),
 # ---- CRAM demo nodes NOT in the blueberry book (reference-derived, needs review) ----
 ("CLL","UNLOCODE","PECLL","Callao","PE","SEAPORT","A","CALLAO|Callao, Peru|Callao, Chile"),
 ("LIM","IATA","LIM","Lima Jorge Chavez","PE","AIRPORT","A","Aereopuerto Jorge Chavez|Aeropuerto Jorge Chavez|JORGE CHAVEZ"),
 ("CHN","UNLOCODE","PECHY","Chancay","PE","SEAPORT","A","CHANCAY|Chancay, Peru"),
 ("ALG","UNLOCODE","ESALG","Algeciras","ES","SEAPORT","A","ALGECIRAS|Algeciras, Spain"),
 ("AGP","BOTH","ESAGP/AGP","Malaga","ES","BOTH","C","MALAGA|Malaga, Spain|Malaga, China"),
 ("VLC","UNLOCODE","ESVLC","Valencia","ES","SEAPORT","A","VALENCIA|Valencia, Spain"),
 ("RTM","UNLOCODE","NLRTM","Rotterdam","NL","SEAPORT","A","ROTTERDAM|Rotterdam, Netherlands"),
 ("ASH","UNLOCODE","ILASH","Ashdod","IL","SEAPORT","B","ASHDOD"),
 ("HFA","UNLOCODE","ILHFA","Haifa","IL","SEAPORT","B","HAIFA"),
 ("TLV","IATA","TLV","Tel Aviv Ben Gurion","IL","AIRPORT","A","TEL AVIV|Tel Aviv, Israel"),
 ("KHH","UNLOCODE","TWKHH","Kaohsiung","TW","SEAPORT","A","KAOHSIUNG|Kaohsiung, Taiwan, Province of China"),
 ("JEA","UNLOCODE","AEJEA","Jebel Ali","AE","SEAPORT","A","JEBEL ALI|Jebel Ali, UAE"),
 ("DXB","IATA","DXB","Dubai Intl","AE","AIRPORT","A","DUBAI|Dubai, United Arab Emirates"),
 ("HUE","UNLOCODE","USHUE","Port Hueneme","US","SEAPORT","A","PORT HUENEME|Port Hueneme, United States|HUENEME|Hueneme, United States"),
 ("NSA","UNLOCODE","INNSA","Nhava Sheva (Mumbai)","IN","SEAPORT","B","MUMBAI|Mumbai, India"),
 ("BOM","IATA","BOM","Mumbai Chhatrapati Shivaji","IN","AIRPORT","B","MUMBAI APT|MUMBAI|Mumbai, India"),  # MUMBAI also on NSA; lookup filters by mode
 ("GDN","UNLOCODE","PLGDN","Gdansk","PL","SEAPORT","A","GDANSK|Gdansk, Poland"),
 ("VIE","IATA","VIE","Vienna Schwechat","AT","AIRPORT","A","VIENNA|Vienna, Austria"),
 ("FRA","IATA","FRA","Frankfurt am Main","DE","AIRPORT","A","FRANKFURT|Frankurt Am Main|Frankurt Am Main, Germany"),
 ("LIS","BOTH","PTLIS/LIS","Lisbon","PT","BOTH","B","LISBON|Lisbon, Portugal"),
 ("LED","UNLOCODE","RULED","St Petersburg","RU","SEAPORT","C","ST PETERSBURG|St Petersburg, Russian Federation"),
 ("YVR","BOTH","CAVAN/YVR","Vancouver BC","CA","BOTH","A","VANCOUVER|Vancouver, Canada|Vancouver, Netherlands"),
 ("LCH","UNLOCODE","THLCH","Laem Chabang","TH","SEAPORT","B","LAEM CHABANG"),
 ("BKK","IATA","BKK","Bangkok Suvarnabhumi","TH","AIRPORT","A","BANGKOK|Bangkok, Thailand"),
 ("SVI","UNLOCODE","CLSVE","San Vicente","CL","SEAPORT","B","SAN VICENTE|San Vicente, Chile|TALCAHUANO|Talcahuano, Chile"),  # Talcahuano customs office clears via the San Vicente terminal (same bay)
 # ---- added 2026-10-16 for the ops deal tape (customs-derived deals); reference-derived ----
 ("PIO","UNLOCODE","PEPIO","Pisco / Paracas","PE","SEAPORT","A","PISCO|Pisco, Peru|PARACAS|GENERAL SAN MARTIN"),
 ("SVY","UNLOCODE","PESVY","Salaverry","PE","SEAPORT","B","SALAVERRY|Salaverry, Peru"),
 ("PAI","UNLOCODE","PEPAI","Paita","PE","SEAPORT","A","PAITA|Paita, Peru"),
 ("ORF","UNLOCODE","USORF","Norfolk","US","SEAPORT","A","NORFOLK|Norfolk, United States"),
 ("SAV","UNLOCODE","USSAV","Savannah","US","SEAPORT","A","SAVANNAH|Savannah, United States"),
 ("HOU","UNLOCODE","USHOU","Houston","US","SEAPORT","A","HOUSTON|Houston, United States"),  # HOUSTON also on IAH (air)
 ("HAM","UNLOCODE","DEHAM","Hamburg","DE","SEAPORT","A","HAMBURG|Hamburg, Germany"),
 ("ZLO","UNLOCODE","MXZLO","Manzanillo MX","MX","SEAPORT","B","Manzanillo, Mexico|MANZANILLO MX"),
]
COLS=["node_id","code_type","code","name","country_iso","node_type","cold_chain_grade","aliases"]
nodes=pd.DataFrame(NODES,columns=COLS)

# ---- attach observed-mode evidence from Veritrade ----
obs={}
if SRC and os.path.exists(SRC):
    df=pd.read_csv(SRC,dtype=str,keep_default_na=False)
    df["kg"]=num(df["Kg Neto"]); df=df[df.Via!="CARRETERO"]
    g=df.pivot_table(index="Puerto de destino",columns="Via",values="kg",aggfunc="sum").fillna(0)
    for raw,row in g.iterrows():
        obs[raw.strip().upper()]=(row.get("AÉREO",0),row.get("MARÍTIMO",0))
def ev(r):
    a=o=0.0
    keys={al.strip().upper() for al in [r["name"]]+r["aliases"].split("|")}
    for k in keys:
        if k in obs: a+=obs[k][0]; o+=obs[k][1]
    return pd.Series({"obs_air_kg":round(a),"obs_ocean_kg":round(o)})
nodes=nodes.join(nodes.apply(ev,axis=1))
def status(r):
    seen=[]
    if r.obs_air_kg>0: seen.append("AIR")
    if r.obs_ocean_kg>0: seen.append("OCEAN")
    if not seen: return "REFERENCE_ONLY"
    dec={"AIRPORT":["AIR"],"SEAPORT":["OCEAN"],"BOTH":["AIR","OCEAN"]}[r.node_type]
    return "CONFIRMED" if set(seen)<=set(dec) else "CONFLICT"
nodes["evidence"]=nodes.apply(status,axis=1)
nodes=nodes[COLS[:-1]+["obs_air_kg","obs_ocean_kg","evidence","aliases"]]
nodes.to_csv("nodes.csv",index=False)
print(nodes.evidence.value_counts().to_string())
print("\nrows:",len(nodes))
print(nodes[nodes.evidence=="CONFIRMED"][["node_id","name","node_type","obs_air_kg","obs_ocean_kg"]].head(12).to_string(index=False))
