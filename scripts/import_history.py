#!/usr/bin/env python3
"""
Optional historical CSV importer for GPRS V4.1.

Drop official CSV files into data/import/ and run this script.
Supported heuristic:
- Monthly revenue CSVs containing 公司代號 + 資料年月
- Quarterly financial CSVs containing 公司代號 + 年度 + 季別

It does not scrape non-public sources.
"""
import csv, json, pathlib, re, datetime

ROOT=pathlib.Path(__file__).resolve().parents[1]
IMP=ROOT/"data/import"
MONTH=ROOT/"data/history/monthly"
QUARTER=ROOT/"data/history/quarterly"
MONTH.mkdir(parents=True,exist_ok=True)
QUARTER.mkdir(parents=True,exist_ok=True)

def read_csv(path):
    for enc in ("utf-8-sig","utf-8","cp950","big5"):
        try:
            with path.open("r",encoding=enc,newline="") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            pass
    raise UnicodeDecodeError("unknown",b"",0,1,"unsupported encoding")

def code_of(r):
    for k in ("公司代號","Code","股票代號"):
        if r.get(k): return str(r[k]).strip()
    return ""

def ym_of(r):
    v=str(r.get("資料年月") or r.get("年月") or "").strip()
    d="".join(ch for ch in v if ch.isdigit())
    if len(d)==5: return f"{int(d[:3])+1911:04d}-{d[3:5]}"
    if len(d)==6 and int(d[:4])>1900: return f"{d[:4]}-{d[4:6]}"
    return ""

def q_of(r):
    y="".join(ch for ch in str(r.get("年度") or "").strip() if ch.isdigit())
    q="".join(ch for ch in str(r.get("季別") or r.get("季") or "").strip() if ch.isdigit())
    if y and q:
        yy=int(y); yy=yy+1911 if yy<1900 else yy
        return f"{yy:04d}-Q{q[-1]}"
    return ""

def merge_json(path,period,rows,kind):
    old={}
    if path.exists():
        try: old=json.loads(path.read_text(encoding="utf-8")).get("companies",{})
        except: old={}
    old.update(rows)
    path.write_text(json.dumps({
        "period":period,
        "imported_at":datetime.datetime.now().isoformat(),
        "kind":kind,
        "companies":old
    },ensure_ascii=False,separators=(",",":")),encoding="utf-8")

for p in IMP.glob("*.csv"):
    rows=read_csv(p)
    if not rows: continue
    buckets={}
    is_month=any("資料年月" in r for r in rows)
    for r in rows:
        code=code_of(r)
        if not code: continue
        period=ym_of(r) if is_month else q_of(r)
        if not period: continue
        buckets.setdefault(period,{})[code]=r
    for period,items in buckets.items():
        if is_month:
            merge_json(MONTH/f"{period}.json",period,items,"monthly_import")
        else:
            merge_json(QUARTER/f"{period}.json",period,items,"quarterly_import")
print("Import finished")
