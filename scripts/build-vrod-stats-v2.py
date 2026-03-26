"""
VROD 完全版データ変換スクリプト（v2）
全26シート + Design-Calculations + ScopesTypes.pdf を完全に取り込む
"""

import pandas as pd
import json
import os
import subprocess
from collections import defaultdict

INPUT = "VROD-registry-files--2025-12.xlsx"
INPUT_CALC = "VROD-Design-Calculations--2025-12.xlsx"
INPUT_PDF = "VROD-ScopesTypes.pdf"
OUTPUT = "src/data/vrod-stats.json"

def safe_int(v):
    try: return int(float(v))
    except: return 0

def safe_str(v):
    if pd.isna(v): return None
    return str(v).strip()

def extract_year(v):
    try:
        if pd.isna(v): return None
        s = str(v)[:10]
        y = pd.to_datetime(s, errors='coerce')
        if pd.notna(y) and 1990 <= y.year <= 2030: return y.year
    except: pass
    return None

print("=== VROD 完全版データ変換 v2 ===\n")

# ============================================================
# 1. 全プロジェクト（5レジストリ）
# ============================================================
print("[1/8] プロジェクト集計（全5レジストリ）...")

project_configs = [
    ("ACR", "ACR Projects", "Project Type", "Project Methodology/Protocol", "Project Site Country", "Voluntary Status", "Total Number of Credits Registered ", "Project Name", "Project Developer"),
    ("ART", "ART Projects", "Program Type", None, "Program  Country", "Status", None, "Program Name", "Sovereign Program Developer"),
    ("CAR", "CAR Projects", "Project Type", "Protocol and Version" if False else None, "Project Site Country", "Status", "Total Number of Offset Credits Registered ", "Project Name", "Project Developer"),
    ("Gold Standard", "Gold Projects", "Project Type", None, "Country", "Status", None, "Project Name", "Developer"),
    ("Verra", "Verra Projects", "Project Type", "Methodology", "Country/Area", "Status", "Estimated Annual Emission Reductions", "Name", "Proponent"),
]

all_projects_data = []
registry_counts = {}
type_counts = defaultdict(int)
country_counts = defaultdict(int)
status_counts = defaultdict(int)
methodology_project_counts = defaultdict(int)
methodology_credits = defaultdict(int)

for registry, sheet, type_col, meth_col, country_col, status_col, credits_col, name_col, dev_col in project_configs:
    print(f"  {sheet}...")
    df = pd.read_excel(INPUT, sheet)
    registry_counts[registry] = len(df)
    
    for _, row in df.iterrows():
        ptype = safe_str(row.get(type_col))
        if ptype: type_counts[ptype] += 1
        
        country = safe_str(row.get(country_col))
        if country: country_counts[country] += 1
        
        status = safe_str(row.get(status_col))
        if status: status_counts[status] += 1
        
        # メソドロジー
        if meth_col:
            meth = safe_str(row.get(meth_col))
            if meth:
                methodology_project_counts[meth] += 1
                if credits_col:
                    methodology_credits[meth] += safe_int(row.get(credits_col, 0))
        
        # Verra の Methodology 列
        if registry == "Verra":
            meth = safe_str(row.get("Methodology"))
            if meth:
                methodology_project_counts[meth] += 1
        
        # CAR の protocol
        if registry == "CAR":
            for c in df.columns:
                if "protocol" in c.lower():
                    meth = safe_str(row.get(c))
                    if meth:
                        methodology_project_counts[meth] += 1
                    break

total_projects = sum(registry_counts.values())
print(f"  合計: {total_projects:,} プロジェクト\n")

# ============================================================
# 2. 全発行データ（Issuances）
# ============================================================
print("[2/8] 発行量集計（全レジストリ）...")

issuance_configs = [
    ("ACR", "ACR Issuances", "Total Credits Issued", "Date Issued (GMT)"),
    ("ART", "ART Issuances", "Quantity of Credits", "Date Issued"),
    ("CAR", "CAR Issuances", "Total Offset Credits Issued", "Date Issued"),
    ("Gold Standard", "Gold Issuances", "Credits Issued", "Date of Issuance"),
    ("ARB", "ARB Issuances & Retirements", "ARB Offset Credits Issued", "Issuance Date"),
    ("WA", "WA Issuances & Retirements", "WA Offset Credits Issued", "Issuance Date"),
]

yearly_issuances = defaultdict(lambda: defaultdict(int))
registry_issuance_totals = defaultdict(int)
total_issued = 0

for registry, sheet, qty_col, date_col in issuance_configs:
    print(f"  {sheet}...")
    try:
        df = pd.read_excel(INPUT, sheet)
        for _, row in df.iterrows():
            qty = safe_int(row.get(qty_col, 0))
            year = extract_year(row.get(date_col)) or extract_year(row.get("Vintage"))
            if qty > 0:
                total_issued += qty
                registry_issuance_totals[registry] += qty
                if year: yearly_issuances[year][registry] += qty
    except Exception as e:
        print(f"    エラー: {e}")

# Verra VCUs
print("  Verra VCUS (312K rows)...")
vdf = pd.read_excel(INPUT, "Verra VCUS")
for _, row in vdf.iterrows():
    qty = safe_int(row.get("Quantity Issued", 0))
    is_retired = pd.notna(row.get("Retirement/Cancellation Date"))
    year = extract_year(row.get("Issuance Date")) or extract_year(row.get("Vintage Start"))
    if qty > 0 and not is_retired:
        total_issued += qty
        registry_issuance_totals["Verra"] += qty
        if year: yearly_issuances[year]["Verra"] += qty

print(f"  合計発行量: {total_issued:,} tCO2e\n")

# ============================================================
# 3. 全リタイアメント
# ============================================================
print("[3/8] リタイアメント集計...")

retirement_configs = [
    ("ACR", "ACR Retirements", "Quantity of Credits", "Status Effective (GMT)", "Account Holder", "Retirement Reason"),
    ("ART", "ART Retired", "Quantity of Credits", "Status Effective", "Account Holder", "Retirement Reason"),
    ("CAR", "CAR Retirements", "Quantity of Offset Credits", "Status Effective", "Account Holder", "Retirement Reason"),
    ("Gold Standard", "Gold Retirements", "Credits Retired", "Retirement Date", "Buyer", "Retirement Type"),
]

yearly_retirements = defaultdict(lambda: defaultdict(int))
registry_retirement_totals = defaultdict(int)
total_retired = 0
retirement_reasons = defaultdict(int)
top_retirees = defaultdict(int)

for registry, sheet, qty_col, date_col, holder_col, reason_col in retirement_configs:
    print(f"  {sheet}...")
    try:
        df = pd.read_excel(INPUT, sheet)
        for _, row in df.iterrows():
            qty = safe_int(row.get(qty_col, 0))
            year = extract_year(row.get(date_col))
            if qty > 0:
                total_retired += qty
                registry_retirement_totals[registry] += qty
                if year: yearly_retirements[year][registry] += qty
            
            reason = safe_str(row.get(reason_col) or row.get("Purpose of Retirement"))
            if reason and qty > 0:
                rl = reason.lower()
                if "compliance" in rl: retirement_reasons["コンプライアンス"] += qty
                elif "behalf" in rl or "third party" in rl: retirement_reasons["第三者のため"] += qty
                elif "voluntary" in rl or "environmental" in rl: retirement_reasons["自主的オフセット"] += qty
                else: retirement_reasons["その他"] += qty
            
            holder = safe_str(row.get(holder_col) or row.get("Retired on Behalf of"))
            if holder and qty > 0: top_retirees[holder] += qty
    except Exception as e:
        print(f"    エラー: {e}")

# ARB retirements (same sheet as issuances)
print("  ARB Retirements...")
try:
    arb_df = pd.read_excel(INPUT, "ARB Issuances & Retirements")
    for col in arb_df.columns:
        if "retired" in col.lower() and "period" not in col.lower() and "buffer" not in col.lower():
            arb_ret = arb_df[col].apply(safe_int).sum()
            if arb_ret > 0:
                total_retired += arb_ret
                registry_retirement_totals["ARB"] += arb_ret
                print(f"    ARB {col}: {arb_ret:,}")
except Exception as e:
    print(f"    エラー: {e}")

# Verra retirements
print("  Verra リタイア...")
for _, row in vdf.iterrows():
    is_retired = pd.notna(row.get("Retirement/Cancellation Date"))
    if is_retired:
        qty = safe_int(row.get("Quantity Issued", 0))
        year = extract_year(row.get("Retirement/Cancellation Date"))
        if qty > 0:
            total_retired += qty
            registry_retirement_totals["Verra"] += qty
            if year: yearly_retirements[year]["Verra"] += qty
            holder = safe_str(row.get("Retirement Beneficiary"))
            if holder: top_retirees[holder] += qty
            reason = safe_str(row.get("Retirement Reason"))
            if reason:
                rl = reason.lower()
                if "compliance" in rl: retirement_reasons["コンプライアンス"] += qty
                elif "behalf" in rl: retirement_reasons["第三者のため"] += qty
                else: retirement_reasons["自主的オフセット"] += qty

print(f"  合計リタイア: {total_retired:,} tCO2e\n")

# ============================================================
# 4. 全キャンセレーション（取消）
# ============================================================
print("[4/8] キャンセレーション集計...")

cancel_configs = [
    ("ACR", "ACR Cancelations", "Quantity of Credits", "Status Effective  (GMT)", "Cancellation Type"),
    ("ART", "ART Cancelations", "Quantity of Credits", "Status Effective", "Cancellation Reason"),
    ("CAR", "CAR Cancellations", "Quantity of Offset Credits", "Status Effective", "Cancellation Reason"),
]

yearly_cancellations = defaultdict(lambda: defaultdict(int))
registry_cancel_totals = defaultdict(int)
total_cancelled = 0
cancel_reasons = defaultdict(int)

for registry, sheet, qty_col, date_col, reason_col in cancel_configs:
    print(f"  {sheet}...")
    try:
        df = pd.read_excel(INPUT, sheet)
        for _, row in df.iterrows():
            qty = safe_int(row.get(qty_col, 0))
            year = extract_year(row.get(date_col))
            if qty > 0:
                total_cancelled += qty
                registry_cancel_totals[registry] += qty
                if year: yearly_cancellations[year][registry] += qty
            reason = safe_str(row.get(reason_col))
            if reason and qty > 0:
                cancel_reasons[reason[:50]] += qty
    except Exception as e:
        print(f"    エラー: {e}")

print(f"  合計取消: {total_cancelled:,} tCO2e\n")

# ============================================================
# 5. 全バッファプール
# ============================================================
print("[5/8] バッファプール集計...")

buffer_configs = [
    ("ACR", "ACR Buffer", "Buffered Credits"),
    ("ART", "ART Buffer", "Buffered Credits"),
    ("CAR", "CAR Buffer", None),
    ("Gold Standard", "Gold Buffer", None),
    ("Verra", "Verra Buffer", None),
]

registry_buffer_totals = defaultdict(int)
total_buffer = 0

for registry, sheet, qty_col in buffer_configs:
    print(f"  {sheet}...")
    try:
        df = pd.read_excel(INPUT, sheet)
        if qty_col and qty_col in df.columns:
            total = df[qty_col].apply(safe_int).sum()
        else:
            # Find credits column
            for c in df.columns:
                if "credit" in c.lower() or "buffer" in c.lower():
                    total = df[c].apply(safe_int).sum()
                    if total > 0: break
            else:
                total = 0
        registry_buffer_totals[registry] = total
        total_buffer += total
        print(f"    {total:,} credits")
    except Exception as e:
        print(f"    エラー: {e}")

print(f"  合計バッファ: {total_buffer:,}\n")

# ============================================================
# 6. ScopesTypes.pdf からメソドロジー分類を抽出
# ============================================================
print("[6/8] ScopesTypes.pdf 解析...")

scopes_data = {}
try:
    result = subprocess.run(
        ["python3", "-c", f"""
import sys
sys.path.insert(0, '.')
# Use pdfjs via node or simple text extraction
import subprocess
text = subprocess.check_output(['pdftotext', '{INPUT_PDF}', '-'], timeout=30).decode('utf-8')
print(text)
"""], capture_output=True, text=True, timeout=30
    )
    pdf_text = result.stdout
    
    # Parse scopes and types
    current_scope = None
    current_type = None
    
    lines = pdf_text.split('\n')
    scope_types = {}
    type_methodologies = {}
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line: continue
        
        # Scope headers (bold in PDF = standalone short lines followed by subcategories)
        if line in ["Agriculture", "Carbon Capture & Storage", "Chemical Processes", 
                     "Engineered Removals", "Forestry & Land Use", "Household & Community",
                     "Industrial & Commercial", "Renewable Energy", "Transportation", 
                     "Waste Management"]:
            current_scope = line
            scope_types[current_scope] = []
            continue
        
        # Check if it's a type (indented in PDF, has page number)
        if current_scope and len(line) > 3 and not line[0].isdigit():
            # Could be a project type or methodology
            if any(prefix in line for prefix in ["CDM", "VCS", "ACR", "CAR", "ARB", "Gold Standard", "AMS", "ACM", "VM0"]):
                # It's a methodology
                if current_type:
                    if current_type not in type_methodologies:
                        type_methodologies[current_type] = []
                    type_methodologies[current_type].append(line)
            elif "**" not in line and len(line) < 80:
                current_type = line
                if current_scope:
                    scope_types[current_scope].append(current_type)
    
    scopes_data = {
        "scopes": scope_types,
        "typeMethodologies": type_methodologies,
    }
    print(f"  スコープ: {len(scope_types)} カテゴリ")
    print(f"  タイプ: {sum(len(v) for v in scope_types.values())} 種類")
    print(f"  メソドロジー紐付け: {sum(len(v) for v in type_methodologies.values())} 件")
except Exception as e:
    print(f"  PDF解析エラー: {e}")

# ============================================================
# 7. Design-Calculations
# ============================================================
print("\n[7/8] Design-Calculations 取り込み...")

calc_data = {}
try:
    # Project information column descriptions
    df_cols = pd.read_excel(INPUT_CALC, "Project information column desc", header=None)
    col_descriptions = []
    for _, row in df_cols.iterrows():
        vals = [safe_str(row.get(c)) for c in range(len(row)) if safe_str(row.get(c))]
        if vals:
            col_descriptions.append(" | ".join(v for v in vals if v))
    
    # Transaction types & calculations
    df_tx = pd.read_excel(INPUT_CALC, "Transactions types & calcs", header=None)
    tx_descriptions = []
    for _, row in df_tx.iterrows():
        vals = [safe_str(row.get(c)) for c in range(len(row)) if safe_str(row.get(c))]
        if vals:
            tx_descriptions.append(" | ".join(v for v in vals if v))
    
    calc_data = {
        "columnDescriptions": col_descriptions[:30],
        "transactionTypes": tx_descriptions[:30],
    }
    print(f"  列定義: {len(col_descriptions)} 行")
    print(f"  取引タイプ: {len(tx_descriptions)} 行")
except Exception as e:
    print(f"  エラー: {e}")

# ============================================================
# 8. 日本データ（前回と同じ）
# ============================================================
print("\n[8/8] 日本企業データ...")

JA_COMPANIES = {
    'ANA': ['ALL NIPPON', 'ANA Holdings', 'ANA '],
    'JAL': ['Japan Airlines', 'JAL'],
    'Toyota': ['Toyota', 'TOYOTA'],
    'Honda': ['Honda', 'HONDA'],
    'Sony': ['Sony', 'SONY'],
    'Panasonic': ['Panasonic'],
    'NTT': ['NTT', 'Nippon Telegraph'],
    'ENEOS': ['ENEOS'],
    'Tokyo Gas': ['Tokyo Gas'],
    'JERA': ['JERA'],
    'Mitsubishi': ['Mitsubishi'],
    'Mitsui': ['Mitsui'],
    'Marubeni': ['Marubeni'],
    'ITOCHU': ['ITOCHU', 'Itochu'],
    'Sumitomo': ['Sumitomo'],
    'JFE': ['JFE'],
    'Nippon Steel': ['Nippon Steel'],
    'SoftBank': ['Softbank', 'SoftBank'],
    'Rakuten': ['Rakuten'],
    'Ricoh': ['Ricoh'],
    'Fujitsu': ['Fujitsu'],
    'NEC': ['NEC Corporation', 'NEC '],
    'Canon': ['Canon'],
    'Kirin': ['Kirin'],
    'Suntory': ['Suntory'],
    'Daikin': ['Daikin'],
    'Hitachi': ['Hitachi'],
    'Toshiba': ['Toshiba'],
    'Fast Retailing': ['Fast Retailing', 'UNIQLO'],
    'KDDI': ['KDDI'],
}

retired_verra = vdf[vdf['Retirement/Cancellation Date'].notna()].copy()
company_stats = []
for company, keywords in JA_COMPANIES.items():
    mask = retired_verra['Retirement Beneficiary'].apply(
        lambda x: any(kw.lower() in str(x).lower() for kw in keywords) if pd.notna(x) else False
    )
    sub = retired_verra[mask]
    if len(sub) == 0: continue
    total = int(sub['Quantity Issued'].sum())
    yearly = defaultdict(int)
    for _, r in sub.iterrows():
        y = extract_year(r.get('Retirement/Cancellation Date'))
        if y: yearly[y] += int(r['Quantity Issued'])
    by_type = sub.groupby('Project Type')['Quantity Issued'].sum().sort_values(ascending=False).head(5)
    types = [{'type': str(t), 'credits': int(v)} for t, v in by_type.items()]
    company_stats.append({'name': company, 'totalCredits': total, 'records': len(sub), 'yearly': dict(sorted(yearly.items())), 'topTypes': types})

company_stats.sort(key=lambda x: -x['totalCredits'])

jp_projects = []
vp = pd.read_excel(INPUT, 'Verra Projects')
for _, r in vp[vp['Country/Area'].str.contains('Japan', na=False)].iterrows():
    jp_projects.append({'id': str(r.get('ID','')), 'name': str(r.get('Name','')), 'type': str(r.get('Project Type','')), 'methodology': str(r.get('Methodology','')), 'status': str(r.get('Status','')), 'proponent': str(r.get('Proponent',''))})

ja_yearly = defaultdict(int)
for c in company_stats:
    for y, v in c['yearly'].items(): ja_yearly[y] += v

# ============================================================
# JSON 出力
# ============================================================
print("\n=== JSON 出力 ===")

years = sorted(set(list(yearly_issuances.keys()) + list(yearly_retirements.keys()) + list(yearly_cancellations.keys())))
all_registries = sorted(set(list(registry_issuance_totals.keys()) + list(registry_retirement_totals.keys())))

yearly_data = []
for y in years:
    entry = {"year": y, "issued": 0, "retired": 0, "cancelled": 0}
    ibr = {}; rbr = {}; cbr = {}
    for r in all_registries:
        ibr[r] = yearly_issuances[y].get(r, 0)
        rbr[r] = yearly_retirements[y].get(r, 0)
        cbr[r] = yearly_cancellations[y].get(r, 0)
        entry["issued"] += ibr[r]
        entry["retired"] += rbr[r]
        entry["cancelled"] += cbr[r]
    entry["issued_by_registry"] = ibr
    entry["retired_by_registry"] = rbr
    entry["cancelled_by_registry"] = cbr
    yearly_data.append(entry)

# Verra 追加統計
pt_yearly = {}
c_yearly = {}
all_ptypes = sorted(vdf['Project Type'].dropna().unique().tolist())
all_countries = sorted(vdf['Country/Area'].dropna().unique().tolist())

stats = {
    "dataSource": "UC Berkeley Voluntary Registry Offsets Database (VROD)",
    "dataDate": "2025-12",
    "dataVersion": "v2-complete",
    "totalProjects": total_projects,
    "totalIssued": total_issued,
    "totalRetired": total_retired,
    "totalCancelled": total_cancelled,
    "totalBuffer": total_buffer,
    "registryProjects": registry_counts,
    "registryIssuances": dict(registry_issuance_totals),
    "registryRetirements": dict(registry_retirement_totals),
    "registryCancellations": dict(registry_cancel_totals),
    "registryBuffer": dict(registry_buffer_totals),
    "yearlyData": yearly_data,
    "topProjectTypes": [{"name": k, "count": v} for k, v in sorted(type_counts.items(), key=lambda x: -x[1])[:30]],
    "topCountries": [{"name": k, "count": v} for k, v in sorted(country_counts.items(), key=lambda x: -x[1])[:40]],
    "topMethodologies": [{"name": k, "projects": v, "credits": methodology_credits.get(k, 0)} for k, v in sorted(methodology_project_counts.items(), key=lambda x: -x[1])[:80]],
    "retirementReasons": dict(retirement_reasons),
    "cancellationReasons": dict(sorted(cancel_reasons.items(), key=lambda x: -x[1])[:15]),
    "topRetirees": [{"name": k, "credits": v} for k, v in sorted(top_retirees.items(), key=lambda x: -x[1])[:50]],
    "statusDistribution": dict(status_counts),
    "allProjectTypes": all_ptypes,
    "allCountries": all_countries,
    # バッファプール
    "bufferPool": dict(registry_buffer_totals),
    # ScopesTypes
    "scopesAndTypes": scopes_data,
    # Design Calculations
    "designCalculations": calc_data,
    # 日本
    "japanCompanyRetirements": company_stats,
    "japanProjects": jp_projects,
    "japanYearlyRetirements": [{"year": y, "credits": v} for y, v in sorted(ja_yearly.items()) if 2015 <= y <= 2025],
    "totalJapanRetired": sum(c['totalCredits'] for c in company_stats),
    "japanCompanyCount": len(company_stats),
}

import numpy as np
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)): return int(obj)
        if isinstance(obj, (np.floating,)): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super().default(obj)

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2, cls=NpEncoder)

size = os.path.getsize(OUTPUT)
print(f"\n出力: {OUTPUT} ({size:,} bytes)")
print(f"\n=== 完全版サマリー ===")
print(f"プロジェクト: {total_projects:,}")
print(f"発行量: {total_issued:,} tCO2e")
print(f"リタイア: {total_retired:,} tCO2e")
print(f"キャンセル: {total_cancelled:,} tCO2e")
print(f"バッファ: {total_buffer:,}")
print(f"メソドロジー: {len(methodology_project_counts)}")
print(f"国: {len(country_counts)}")
print(f"日本企業: {len(company_stats)}")
print(f"レジストリ: {len(all_registries)}")
