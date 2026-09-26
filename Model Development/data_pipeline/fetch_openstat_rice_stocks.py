"""
Pulls monthly Philippine palay/rice stocks inventory from PSA OpenSTAT.

*** RUN THIS ON YOUR OWN COMPUTER, IN YOUR OWN TERMINAL/VS CODE ***
Same reason as fetch_openstat_rice_prices.py -- Claude's linked-device
session cannot reach openstat.psa.gov.ph.

Table: DB/DB__2E__CS/0032E4ECNV0.px ("Palay and Rice Stocks Inventory")
Browse it first at:
https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2E__CS/0032E4ECNV0.px

This table's variable names/codes were not confirmed by testing (network
was blocked on Claude's side), so open the URL above, check the exact
variable codes (they may differ slightly -- e.g. "Stocks Holder" or
"Type of Stocks"), and adjust the QUERY dict below to match before running.

Output: openstat_rice_stocks_monthly.csv
"""

import csv
import sys
from pathlib import Path

import requests

API_URL = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/DB__2E__CS/0032E4ECNV0.px"

# TODO: confirm these codes by opening the table in your browser (see URL above)
# and checking the "API" / "Save query" option, which shows the exact JSON PXWeb expects.
QUERY = {
    "query": [
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
        print()
        print("If you get a 'variable not found' style error, open the table URL in your")
        print("browser, look for a way to view/export the query as JSON/API, and paste the")
        print("correct 'query' list into this script.")
        sys.exit(1)

    data = resp.json()
    print("Columns returned:", [c["text"] for c in data["columns"]])

    rows = []
    for item in data["data"]:
        key = item["key"]
        value = item["values"][0]
        if value in ("..", ":", ""):
            continue
        rows.append({"key": key, "value": value})

    out_path = Path(__file__).parent / "openstat_rice_stocks_monthly_RAW.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["key", "value"])
        for r in rows:
            w.writerow([json_dump(r["key"]), r["value"]])

    print(f"Wrote {len(rows)} raw rows to {out_path}")
    print("This is intentionally 'raw' (key/value) because the table's exact variable")
    print("layout wasn't confirmed. Open the CSV, check what 'key' looks like (it should")
    print("be [year, period] or similar), then tell Claude the format so the merge script")
    print("can be finished.")


def json_dump(obj):
    import json

    return json.dumps(obj)


if __name__ == "__main__":
    main()
