"""
Downloads Brent crude oil prices (daily) from FRED and averages to monthly.

*** RUN THIS ON YOUR OWN COMPUTER, IN YOUR OWN TERMINAL/VS CODE ***
FRED's CSV download endpoint needs no API key, but Claude's linked-device
session cannot reach api.stlouisfed.org (blocked by its own network
allowlist), so run this yourself.

Series used: DCOILBRENTEU ("Crude Oil Prices: Brent - Europe", daily, $/barrel)
https://fred.stlouisfed.org/series/DCOILBRENTEU

Output: brent_oil_monthly.csv, columns: Date (YYYY-MM-01), Brent_Oil_USD
"""

import csv
from pathlib import Path

import pandas as pd
import requests

SERIES_ID = "DCOILBRENTEU"
CSV_URL = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES_ID}"


def main():
    print(f"GET {CSV_URL}")
    resp = requests.get(CSV_URL, timeout=30)
    resp.raise_for_status()

    out_raw = Path(__file__).parent / "brent_oil_daily_RAW.csv"
    out_raw.write_bytes(resp.content)

    df = pd.read_csv(out_raw)
    df.columns = ["Date", "Brent_Oil_USD"]
    df["Date"] = pd.to_datetime(df["Date"])
    df["Brent_Oil_USD"] = pd.to_numeric(df["Brent_Oil_USD"], errors="coerce")
    df = df.dropna(subset=["Brent_Oil_USD"])

    monthly = (
        df.set_index("Date")["Brent_Oil_USD"]
        .resample("MS")
        .mean()
        .round(2)
        .reset_index()
    )
    monthly["Date"] = monthly["Date"].dt.strftime("%Y-%m-%d")

    out_path = Path(__file__).parent / "brent_oil_monthly.csv"
    monthly.to_csv(out_path, index=False)
    print(f"Wrote {len(monthly)} monthly rows to {out_path}")
    print(monthly.head())
    print(monthly.tail())


if __name__ == "__main__":
    main()
