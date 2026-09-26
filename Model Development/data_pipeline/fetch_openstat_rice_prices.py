"""
Pulls monthly Philippine retail rice prices (2018-based series) from PSA
OpenSTAT via the PXWeb API.

*** RUN THIS ON YOUR OWN COMPUTER, IN YOUR OWN TERMINAL/VS CODE ***
Claude's linked-device session cannot reach openstat.psa.gov.ph (blocked
by its own network allowlist), so this has to be run by you directly.

Table: DB/2M/2018NEW/0042M4ARN01.px
Covers: Well-milled, Regular-milled, Special (no Premium in this table,
        and no Local/Imported split -- that split only exists in the
        weekly DA data used for the original weekly notebook).

Output: openstat_rice_prices_monthly.csv, in the same folder as this
script (Model Development/), with columns: Date, Variety, Price_PHP_kg

If this script errors, the most likely cause is that PSA changed the
table's variable codes. Open the table in your browser first to check:
https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__2018NEW/0042M4ARN01.px
and adjust COMMODITY_CODES / GEO_CODE below to match what you see there.
"""

import json
import sys
from pathlib import Path

import requests

API_URL = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/2018NEW/0042M4ARN01.px"

GEO_CODE = "000000000"  # Philippines (whole country)
COMMODITY_CODES = {
    "0": "Well-milled",
    "1": "Regular-milled",
    "2": "Special",
}

QUERY = {
    "query": [
        {"code": "Geolocation", "selection": {"filter": "item", "values": [GEO_CODE]}},
        {"code": "Commodity", "selection": {"filter": "item", "values": list(COMMODITY_CODES)}},
        {"code": "Year", "selection": {"filter": "all", "values": ["*"]}},
        {"code": "Period", "selection": {"filter": "all", "values": ["*"]}},
    ],
    "response": {"format": "json"},
}


def main():
    print(f"POST {API_URL}")
    resp = requests.post(API_URL, json=QUERY, timeout=30)
    if resp.status_code != 200:
        print(f"ERROR: status {resp.status_code}")
        print(resp.text[:1000])
        sys.exit(1)

    data = resp.json()
    columns = [c["text"] for c in data["columns"]]
    print("Columns returned:", columns)

    rows = []
    for item in data["data"]:
        key = item["key"]  # [geo, commodity, year, period]
        value = item["values"][0]
        if value in ("..", ":", ""):
            continue
        _, commodity_code, year, period = key
        variety = COMMODITY_CODES.get(commodity_code, commodity_code)
        month = int(period)  # PXWeb months are usually 0-11 or 1-12; verify below
        rows.append({"Year": int(year), "Month": month, "Variety": variety, "Price_PHP_kg": float(value)})

    if not rows:
        print("WARNING: no rows returned. Check the query codes above.")
        sys.exit(1)

    out_path = Path(__file__).parent / "openstat_rice_prices_monthly.csv"
    import csv

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Year", "Month", "Variety", "Price_PHP_kg"])
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows to {out_path}")
    print("Double-check the first few rows below -- especially whether Month")
    print("looks like it starts at 0 (Jan=0) or 1 (Jan=1), and fix merge_monthly_dataset.py")
    print("accordingly if needed.")
    for r in rows[:5]:
        print(r)


if __name__ == "__main__":
    main()
