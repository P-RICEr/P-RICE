"""
P-RICE: automatic download of the latest data for the market factors.

Run on your own computer (it needs internet access to FRED, NASA POWER and
PSA OpenSTAT):

    cd "Model Development/data_pipeline"
    pip install requests pandas
    python update_data.py

What it downloads (no API keys needed):
  1. Brent crude oil, monthly (FRED series MCOILBRENTEU)
  2. Rainfall and temperature, daily (NASA POWER, same point and
     parameters as the paper: PRECTOTCORR and T2M at 14.5995 N, 120.9842 E)
  3. Rice stocks inventory (PSA OpenSTAT table 0032E4ECNV0)
  4. Volume of palay production (PSA OpenSTAT table 0012E4EVCP0)

What it does NOT download (still manual, see README_DATA_PIPELINE.md):
  - Weekly retail rice prices (DA Price Monitoring PDFs)
  - Farmgate price (PSA price situationer / FAOSTAT)
  - Inflation and exchange rate (BSP .xls files)

Everything is saved in the "latest" folder next to this script. The model's
CSV files are NOT changed. At the end, the script compares the new
downloads with the values already in "Local Special Rice.csv" for the dates
they share, so you can see whether they match before using them.

Each source is downloaded separately: if one site is down, the others
still finish.
"""

import argparse
import sys
import time
from datetime import date
from io import StringIO
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
OUT = HERE / "latest"
MODEL_DIR = HERE.parent
REFERENCE_CSV = MODEL_DIR / "Local Special Rice.csv"

START = "2023-08-01"          # first month of the P-RICE dataset
TIMEOUT = 60
# A normal browser User-Agent: some sites (FRED) reset connections from
# scripts that do not send one.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/csv,application/json,text/plain,*/*",
}

FRED_SERIES = "MCOILBRENTEU"   # Brent crude, USD per barrel, monthly average
NASA_LAT, NASA_LON = 14.5995, 120.9842
# Folder and table IDs as they appear in the OpenSTAT browse link
# (.../pxweb/en/DB/DB__2E__CS/0032E4ECNV0.px). In the link, "__" separates
# folders, so the API path is DB/2E/CS/<table>.
OPENSTAT_TABLES = {
    "rice_stocks": ("DB", "DB__2E__CS", "0032E4ECNV0.px"),
    "volume_of_production": ("DB", "DB__2E__CS", "0012E4EVCP0.px"),
}
OPENSTAT_API = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/"


def say(msg=""):
    print(msg, flush=True)


# ---------------------------------------------------------------- FRED

def get_with_retry(urls, tries=3):
    """GET the first URL that works, retrying each a few times."""
    last = None
    for url in urls:
        for attempt in range(tries):
            try:
                resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
                resp.raise_for_status()
                return resp
            except requests.RequestException as e:
                last = e
                time.sleep(2 * (attempt + 1))
    raise last


def fetch_brent(start=START):
    resp = get_with_retry([
        f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={FRED_SERIES}",
        f"https://fred.stlouisfed.org/series/{FRED_SERIES}/downloaddata/{FRED_SERIES}.csv",
    ])
    df = pd.read_csv(StringIO(resp.text))
    date_col = df.columns[0]                     # "observation_date" or "DATE"
    df = df.rename(columns={date_col: "Date", FRED_SERIES: "Brent_Oil_USD"})
    df["Date"] = pd.to_datetime(df["Date"])
    df["Brent_Oil_USD"] = pd.to_numeric(df["Brent_Oil_USD"], errors="coerce")  # "." = missing
    df = df.dropna()
    return df[df["Date"] >= start].reset_index(drop=True)


# ---------------------------------------------------------- NASA POWER

def fetch_nasa_daily(start=START, end=None):
    end = end or date.today().strftime("%Y-%m-%d")
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters=PRECTOTCORR,T2M&community=AG"
        f"&longitude={NASA_LON}&latitude={NASA_LAT}"
        f"&start={start.replace('-', '')}&end={end.replace('-', '')}&format=JSON"
    )
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    params = resp.json()["properties"]["parameter"]
    df = pd.DataFrame({
        "Rainfall_mm": pd.Series(params["PRECTOTCORR"]),
        "Temp_C": pd.Series(params["T2M"]),
    })
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.astype(float).where(lambda x: x > -990)   # -999 = not available yet
    df = df.dropna(how="all")
    df.index.name = "Date"
    return df.reset_index()


def nasa_weekly(daily):
    # Same week grid as the rice price data: weeks ending on Saturday.
    weekly = (daily.set_index("Date")
                   .resample("W-SAT").agg(["mean", "count"]))
    out = pd.DataFrame({
        "Date": weekly.index,
        "Rainfall_mm": weekly[("Rainfall_mm", "mean")].values,
        "Temp_C": weekly[("Temp_C", "mean")].values,
        "Days": weekly[("Temp_C", "count")].values,
    })
    return out[out["Days"] == 7].drop(columns="Days").round({"Rainfall_mm": 2, "Temp_C": 2})   # complete weeks only


def nasa_monthly(daily):
    m = daily.set_index("Date").resample("MS").agg(["mean", "count"])
    days_in_month = m.index.days_in_month
    out = pd.DataFrame({
        "Date": m.index,
        "Rainfall_mm": m[("Rainfall_mm", "mean")].values,
        "Temp_C": m[("Temp_C", "mean")].values,
        "Complete": m[("Temp_C", "count")].values == days_in_month,
    })
    return out.round({"Rainfall_mm": 2, "Temp_C": 2})


# ------------------------------------------------------ PSA OpenSTAT

def openstat_candidates(db, folder, table):
    parts = folder.split("__")              # "DB__2E__CS" -> ["DB", "2E", "CS"]
    if parts[0] == db:
        parts = parts[1:]
    return [
        f"{OPENSTAT_API}{db}/{'/'.join(parts)}/{table}",   # DB/2E/CS/table (usual)
        f"{OPENSTAT_API}{db}/{folder}/{table}",            # DB/DB__2E__CS/table
        f"{OPENSTAT_API}{db}/{table}",                     # DB/table
    ]


def fetch_openstat(db, folder, table):
    """Download a whole PXWeb table as a long table with readable labels.

    Reads the table's own metadata first, so the variable codes do not
    need to be known in advance. Tries the usual API path forms, since the
    browse link and the API path are written differently.
    """
    meta, url, tried = None, None, []
    for candidate in openstat_candidates(db, folder, table):
        tried.append(candidate)
        r = requests.get(candidate, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200 and "variables" in r.text:
            meta, url = r, candidate
            break
    if meta is None:
        raise RuntimeError("table not found at: " + " | ".join(tried))
    say(f"     found at {url}")
    variables = meta.json()["variables"]

    query = {
        "query": [{"code": v["code"], "selection": {"filter": "all", "values": ["*"]}}
                  for v in variables],
        "response": {"format": "json"},
    }
    resp = requests.post(url, json=query, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    payload = resp.json()

    labels = {v["code"]: dict(zip(v["values"], v.get("valueTexts", v["values"])))
              for v in variables}
    key_cols = [c for c in payload["columns"] if c.get("type") in ("d", "t")]
    val_cols = [c for c in payload["columns"] if c.get("type") == "c"]

    rows = []
    for item in payload["data"]:
        row = {}
        for col, code in zip(key_cols, item["key"]):
            row[col["text"]] = labels.get(col["code"], {}).get(code, code)
        for col, value in zip(val_cols, item["values"]):
            row[col["text"]] = pd.to_numeric(value, errors="coerce")  # ".." = missing
        rows.append(row)
    return pd.DataFrame(rows), [v["text"] for v in variables]


# ------------------------------------------------------------ checking

def compare_with_existing(weekly_nasa, brent):
    """Compare new downloads with the values already in the model data."""
    if not REFERENCE_CSV.exists():
        say(f"  (skipped: {REFERENCE_CSV.name} not found)")
        return
    ref = pd.read_csv(REFERENCE_CSV)
    ref["Date"] = pd.to_datetime(ref["Date"])

    if weekly_nasa is not None:
        m = ref.merge(weekly_nasa, on="Date", suffixes=("_old", "_new"))
        for col in ["Rainfall_mm", "Temp_C"]:
            if f"{col}_old" in m and len(m):
                diff = (m[f"{col}_old"] - m[f"{col}_new"]).abs()
                say(f"  {col:<14} {len(m):>3} shared weeks | mean difference {diff.mean():.3f} "
                    f"| max {diff.max():.3f}")

    if brent is not None and "Brent_Oil_USD" in ref:
        ref_m = ref.assign(Month=ref["Date"].dt.to_period("M")).groupby("Month")["Brent_Oil_USD"].first()
        new_m = brent.assign(Month=brent["Date"].dt.to_period("M")).set_index("Month")["Brent_Oil_USD"]
        both = pd.concat([ref_m.rename("old"), new_m.rename("new")], axis=1).dropna()
        if len(both):
            diff = (both["old"] - both["new"]).abs()
            say(f"  {'Brent_Oil_USD':<14} {len(both):>3} shared months | mean difference {diff.mean():.3f} "
                f"| max {diff.max():.3f}")

    say("  A difference near 0 means the download matches the thesis data.")
    say("  A large difference means the thesis used a different source or alignment:")
    say("  check before adding new rows.")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--start", default=START, help="first date to download (YYYY-MM-DD)")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    summary, failed = [], []
    weekly, brent = None, None

    say("1/4  Brent crude oil (FRED)")
    try:
        brent = fetch_brent(args.start)
        brent.to_csv(OUT / "brent_oil_monthly.csv", index=False)
        summary.append(("Brent oil", f"{brent['Date'].max():%b %Y}", "brent_oil_monthly.csv"))
    except Exception as e:
        failed.append(("Brent oil (FRED)", e))

    say("2/4  Rainfall and temperature (NASA POWER)")
    try:
        daily = fetch_nasa_daily(args.start)
        weekly = nasa_weekly(daily)
        monthly = nasa_monthly(daily)
        daily.round({"Rainfall_mm": 2, "Temp_C": 2}).to_csv(OUT / "weather_daily.csv", index=False)
        weekly.to_csv(OUT / "weather_weekly.csv", index=False)
        monthly.to_csv(OUT / "weather_monthly.csv", index=False)
        summary.append(("Rainfall and temperature", f"{daily['Date'].max():%d %b %Y}",
                        "weather_daily / _weekly / _monthly.csv"))
    except Exception as e:
        failed.append(("Rainfall and temperature (NASA POWER)", e))

    for i, (name, table) in enumerate(OPENSTAT_TABLES.items(), start=3):
        say(f"{i}/4  {name.replace('_', ' ')} (PSA OpenSTAT)")
        try:
            df, var_names = fetch_openstat(*table)
            df.to_csv(OUT / f"openstat_{name}.csv", index=False)
            say(f"     variables: {', '.join(var_names)}")
            summary.append((name.replace("_", " ").capitalize(), f"{len(df)} rows",
                            f"openstat_{name}.csv"))
        except Exception as e:
            failed.append((f"{name} (OpenSTAT)", e))

    say()
    say("=" * 70)
    say("Downloaded")
    for name, latest, file in summary:
        say(f"  {name:<26} latest: {latest:<14} -> latest/{file}")
    if failed:
        say()
        say("Failed (the others are fine)")
        for name, e in failed:
            say(f"  {name}: {type(e).__name__}: {str(e)[:150]}")

    say()
    say("Check against the thesis data (Local Special Rice.csv)")
    compare_with_existing(weekly, brent)
    say("=" * 70)
    say("The model's CSV files were not changed.")
    return 1 if failed and not summary else 0


if __name__ == "__main__":
    sys.exit(main())
