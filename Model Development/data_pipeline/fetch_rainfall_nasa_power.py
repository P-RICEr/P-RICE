"""
Downloads monthly rainfall (precipitation) for the Philippines from NASA
POWER -- a stand-in for PAGASA data while the eFOI/PAGASA request is
pending (per the handoff brief).

*** RUN THIS ON YOUR OWN COMPUTER, IN YOUR OWN TERMINAL/VS CODE ***
Claude's linked-device session cannot reach power.larc.nasa.gov (blocked
by its own network allowlist), so run this yourself.

Point used: Metro Manila (14.5995 N, 120.9842 E) as a national proxy --
same approach as the original weekly notebook. Swap in a
production/rice-growing-region coordinate later if the panel prefers it.

Output: rainfall_monthly.csv, columns: Date (YYYY-MM-01), Rainfall_mm
"""

import csv
from pathlib import Path

import requests

LAT, LON = 14.5995, 120.9842
START_YEAR, END_YEAR = 2018, 2026

URL = (
    "https://power.larc.nasa.gov/api/temporal/monthly/point"
    f"?parameters=PRECTOTCORR&community=AG&longitude={LON}&latitude={LAT}"
    f"&start={START_YEAR}&end={END_YEAR}&format=JSON"
)


def main():
    print(f"GET {URL}")
    resp = requests.get(URL, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    values = data["properties"]["parameter"]["PRECTOTCORR"]
    # Keys look like "201801", "201802", ... plus a "YYYY13" year-average key to skip.
    rows = []
    for key, val in values.items():
        if len(key) != 6:
            continue
        year, month = int(key[:4]), int(key[4:])
        if month == 13:
            continue
        if val in (-999, -999.0):  # NASA POWER's "missing" sentinel
            continue
        rows.append({"Date": f"{year:04d}-{month:02d}-01", "Rainfall_mm": round(val, 2)})

    rows.sort(key=lambda r: r["Date"])

    out_path = Path(__file__).parent / "rainfall_monthly.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Date", "Rainfall_mm"])
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} monthly rows to {out_path}")
    for r in rows[:3]:
        print(r)
    for r in rows[-3:]:
        print(r)


if __name__ == "__main__":
    main()
