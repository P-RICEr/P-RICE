"""
P-RICE: build the 8 rice CSV files from their sources, in Python.

Replaces the copy-paste steps in Excel, so the dataset can be rebuilt and
checked by anyone. Run update_data.py first (it fills the "latest" folder).

    cd "Model Development/data_pipeline"
    python build_dataset.py            # build + compare, changes nothing
    python build_dataset.py --apply    # also overwrite the 8 rice CSVs

Inputs
  Updated_Masterfile_Complete.xlsx   weekly DA retail prices (8 rice types)
  latest/weather_weekly.csv          NASA POWER rainfall and temperature
  latest/brent_oil_monthly.csv       Brent crude oil (FRED / EIA)
  latest/openstat_rice_stocks.csv    PSA rice stocks ("Rice: Commercial Stock")
  latest/openstat_volume_of_production.csv   PSA palay production
  latest/openstat_farmgate.csv       PSA palay farmgate price (if downloaded)
  sources/Inflation Rate.xls         BSP inflation rate
  sources/Exchange Rate Processed.xlsx   BSP peso per US dollar
  sources/farmgate_monthly.csv       optional: Date (YYYY-MM), Farmgate_PHP_kg

How weeks get monthly and quarterly values
  Each week (dated by its Saturday) takes the value of the calendar month
  that the Saturday falls in. Volume of production is quarterly: each week
  takes its quarter's total divided by 13 (the number of weeks in a
  quarter), as in the original masterfile. The notebook then uses these
  values and their 1-period lags as features.
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE.parent
LATEST = HERE / "latest"
SOURCES = HERE / "sources"
BUILD = HERE / "build"
MASTERFILE = MODEL_DIR / "Updated_Masterfile_Complete.xlsx"

RICE = {  # output file -> price column in the masterfile
    "Local Special Rice.csv": "Special_PHP_kg_L",
    "Local Premium Rice.csv": "Premium_PHP_kg_L",
    "Local Well-milled Rice.csv": "Well-milled_PHP_kg_L",
    "Local Regular-Milled Rice.csv": "Regular-milled_PHP_kg_L",
    "Imported Special Rice.csv": "Special_PHP_kg_I",
    "Imported Premium Rice.csv": "Premium_PHP_kg_I",
    "Imported Well-milled Rice.csv": "Well-milled_PHP_kg_I",
    "Imported Regular-milled Rice.csv": "Regular-milled_PHP_kg_I",
}
FACTORS = ["Brent_Oil_USD", "Farmgate_LCU_tonne", "Inflation_Rate", "Stocks_MT",
           "USD_to_PHP", "Temp_C", "Rainfall_mm", "VoP_MT"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def say(msg=""):
    print(msg, flush=True)


def month_series(dates, values, name):
    s = pd.Series(list(values), index=pd.PeriodIndex(pd.to_datetime(list(dates)), freq="M"), name=name)
    return s[~s.index.duplicated(keep="last")].sort_index()


# ------------------------------------------------------------ sources

def brent():
    df = pd.read_csv(LATEST / "brent_oil_monthly.csv", parse_dates=["Date"])
    return month_series(df["Date"], df["Brent_Oil_USD"], "Brent_Oil_USD"), "FRED/EIA"


def stocks():
    df = pd.read_csv(LATEST / "openstat_rice_stocks.csv")
    value = df.columns[-1]
    df = df[df["Sector"] == "Rice: Commercial Stock"].dropna(subset=[value])
    dates = pd.to_datetime(df["Year"].astype(str) + "-" + df["Month"].map(lambda m: MONTHS.index(m) + 1).astype(str) + "-01")
    return month_series(dates, df[value], "Stocks_MT"), "PSA OpenSTAT (Rice: Commercial Stock)"


def volume_of_production():
    df = pd.read_csv(LATEST / "openstat_volume_of_production.csv")
    value = df.columns[-1]
    df = df[(df["Ecosystem/Croptype"] == "Palay") & (df["Geolocation"] == "PHILIPPINES")
            & df["Period"].str.startswith("Quarter")].dropna(subset=[value])
    rows = []
    for _, r in df.iterrows():
        q = int(r["Period"][-1])
        for m in range(3 * q - 2, 3 * q + 1):
            rows.append((pd.Timestamp(int(r["Year"]), m, 1), r[value] / 13))
    d, v = zip(*rows)
    return month_series(d, v, "VoP_MT"), "PSA OpenSTAT (Palay, Philippines, quarterly / 13)"


def bsp_monthly(path, sheet, year_col, month_col, value_col, name):
    raw = pd.read_excel(path, sheet_name=sheet, header=None)
    year = pd.to_numeric(raw[year_col], errors="coerce").ffill()
    month = raw[month_col].astype(str).str.strip()
    keep = month.isin(MONTHS) & year.notna()
    dates = [pd.Timestamp(int(y), MONTHS.index(m) + 1, 1) for y, m in zip(year[keep], month[keep])]
    values = pd.to_numeric(raw.loc[keep, value_col], errors="coerce")
    return month_series(dates, values, name).dropna()


def inflation():
    s = bsp_monthly(SOURCES / "Inflation Rate.xls", "Monthly", 2, 3, 5, "Inflation_Rate")
    return s, "BSP (Inflation Rate.xls)"


def exchange_rate():
    s = bsp_monthly(SOURCES / "Exchange Rate Processed.xlsx", "monthly", 1, 2, 3, "USD_to_PHP")
    return s, "BSP (Exchange Rate Processed.xlsx, monthly average)"


def farmgate():
    manual = SOURCES / "farmgate_monthly.csv"
    if manual.exists():
        df = pd.read_csv(manual)
        return (month_series(df["Date"], df["Farmgate_PHP_kg"] * 1000, "Farmgate_LCU_tonne"),
                "sources/farmgate_monthly.csv (PHP/kg x 1000)")
    downloaded = LATEST / "openstat_farmgate.csv"
    if downloaded.exists():
        df = pd.read_csv(downloaded)
        if "Table" not in df:
            df.insert(0, "Table", "openstat")
        series, labels = [], []
        for table, t in df.groupby("Table", sort=False):
            t = t.dropna(axis=1, how="all")
            value = t.columns[-1]
            period = next((c for c in t.columns if c.lower() in ("period", "month")), None)
            year = next((c for c in t.columns if c.lower() == "year"), None)
            commodity = next((c for c in t.columns if "commodity" in c.lower()), None)
            if not period or not year:
                continue
            t = t[t[period].astype(str).str.strip().isin(MONTHS)].dropna(subset=[value])
            if commodity:
                # One palay series: prefer "Other Variety" (ordinary palay), else the first one.
                names = list(t[commodity].unique())
                if not names:
                    continue
                pick = next((n for n in names if "OTHER" in str(n).upper()), names[0])
                t = t[t[commodity] == pick]
                labels.append(f"{table}: {pick}")
            dates = pd.to_datetime(t[year].astype(int).astype(str) + "-"
                                   + t[period].str.strip().map(lambda m: MONTHS.index(m) + 1).astype(str) + "-01")
            series.append(month_series(dates, t[value] * 1000, "Farmgate_LCU_tonne"))
        if series:
            # Newest table wins where tables overlap; older tables fill earlier years.
            series.sort(key=lambda s: s.index.max())
            out = series[-1]
            for older in reversed(series[:-1]):
                both = out.index.intersection(older.index)
                if len(both):
                    gap = (out[both] - older[both]).abs().mean() / 1000
                    print(f"  farmgate tables overlap {len(both)} months, mean difference PHP {gap:.2f}/kg")
                out = out.combine_first(older)
            return out.rename("Farmgate_LCU_tonne"), "PSA OpenSTAT (" + "; ".join(labels) + ", PHP/kg x 1000)"
    raise FileNotFoundError(
        "no farmgate source yet: run update_data.py --only farmgate, or add sources/farmgate_monthly.csv")


# ---------------------------------------------------------------- build

def weekly_frame():
    m = pd.read_excel(MASTERFILE)
    m["Date"] = pd.to_datetime(m["Date"])
    weather = pd.read_csv(LATEST / "weather_weekly.csv", parse_dates=["Date"])
    df = m[["Date"] + list(RICE.values())].merge(weather, on="Date", how="left")
    month = df["Date"].dt.to_period("M")
    sources = {"Temp_C": "NASA POWER", "Rainfall_mm": "NASA POWER"}
    for loader in [brent, farmgate, inflation, stocks, exchange_rate, volume_of_production]:
        try:
            s, src = loader()
        except Exception as e:
            say(f"  ! {loader.__name__}: {e}")
            continue
        df[s.name] = month.map(s)
        sources[s.name] = src
    return df, sources


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="overwrite the 8 rice CSVs")
    args = ap.parse_args()

    say("Building the weekly dataset from its sources")
    df, sources = weekly_frame()
    BUILD.mkdir(exist_ok=True)

    say()
    say(f"{'Factor':<20} {'Source':<52} Missing weeks")
    problems = []
    for f in FACTORS:
        if f not in df:
            say(f"{f:<20} {'(not built)':<52} all")
            problems.append(f)
            continue
        miss = df[f].isna()
        say(f"{f:<20} {sources[f]:<52} {int(miss.sum())}")
        if miss.any():
            problems.append(f)

    old = pd.read_csv(MODEL_DIR / "Local Special Rice.csv")
    old["Date"] = pd.to_datetime(old["Date"])
    cmp = df.merge(old, on="Date", suffixes=("_new", "_old"))
    say()
    say("Compared with the current Local Special Rice.csv (mean absolute difference)")
    for f in FACTORS:
        if f + "_new" in cmp and f + "_old" in cmp:
            diff = (cmp[f + "_new"] - cmp[f + "_old"]).abs().mean()
            say(f"  {f:<20} {diff:,.3f}{'   <- changed' if diff > 0.01 else ''}")

    for file, price in RICE.items():
        out = df[["Date", price] + [f for f in FACTORS if f in df]].copy()
        out = out.round({"Brent_Oil_USD": 2, "Inflation_Rate": 1, "Stocks_MT": 2, "USD_to_PHP": 4,
                         "Temp_C": 2, "Rainfall_mm": 2, "VoP_MT": 2, "Farmgate_LCU_tonne": 0})
        out["Date"] = out["Date"].map(lambda d: f"{d.month}/{d.day}/{d.year}")
        out.to_csv(BUILD / file, index=False)
    say()
    say(f"Built files saved in {BUILD.relative_to(MODEL_DIR)}/")

    if args.apply:
        if problems:
            say(f"NOT applied: these factors are missing or incomplete: {', '.join(problems)}")
            return 1
        for file in RICE:
            (MODEL_DIR / file).write_text((BUILD / file).read_text())
        say("Applied: the 8 rice CSVs in Model Development were replaced. Re-run the notebooks.")
    else:
        say("Nothing in Model Development was changed. Use --apply to replace the 8 rice CSVs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
