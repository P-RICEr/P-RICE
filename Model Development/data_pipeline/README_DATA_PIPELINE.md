# Data pipeline: download and build the datasets

These scripts download the market factors automatically and build the
datasets the notebooks use, so nothing has to be copied by hand in Excel.

| Script | What it does | Changes the model's data? |
|---|---|---|
| `update_data.py` | Downloads the factors into `latest/` | No |
| `build_monthly.py` | Builds the **monthly 1990-2026** dataset (4 rice types) into `../monthly_1990/` | Only `monthly_1990/` |
| `build_dataset.py` | Rebuilds the **current weekly** dataset (8 rice types) into `build/` | Only with `--apply` |

Run them on your own computer. They need internet access to EIA/FRED,
NASA POWER and PSA OpenSTAT. No API keys are needed.

---

## Step-by-step

### Step 1: Install the libraries (one time)
```
pip install requests pandas openpyxl xlrd
```

### Step 2: Open a terminal in this folder
```
cd "C:\Users\<you>\Downloads\P-RICE\Model Development\data_pipeline"
```

### Step 3: Download the factors
For the monthly 1990-2026 dataset:
```
python update_data.py --start 1990-01-01
```
For the current dataset only (from August 2023):
```
python update_data.py
```
Just the farmgate price (faster):
```
python update_data.py --only farmgate
```

The download from 1990 takes a few minutes (36 years of daily weather). If
one website is down, the others still finish, and the script tells you
which one failed.

### Step 4: Build the dataset
Monthly 1990-2026 (4 rice types):
```
python build_monthly.py
```
Current weekly dataset (8 rice types), compare only:
```
python build_dataset.py
```
Then, only if the comparison looks right, overwrite the 8 weekly CSVs:
```
python build_dataset.py --apply
```

### Step 5: Run the notebooks again
New data means new results. Open the notebook and click **Run All**
(main README, Section 3).

---

## What gets downloaded (`update_data.py`)

| # | Data | Source | Saved as |
|---|---|---|---|
| 1 | Brent crude oil, monthly | FRED `MCOILBRENTEU`, or EIA `RBRTEm` if FRED is blocked | `latest/brent_oil_monthly.csv` |
| 2 | Rainfall and temperature | NASA POWER, `PRECTOTCORR` and `T2M` at 14.5995 N, 120.9842 E | `latest/weather_daily.csv`, `_weekly.csv`, `_monthly.csv` |
| 3 | Rice stocks | PSA OpenSTAT `0032E4ECNV0` | `latest/openstat_rice_stocks.csv` |
| 4 | Volume of palay production | PSA OpenSTAT `0012E4EVCP0` | `latest/openstat_volume_of_production.csv` |
| 5 | Palay farmgate price | PSA OpenSTAT Cereals farmgate tables `0032M4AFP01` (1990-2020) and `0032M4AFN01` (2010-2026) | `latest/openstat_farmgate.csv` |

At the end, the script compares the downloads with `Local Special
Rice.csv` for the dates they share. A difference near 0 means the download
matches the thesis data.

## Files kept in `sources/` (not downloadable by script)

| File | What it is |
|---|---|
| `Rice_Data_Pivoted.xlsx` | PSA monthly national retail prices, 1990-2026: Special, Premium, Well-milled, Regular-milled |
| `Inflation Rate.xls` | BSP inflation rate ("Monthly" sheet) |
| `Exchange Rate Processed.xlsx` | BSP peso per US dollar ("monthly" sheet, monthly average) |
| `farmgate_monthly.csv` (optional) | Your own farmgate data: columns `Date` (YYYY-MM) and `Farmgate_PHP_kg`. Used instead of the download if present |

---

## How the monthly 1990-2026 dataset is built (`build_monthly.py`)

Every factor uses the **same calendar month** as the price (no shift).

| Column | Source | How |
|---|---|---|
| `<Type>_PHP_kg_PH` | `sources/Rice_Data_Pivoted.xlsx` | Monthly retail price. Up to 3 missing months in a row are filled with a straight line |
| `Brent_Oil_USD` | EIA / FRED | Monthly average, USD per barrel |
| `Farmgate_LCU_tonne` | PSA OpenSTAT | Palay, Other Variety, dry, PHP/kg × 1000. The 2010-2026 table is used where both tables have data; the 1990-2020 table fills 1990-2009 |
| `Inflation_Rate` | BSP | Monthly, % |
| `Stocks_MT` | PSA OpenSTAT | "Rice: Commercial Stock", metric tons |
| `USD_to_PHP` | BSP | Monthly average |
| `Temp_C`, `Rainfall_mm` | NASA POWER | Monthly mean of daily values (complete months only) |
| `VoP_MT` | PSA OpenSTAT | Palay, Philippines, quarterly total ÷ 3 |

| Rice type | Starts | Months |
|---|---|---|
| Special | January 1995 | 378 |
| Premium | April 1996 | 363 |
| Well-milled | January 1990 | 438 |
| Regular-milled | January 1990 | 438 |

The script also flags one-month spikes that look like typos (for example,
Regular-milled in December 2016) so they can be checked against the source.

## How the weekly dataset is built (`build_dataset.py`)

Each week (dated by its Saturday) takes the value of the calendar month
that the Saturday falls in. Volume of production is quarterly: each week
takes its quarter's total divided by 13. The rice prices come from
`Updated_Masterfile_Complete.xlsx` (DA weekly price monitoring).

---

## How recent the data can be

Each source is released with a delay, so the newest complete month is
usually 1 to 2 months behind today.

| Data | Typical delay |
|---|---|
| NASA POWER weather | a few days |
| Exchange rate | daily |
| Brent oil, inflation | about 1 month |
| Rice stocks, farmgate | 1 to 2 months |
| Volume of production | quarterly |
| Retail rice prices | about 1 month (PSA), weekly (DA) |
