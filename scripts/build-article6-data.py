#!/usr/bin/env python3
"""
Article 6 Pipeline Excel → src/data/article6-pipeline.json
対象シート: Country Overview, Bilateral Agreements, JCM, Projects, Prior Consideration
"""

import pandas as pd
import json
import os
import sys
from datetime import datetime

EXCEL_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "a6-pipeline.xlsx")
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "article6-pipeline.json")

def s(v):
    """safe string"""
    if v is None: return None
    sv = str(v).strip()
    if sv in ('nan', '', '-', 'N/A', 'n/a'): return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    return sv

def i(v, default=0):
    """safe int"""
    try: return int(float(v))
    except: return default

def f(v):
    """safe float"""
    try:
        r = float(v)
        return None if str(r) == 'nan' else round(r, 3)
    except: return None

print("Reading Excel...")
xl = pd.read_excel(EXCEL_FILE, sheet_name=None, header=None)

# ─────────────────────────────────────────────
# 1. Global KPI stats
# ─────────────────────────────────────────────
stat_vals = xl['Country Overview'].iloc[2].tolist()
# Order matches hdr_row (offset by 0):
# Initial Reports=17, Cooperative Approaches=41, Bilateral Agreements=108,
# Pilot Projects=29, JCM Projects=147, DNA=121, Participation Requirements=49,
# CDM Transition=1389, Approved by HP=119, Prior Consideration=954,
# something=124, something=44, something=415, PA=890, PoA=232

summary = {
    "initialReports":             i(stat_vals[4]),   # 17
    "cooperativeApproaches":      i(stat_vals[5]),   # 41
    "bilateralAgreements":        i(stat_vals[6]),   # 108
    "pilotProjects":              i(stat_vals[7]),   # 29
    "jcmProjects":                i(stat_vals[8]),   # 147
    "dna":                        i(stat_vals[9]),   # 121
    "participationRequirements":  i(stat_vals[10]),  # 49
    "cdmTransitionRequests":      i(stat_vals[11]),  # 1389
    "cdmApprovedByHostParty":     i(stat_vals[12]),  # 119
    "priorConsiderationPA":       i(stat_vals[17]),  # 890
    "priorConsiderationPoA":      i(stat_vals[18]),  # 232
    "priorConsiderationTotal":    i(stat_vals[17]) + i(stat_vals[18]),  # 1122
    "updatedAt": "2026-02-28",
}
print("Summary:", summary)

# ─────────────────────────────────────────────
# 2. Country Overview (row 4 = headers, row 5+ = data)
# ─────────────────────────────────────────────
co_df = xl['Country Overview']
co_headers = [
    "iso2", "party", "region", "subRegion",
    "initialReport", "cooperativeApproaches", "bilateralAgreements", "pilotProjects",
    "jcmProjects", "dna", "participationRequirements",
    "pa", "poa", "cpa",
    "approvedPa", "approvedPoa", "approvedCpa",
    "paNotes", "poaNotes", "anyActivity",
]

countries = []
for _, row in co_df.iloc[5:].iterrows():
    vals = row.tolist()
    if not s(vals[0]) or not s(vals[1]):
        continue
    c = {
        "iso2":                   s(vals[0]),
        "party":                  s(vals[1]),
        "region":                 s(vals[2]),
        "subRegion":              s(vals[3]),
        "cooperativeApproaches":  i(vals[5]),
        "bilateralAgreements":    i(vals[6]),
        "pilotProjects":          i(vals[7]),
        "jcmProjects":            i(vals[8]),
        "dna":                    s(vals[9]),
        "pa":                     i(vals[11]),
        "poa":                    i(vals[12]),
        "cpa":                    i(vals[13]),
        "paNotes":                i(vals[17]),
        "poaNotes":               i(vals[18]),
        "anyActivity":            s(vals[19]) == "yes",
    }
    countries.append(c)

print(f"Countries: {len(countries)}")

# ─────────────────────────────────────────────
# 3. Bilateral Agreements (row 2 = headers, row 3+ = data)
# ─────────────────────────────────────────────
ba_df = xl['Bilateral Agreements']

agreements = []
for _, row in ba_df.iloc[3:].iterrows():
    vals = row.tolist()
    title = s(vals[0])
    if not title: continue
    agreements.append({
        "title":              title,
        "hostCountry":        s(vals[1]),
        "region":             s(vals[2]),
        "subRegion":          s(vals[3]),
        "buyingCountry":      s(vals[4]),
        "date":               s(vals[5]),
        "status":             s(vals[6]),
        "link":               s(vals[7]),
        "associatedProjects": i(vals[9]),
        "hostBuyerRegion":    s(vals[11]),
        "hostBuyerCountry":   s(vals[12]),
    })

print(f"Bilateral Agreements: {len(agreements)}")

# ─────────────────────────────────────────────
# 4. JCM Projects (row 3 = headers, row 4+ = data)
# ─────────────────────────────────────────────
jcm_df = xl['JCM']

jcm = []
for _, row in jcm_df.iloc[4:].iterrows():
    vals = row.tolist()
    pid = s(vals[1])
    if not pid: continue
    jcm.append({
        "number":           i(vals[0]),
        "id":               pid,
        "title":            s(vals[2]),
        "hostCountry":      s(vals[3]),
        "region":           s(vals[4]),
        "subRegion":        s(vals[5]),
        "type":             s(vals[7]),
        "subType":          s(vals[8]),
        "ktCo2ePerYear":    f(vals[9]),
        "implementer":      s(vals[12]),
        "website":          s(vals[14]),
        "status":           s(vals[15]),
        "registrationDate": s(vals[16]),
    })

print(f"JCM projects: {len(jcm)}")

# ─────────────────────────────────────────────
# 5. Article 6 Projects (row 4 = headers, row 5+ = data)
# ─────────────────────────────────────────────
proj_df = xl['Projects']

projects = []
for _, row in proj_df.iloc[5:].iterrows():
    vals = row.tolist()
    title = s(vals[0])
    if not title: continue
    projects.append({
        "title":          title,
        "hostCountry":    s(vals[1]),
        "region":         s(vals[2]),
        "subRegion":      s(vals[3]),
        "type":           s(vals[4]),
        "subType":        s(vals[5]),
        "buyingCountry":  s(vals[6]),
        "website":        s(vals[20]),
    })

print(f"Projects: {len(projects)}")

# ─────────────────────────────────────────────
# 6. Prior Consideration (row 2 = headers, row 3+ = data)
# ─────────────────────────────────────────────
pc_df = xl['Prior Consideration']

prior = []
for _, row in pc_df.iloc[3:].iterrows():
    vals = row.tolist()
    host = s(vals[0])
    if not host: continue
    prior.append({
        "hostParty":        host,
        "submissionDate":   s(vals[1]),
        "title":            s(vals[2]),
        "type":             s(vals[3]),   # PA / PoA
        "region":           s(vals[6]),
        "subRegion":        s(vals[7]),
        "countryCode":      s(vals[8]),
        "sector":           s(vals[10]),
        "category":         s(vals[11]),
        "reductionType":    s(vals[13]),  # Reduction / Removal
        "activityType":     s(vals[14]),
        "methodology":      s(vals[20]),
        "tCo2ePerYear":     i(vals[26]),
        "incomeGroup":      s(vals[28]),
    })

print(f"Prior Consideration: {len(prior)}")

# ─────────────────────────────────────────────
# 7. Derived analytics
# ─────────────────────────────────────────────

# 地域別協定数
region_agreements = {}
for a in agreements:
    r = a.get("region") or "Other"
    region_agreements[r] = region_agreements.get(r, 0) + 1

# 買い手国別協定数
buyer_agreements = {}
for a in agreements:
    b = a.get("buyingCountry") or "Other"
    buyer_agreements[b] = buyer_agreements.get(b, 0) + 1

top_buyers = sorted(buyer_agreements.items(), key=lambda x: -x[1])[:15]

# PACM セクター別
pc_sectors = {}
for p in prior:
    sec = p.get("sector") or "Other"
    pc_sectors[sec] = pc_sectors.get(sec, 0) + 1

# PACM 地域別
pc_regions = {}
for p in prior:
    r = p.get("region") or "Other"
    pc_regions[r] = pc_regions.get(r, 0) + 1

# JCM タイプ別
jcm_types = {}
for j in jcm:
    t = j.get("type") or "Other"
    jcm_types[t] = jcm_types.get(t, 0) + 1

# JCM ホスト国別
jcm_hosts = {}
for j in jcm:
    h = j.get("hostCountry") or "Other"
    jcm_hosts[h] = jcm_hosts.get(h, 0) + 1

top_jcm_hosts = sorted(jcm_hosts.items(), key=lambda x: -x[1])[:15]

analytics = {
    "regionAgreements": [{"region": k, "count": v} for k, v in sorted(region_agreements.items(), key=lambda x: -x[1])],
    "topBuyers": [{"country": k, "count": v} for k, v in top_buyers],
    "pacmSectors": [{"sector": k, "count": v} for k, v in sorted(pc_sectors.items(), key=lambda x: -x[1])],
    "pacmRegions": [{"region": k, "count": v} for k, v in sorted(pc_regions.items(), key=lambda x: -x[1])],
    "jcmTypes": [{"type": k, "count": v} for k, v in sorted(jcm_types.items(), key=lambda x: -x[1])],
    "topJcmHosts": [{"country": k, "count": v} for k, v in top_jcm_hosts],
}

# ─────────────────────────────────────────────
# 8. 出力
# ─────────────────────────────────────────────
output = {
    "generatedAt": datetime.now().isoformat(),
    "summary": summary,
    "analytics": analytics,
    "countries": countries,
    "bilateralAgreements": agreements,
    "jcmProjects": jcm,
    "article6Projects": projects,
    "priorConsideration": prior,
}

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

size_kb = os.path.getsize(OUTPUT) // 1024
print(f"\n✅ 出力完了: {OUTPUT} ({size_kb} KB)")
print(f"  countries: {len(countries)}")
print(f"  agreements: {len(agreements)}")
print(f"  jcm: {len(jcm)}")
print(f"  projects: {len(projects)}")
print(f"  prior: {len(prior)}")
