#!/usr/bin/env python3
import json, urllib.request, datetime, pathlib, time, csv, io

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
(DATA/"history/monthly").mkdir(parents=True, exist_ok=True)
(DATA/"history/quarterly").mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; GPRS-Fundamental/4.1)",
    "Accept": "application/json,text/plain,*/*"
}

SOURCES = {
    "twse_company": "https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
    "twse_revenue": "https://openapi.twse.com.tw/v1/opendata/t187ap05_L",
    "twse_income_ci": "https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci",
    "twse_balance_ci": "https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci",
    "twse_valuation": "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL",
    "twse_quote": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",

    "tpex_company": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O",
    "tpex_revenue": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O",
    "tpex_income_ci": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_O_ci",
    "tpex_balance_ci": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap07_O_ci",
}

def fetch(url, tries=3):
    last=None
    for i in range(tries):
        try:
            req=urllib.request.Request(url,headers=HEADERS)
            with urllib.request.urlopen(req,timeout=45) as r:
                raw=r.read()
            return json.loads(raw.decode("utf-8-sig"))
        except Exception as e:
            last=e
            time.sleep(2*(i+1))
    raise last

def safe_fetch(name,url):
    try:
        rows=fetch(url)
        if not isinstance(rows,list):
            raise ValueError("API did not return a list")
        print(f"{name}: {len(rows)}")
        return rows,None
    except Exception as e:
        print(f"{name}: ERROR {e}")
        return [],str(e)

def code_of(r):
    for k in ("公司代號","Code","證券代號","SecuritiesCompanyCode","SecuritiesCode"):
        v=r.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""

def pick(r,names):
    for k in names:
        v=r.get(k)
        if v not in (None,""):
            return v
    return ""

def merge_by_code(target,rows,section,market):
    for r in rows:
        code=code_of(r)
        if not code:
            continue
        x=target.setdefault(code,{"code":code,"market":market})
        x[section]=r

def roc_to_ad_year(s):
    s=str(s or "").strip()
    # supports 11503, 115/03, 202603
    digits="".join(ch for ch in s if ch.isdigit())
    if len(digits)==5:
        return f"{int(digits[:3])+1911:04d}-{digits[3:5]}"
    if len(digits)==6 and int(digits[:4])>1900:
        return f"{digits[:4]}-{digits[4:6]}"
    return ""

def quarter_key(row):
    year=str(pick(row,["年度","Year","資料年度"])).strip()
    q=str(pick(row,["季別","Quarter","季","資料季別"])).strip()
    yd="".join(ch for ch in year if ch.isdigit())
    qd="".join(ch for ch in q if ch.isdigit())
    if yd:
        y=int(yd)
        if y<1900: y+=1911
        if qd:
            return f"{y:04d}-Q{qd[-1]}"
    return ""

def save_monthly_snapshot(companies, now):
    month_rows={}
    for code,x in companies.items():
        r=x.get("revenue",{})
        ym=roc_to_ad_year(pick(r,["資料年月","年月","YearMonth"]))
        if not ym:
            continue
        month_rows.setdefault(ym,{})[code]={
            "market":x.get("market"),
            "company":pick(r,["公司名稱","CompanyName"]),
            "industry":pick(r,["產業別","Industry"]),
            "revenue":r
        }
    for ym, rows in month_rows.items():
        p=DATA/"history/monthly"/f"{ym}.json"
        old={}
        if p.exists():
            try: old=json.loads(p.read_text(encoding="utf-8")).get("companies",{})
            except: old={}
        old.update(rows)
        p.write_text(json.dumps({
            "period":ym,"updated_at":now.isoformat(),"companies":old
        },ensure_ascii=False,separators=(",",":")),encoding="utf-8")

def save_quarterly_snapshot(companies, now):
    periods={}
    for code,x in companies.items():
        inc=x.get("income",{})
        bal=x.get("balance",{})
        key=quarter_key(inc) or quarter_key(bal)
        if not key:
            # fallback to current quarter only when API omits explicit period
            m=now.month
            q=(m-1)//3+1
            key=f"{now.year:04d}-Q{q}"
        periods.setdefault(key,{})[code]={
            "market":x.get("market"),
            "income":inc,
            "balance":bal
        }
    for key,rows in periods.items():
        p=DATA/"history/quarterly"/f"{key}.json"
        old={}
        if p.exists():
            try: old=json.loads(p.read_text(encoding="utf-8")).get("companies",{})
            except: old={}
        old.update(rows)
        p.write_text(json.dumps({
            "period":key,"updated_at":now.isoformat(),"companies":old
        },ensure_ascii=False,separators=(",",":")),encoding="utf-8")

def build_index():
    monthly=sorted(p.stem for p in (DATA/"history/monthly").glob("*.json"))
    quarterly=sorted(p.stem for p in (DATA/"history/quarterly").glob("*.json"))
    idx={
        "monthly_periods":monthly[-84:],  # up to 7 years
        "quarterly_periods":quarterly[-28:],
        "monthly_count":len(monthly),
        "quarterly_count":len(quarterly)
    }
    (DATA/"history/index.json").write_text(
        json.dumps(idx,ensure_ascii=False,indent=2),encoding="utf-8"
    )

def main():
    now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    datasets={}
    errors={}
    for name,url in SOURCES.items():
        rows,err=safe_fetch(name,url)
        datasets[name]=rows
        if err: errors[name]=err

    companies={}
    for prefix,market in (("twse","上市"),("tpex","上櫃")):
        merge_by_code(companies,datasets.get(prefix+"_company",[]),"company",market)
        merge_by_code(companies,datasets.get(prefix+"_revenue",[]),"revenue",market)
        merge_by_code(companies,datasets.get(prefix+"_income_ci",[]),"income",market)
        merge_by_code(companies,datasets.get(prefix+"_balance_ci",[]),"balance",market)
    merge_by_code(companies,datasets.get("twse_valuation",[]),"valuation","上市")
    merge_by_code(companies,datasets.get("twse_quote",[]),"quote","上市")

    payload={
        "meta":{
            "version":"4.1",
            "edition":"Fundamental Historical",
            "updated_at_taipei":now.isoformat(),
            "company_count":len(companies),
            "sources":SOURCES,
            "errors":errors,
            "note":"Official public snapshots; historical series accumulates over time."
        },
        "companies":companies
    }
    (DATA/"fundamentals.json").write_text(
        json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8"
    )
    (DATA/"status.json").write_text(
        json.dumps(payload["meta"],ensure_ascii=False,indent=2),encoding="utf-8"
    )

    save_monthly_snapshot(companies,now)
    save_quarterly_snapshot(companies,now)
    build_index()

if __name__=="__main__":
    main()
