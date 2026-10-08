"""
P-RICE: build the MONTHLY 1990-2026 dataset (4 rice types) in Python.

This is the dataset Demeter chose for the final paper: PSA monthly retail
prices from 1990 to 2026 (sources/Rice_Data_Pivoted.xlsx), with no
local/imported split. It does not touch the current 8 weekly CSVs; the
new files go to "Model Development/monthly_1990/".

Run update_data.py from 1990 first, so Brent and weather cover the whole
period:

    cd "Model Development/data_pipeline"
    python update_data.py --start 1990-01-01
    python build_monthly.py

Factors, all aligned to the SAME calendar month as the price (no shift):
  Brent_Oil_USD       latest/brent_oil_monthly.csv          FRED / EIA
  Farmgate_LCU_tonne  sources/farmgate_monthly.csv          PSA (PHP/kg x 1000), if available
  Inflation_Rate      sources/Inflation Rate.xls            BSP
  Stocks_MT           latest/openstat_rice_stocks.csv       PSA "Rice: Commercial Stock"
  USD_to_PHP          sources/Exchange Rate Processed.xlsx  BSP monthly average
  Temp_C, Rainfall_mm latest/weather_monthly.csv            NASA POWER (monthly mean of daily values)
  VoP_MT              latest/openstat_volume_of_production.csv  PSA palay, quarter total / 3
"""

import sys
from pathlib import Path

import pandas as pd

import build_dataset as wk  # reuse the source readers (same files, same rules)

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE.parent
OUT = MODEL_DIR / "monthly_1990"
PRICES = HERE / "sources" / "Rice_Data_Pivoted.xlsx"

RICE = {  # output file -> (column in Rice_Data_Pivoted.xlsx, price column name in the CSV)
    "Special Rice.csv": ("Rice_Special_PHP_kg", "Special_PHP_kg_PH"),
    "Premium Rice.csv": ("Rice_Premium_PHP_kg", "Premium_PHP_kg_PH"),
    "Well-milled Rice.csv": ("Rice_Well_Milled_PHP_kg", "Well-milled_PHP_kg_PH"),
    "Regular-milled Rice.csv": ("Rice_Regular_Milled_PHP_kg", "Regular-milled_PHP_kg_PH"),
}
MAX_FILL = 3  # fill at most 3 missing months in a row (straight line between known months)


def say(msg=""):
    print(msg, flush=True)


def monthly_weather():
    df = pd.read_csv(wk.LATEST / "weather_monthly.csv", parse_dates=["Date"])
    df = df[df["Complete"]]  # only months with every day available
    idx = pd.PeriodIndex(df["Date"], freq="M")
    return (pd.Series(df["Temp_C"].values, index=idx, name="Temp_C"),
            pd.Series(df["Rainfall_mm"].values, index=idx, name="Rainfall_mm"))


def volume_monthly():
    s, _ = wk.volume_of_production()  # quarter total / 13 per week
    return (s * 13 / 3).rename("VoP_MT")  # -> quarter total / 3 per month


def suspicious_spikes(s, pct=0.15):
    """Months that jump by more than `pct` and come straight back next month."""
    out = []
    v = s.dropna()
    for i in range(1, len(v) - 1):
        a, b, c = v.iloc[i - 1], v.iloc[i], v.iloc[i + 1]
        if abs(b / a - 1) > pct and abs(c / b - 1) > pct and (b - a) * (c - b) < 0:
            out.append((v.index[i], a, b, c))
    return out


def main():
    if not PRICES.exists():
        say(f"Missing {PRICES.relative_to(MODEL_DIR)}: put Rice_Data_Pivoted.xlsx in data_pipeline/sources/")
        return 1

    raw = pd.read_excel(PRICES)
    raw["Date"] = pd.to_datetime(raw["Date"])
    prices = raw.set_index(pd.PeriodIndex(raw["Date"], freq="M")).drop(columns="Date")

    say("Rice prices (sources/Rice_Data_Pivoted.xlsx)")
    for file, (col, _) in RICE.items():
        s = prices[col]
        first = s.first_valid_index()
        gaps = s[first:].isna().sum()
        say(f"  {file:<24} {first} to {s.last_valid_index()}  ({s.notna().sum()} months, {gaps} missing inside)")
        for when, a, b, c in suspicious_spikes(s):
            say(f"    check {when}: {a:.2f} -> {b:.2f} -> {c:.2f}  (one-month spike, possible typo)")

    factors = {}
    sources = {}
    loaders = {
        "Brent_Oil_USD": wk.brent,
        "Farmgate_LCU_tonne": wk.farmgate,
        "Inflation_Rate": wk.inflation,
        "Stocks_MT": wk.stocks,
        "USD_to_PHP": wk.exchange_rate,
    }
    for name, loader in loaders.items():
        try:
            s, src = loader()
            factors[name], sources[name] = s, src
        except Exception as e:
            say(f"  ! {name}: {e}")
    try:
        t, r = monthly_weather()
        factors["Temp_C"], factors["Rainfall_mm"] = t, r
        sources["Temp_C"] = sources["Rainfall_mm"] = "NASA POWER (monthly mean)"
    except Exception as e:
        say(f"  ! weather: {e}")
    try:
        factors["VoP_MT"] = volume_monthly()
        sources["VoP_MT"] = "PSA OpenSTAT (Palay, Philippines, quarterly / 3)"
    except Exception as e:
        say(f"  ! volume of production: {e}")

    full = pd.period_range("1990-01", prices.index.max(), freq="M")
    say()
    say(f"{'Factor':<20} {'Covers':<22} {'Missing 1990-' + str(full.max().year):<16} Source")
    missing_any = []
    for f in wk.FACTORS:
        if f not in factors:
            say(f"{f:<20} {'(not available)':<22} {'all':<16}")
            missing_any.append(f)
            continue
        s = factors[f].reindex(full)
        miss = int(s.isna().sum())
        cover = f"{factors[f].index.min()} to {factors[f].index.max()}"
        say(f"{f:<20} {cover:<22} {miss:<16} {sources[f]}")
        if miss:
            missing_any.append(f)

    OUT.mkdir(exist_ok=True)
    for file, (col, price_name) in RICE.items():
        s = prices[col]
        s = s[s.first_valid_index():]
        filled = s.interpolate(limit=MAX_FILL, limit_area="inside")
        df = pd.DataFrame({price_name: filled.round(2)})
        for f in wk.FACTORS:
            if f in factors:
                df[f] = factors[f].reindex(df.index)
        df = df.round({"Brent_Oil_USD": 2, "Inflation_Rate": 1, "Stocks_MT": 2, "USD_to_PHP": 4,
                       "Temp_C": 2, "Rainfall_mm": 2, "VoP_MT": 2, "Farmgate_LCU_tonne": 0})
        df.insert(0, "Date", [f"{p.month}/1/{p.year}" for p in df.index])
        df.to_csv(OUT / file, index=False)
        n_filled = int(filled.notna().sum() - s.notna().sum())
        complete = df.dropna()
        say(f"  wrote {file:<24} {len(df)} months"
            + (f", {n_filled} filled" if n_filled else "")
            + f", {len(complete)} with every factor ({complete['Date'].iloc[0] if len(complete) else '-'} to "
              f"{complete['Date'].iloc[-1] if len(complete) else '-'})")

    say()
    say(f"Saved in Model Development/{OUT.name}/. The current weekly CSVs were not changed.")
    if missing_any:
        say("Still missing: " + ", ".join(missing_any))
        say("  Brent / weather before 2023: run  python update_data.py --start 1990-01-01")
        say("  Farmgate: add sources/farmgate_monthly.csv (Date YYYY-MM, Farmgate_PHP_kg)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
