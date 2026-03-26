"""
VROD（UC Berkeley Voluntary Registry Offsets Database）のExcelデータを
統計JSONに変換するスクリプト。

50万行超のExcelデータを集計し、Next.jsで静的インポートできるJSONファイルを生成。

使い方:
  python3 scripts/build-vrod-stats.py
"""

import pandas as pd
import json
import os
from collections import defaultdict

INPUT_FILE = "VROD-registry-files--2025-12.xlsx"
OUTPUT_DIR = "src/data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def safe_int(v):
    try:
        return int(v)
    except:
        return 0

def safe_str(v):
    if pd.isna(v):
        return None
    return str(v).strip()

def extract_year(date_val):
    try:
        if pd.isna(date_val):
            return None
        s = str(date_val)
        if len(s) >= 4:
            y = int(s[:4])
            if 1990 <= y <= 2030:
                return y
    except:
        pass
    return None

print("=== VROD データ変換開始 ===")
print(f"入力: {INPUT_FILE}")

# ============================================================
# 1. プロジェクト集計
# ============================================================
print("\n[1/5] プロジェクト集計...")

project_sheets = {
    "ACR": "ACR Projects",
    "ART": "ART Projects",
    "CAR": "CAR Projects",
    "Gold Standard": "Gold Projects",
    "Verra": "Verra Projects",
}

all_projects = []
registry_project_counts = {}
project_type_counts = defaultdict(int)
country_counts = defaultdict(int)
status_counts = defaultdict(int)

for registry, sheet in project_sheets.items():
    print(f"  {sheet}...")
    df = pd.read_excel(INPUT_FILE, sheet)
    registry_project_counts[registry] = len(df)

    for _, row in df.iterrows():
        # プロジェクトタイプ
        ptype = safe_str(row.get("Project Type") or row.get("Program Type") or row.get("Project  Type"))
        if ptype:
            project_type_counts[ptype] += 1

        # 国
        country = safe_str(row.get("Project Site Country") or row.get("Program  Country") or row.get("Project Country"))
        if country:
            country_counts[country] += 1

        # ステータス
        status = safe_str(row.get("Status") or row.get("Voluntary Status") or row.get("Project Status"))
        if status:
            status_counts[status] += 1

total_projects = sum(registry_project_counts.values())
print(f"  合計: {total_projects:,} プロジェクト")

# ============================================================
# 2. 発行量集計（Issuances）
# ============================================================
print("\n[2/5] 発行量集計...")

issuance_sheets = {
    "ACR": ("ACR Issuances", "Total Credits Issued", "Date Issued (GMT)"),
    "CAR": ("CAR Issuances", "Total Offset Credits Issued", "Date Issued"),
    "Gold Standard": ("Gold Issuances", "Credits Issued", "Date of Issuance"),
}

yearly_issuances = defaultdict(lambda: defaultdict(int))
registry_issuance_totals = defaultdict(int)
total_issued = 0

for registry, (sheet, qty_col, date_col) in issuance_sheets.items():
    print(f"  {sheet}...")
    df = pd.read_excel(INPUT_FILE, sheet)
    for _, row in df.iterrows():
        qty = safe_int(row.get(qty_col, 0))
        year = extract_year(row.get(date_col)) or extract_year(row.get("Vintage"))
        if qty > 0:
            total_issued += qty
            registry_issuance_totals[registry] += qty
            if year:
                yearly_issuances[year][registry] += qty

# Verra VCUs — 312K行あるのでチャンク読み
print("  Verra VCUS (312K rows)...")
verra_df = pd.read_excel(INPUT_FILE, "Verra VCUS")
verra_qty_col = "Quantity Issued"

for _, row in verra_df.iterrows():
    qty = safe_int(row.get(verra_qty_col, 0))
    year = extract_year(row.get("Issuance Date")) or extract_year(row.get("Vintage Start"))
    status = safe_str(row.get("Retirement/Cancellation Date"))
    is_retired = pd.notna(row.get("Retirement/Cancellation Date"))

    if qty > 0 and not is_retired:
        total_issued += qty
        registry_issuance_totals["Verra"] += qty
        if year:
            yearly_issuances[year]["Verra"] += qty

print(f"  合計発行量: {total_issued:,} tCO2e")

# ============================================================
# 3. リタイアメント集計
# ============================================================
print("\n[3/5] リタイアメント集計...")

retirement_sheets = {
    "ACR": ("ACR Retirements", "Quantity of Credits", "Status Effective (GMT)"),
    "CAR": ("CAR Retirements", "Quantity of Offset Credits", "Status Effective"),
    "Gold Standard": ("Gold Retirements", "Credits Retired", "Retirement Date"),
}

yearly_retirements = defaultdict(lambda: defaultdict(int))
registry_retirement_totals = defaultdict(int)
total_retired = 0
retirement_reasons = defaultdict(int)
top_retirees = defaultdict(int)

for registry, (sheet, qty_col, date_col) in retirement_sheets.items():
    print(f"  {sheet}...")
    df = pd.read_excel(INPUT_FILE, sheet)
    for _, row in df.iterrows():
        qty = safe_int(row.get(qty_col, 0))
        year = extract_year(row.get(date_col))
        if qty > 0:
            total_retired += qty
            registry_retirement_totals[registry] += qty
            if year:
                yearly_retirements[year][registry] += qty

        # リタイア理由
        reason = safe_str(row.get("Retirement Reason") or row.get("Purpose of Retirement"))
        if reason:
            # 簡略化
            if "compliance" in reason.lower():
                retirement_reasons["コンプライアンス"] += qty
            elif "behalf" in reason.lower() or "third party" in reason.lower():
                retirement_reasons["第三者のため"] += qty
            elif "voluntary" in reason.lower() or "environmental" in reason.lower():
                retirement_reasons["自主的オフセット"] += qty
            else:
                retirement_reasons["その他"] += qty

        # リタイアした企業（account holder）
        holder = safe_str(row.get("Account Holder") or row.get("Retired on Behalf of"))
        if holder and qty > 0:
            top_retirees[holder] += qty

# Verra のリタイアは VCUs シートの Retirement/Cancellation Date で判定
print("  Verra リタイア...")
for _, row in verra_df.iterrows():
    is_retired = pd.notna(row.get("Retirement/Cancellation Date"))
    if is_retired:
        qty = safe_int(row.get(verra_qty_col, 0))
        year = extract_year(row.get("Retirement/Cancellation Date"))
        if qty > 0:
            total_retired += qty
            registry_retirement_totals["Verra"] += qty
            if year:
                yearly_retirements[year]["Verra"] += qty
            # リタイア企業
            holder = safe_str(row.get("Retirement Beneficiary"))
            if holder:
                top_retirees[holder] += qty
            reason = safe_str(row.get("Retirement Reason"))
            if reason:
                if "compliance" in reason.lower():
                    retirement_reasons["コンプライアンス"] += qty
                elif "behalf" in reason.lower():
                    retirement_reasons["第三者のため"] += qty
                else:
                    retirement_reasons["自主的オフセット"] += qty

print(f"  合計リタイア: {total_retired:,} tCO2e")

# ============================================================
# 4. メソドロジー集計
# ============================================================
print("\n[4/5] メソドロジー集計...")

methodology_counts = defaultdict(int)
methodology_credits = defaultdict(int)

for registry, sheet in project_sheets.items():
    df = pd.read_excel(INPUT_FILE, sheet)
    meth_col = None
    for c in df.columns:
        if "methodology" in c.lower() or "protocol" in c.lower():
            meth_col = c
            break
    if not meth_col:
        continue

    credits_col = None
    for c in df.columns:
        if "credit" in c.lower() and ("total" in c.lower() or "registered" in c.lower() or "issued" in c.lower()):
            credits_col = c
            break

    for _, row in df.iterrows():
        meth = safe_str(row.get(meth_col))
        if meth:
            methodology_counts[meth] += 1
            if credits_col:
                methodology_credits[meth] += safe_int(row.get(credits_col, 0))

print(f"  ユニークメソドロジー数: {len(methodology_counts)}")

# ============================================================
# 5. JSON 出力
# ============================================================
print("\n[5/5] JSON 出力...")

# 年別データの整形
years = sorted(set(list(yearly_issuances.keys()) + list(yearly_retirements.keys())))
registries = sorted(set(
    list(registry_issuance_totals.keys()) + list(registry_retirement_totals.keys())
))

yearly_data = []
for y in years:
    entry = {"year": y, "issued": 0, "retired": 0}
    for r in registries:
        entry["issued"] += yearly_issuances[y].get(r, 0)
        entry["retired"] += yearly_retirements[y].get(r, 0)
    entry[f"issued_by_registry"] = {r: yearly_issuances[y].get(r, 0) for r in registries}
    entry[f"retired_by_registry"] = {r: yearly_retirements[y].get(r, 0) for r in registries}
    yearly_data.append(entry)

# トップリタイアー（上位30）
top_retirees_list = sorted(top_retirees.items(), key=lambda x: -x[1])[:30]

# メソドロジー（上位50）
top_methodologies = sorted(methodology_counts.items(), key=lambda x: -x[1])[:50]

# プロジェクトタイプ（上位20）
top_project_types = sorted(project_type_counts.items(), key=lambda x: -x[1])[:20]

# 国（上位30）
top_countries = sorted(country_counts.items(), key=lambda x: -x[1])[:30]

stats = {
    "dataSource": "UC Berkeley Voluntary Registry Offsets Database (VROD)",
    "dataDate": "2025-12",
    "totalProjects": total_projects,
    "totalIssued": total_issued,
    "totalRetired": total_retired,
    "registryProjects": registry_project_counts,
    "registryIssuances": dict(registry_issuance_totals),
    "registryRetirements": dict(registry_retirement_totals),
    "yearlyData": yearly_data,
    "topProjectTypes": [{"name": k, "count": v} for k, v in top_project_types],
    "topCountries": [{"name": k, "count": v} for k, v in top_countries],
    "topMethodologies": [{"name": k, "projects": v, "credits": methodology_credits.get(k, 0)} for k, v in top_methodologies],
    "retirementReasons": dict(retirement_reasons),
    "topRetirees": [{"name": k, "credits": v} for k, v in top_retirees_list],
    "statusDistribution": dict(status_counts),
}

output_path = os.path.join(OUTPUT_DIR, "vrod-stats.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2)

print(f"\n出力: {output_path}")
print(f"ファイルサイズ: {os.path.getsize(output_path):,} bytes")
print("\n=== 完了 ===")
print(f"プロジェクト: {total_projects:,}")
print(f"発行量: {total_issued:,} tCO2e")
print(f"リタイア: {total_retired:,} tCO2e")
