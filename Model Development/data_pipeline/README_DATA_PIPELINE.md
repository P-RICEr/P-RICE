# Getting the latest data

The thesis uses a **fixed dataset: August 2023 to June 2026**. Do not add
new months to the model's CSV files while the paper is being finished,
or every result in Chapter 4 will change.

This folder is for getting newer data **after** the thesis (or for
checking the "Next forecast" on the dashboard against real prices).

## Automatic: `update_data.py`

Run it on your own computer. It needs internet access to FRED, NASA
POWER and PSA OpenSTAT (Claude's sandbox cannot reach these sites).

```
cd "Model Development/data_pipeline"
pip install requests pandas
python update_data.py
```

| Data | Source | Saved as |
|---|---|---|
| Brent crude oil (monthly) | FRED, series `MCOILBRENTEU` | `latest/brent_oil_monthly.csv` |
| Rainfall and temperature (daily, weekly, monthly) | NASA POWER, `PRECTOTCORR` and `T2M` at 14.5995 N, 120.9842 E | `latest/weather_*.csv` |
| Rice stocks inventory | PSA OpenSTAT table `0032E4ECNV0` | `latest/openstat_rice_stocks.csv` |
| Volume of palay production | PSA OpenSTAT table `0012E4EVCP0` | `latest/openstat_volume_of_production.csv` |

No API keys are needed. If one website is down, the others still finish,
and the script tells you which one failed.

The script **does not change** the model's CSV files. At the end it
compares the new downloads with `Local Special Rice.csv` for the weeks
and months they share:

- a difference near **0** means the download matches the thesis data
- a large difference means the thesis used a different source or
  alignment, so check before adding new rows

Weekly weather uses weeks ending on **Saturday**, the same as the rice
price data. Only complete weeks are kept.

## Still manual

| Data | Where | Why manual |
|---|---|---|
| Weekly retail rice prices (8 types) | https://www.da.gov.ph/price-monitoring/ | Published as one PDF per week |
| Farmgate price | PSA price situationer / FAOSTAT | Published as reports, not an API |
| Inflation rate | https://www.bsp.gov.ph/SitePages/Statistics/Prices.aspx?TabId=1 | Downloaded as an .xls file |
| Exchange rate | https://www.bsp.gov.ph/sitepages/statistics/exchangerate.aspx | Downloaded as an .xls file |

## How recent the data can be

Each source is released with a delay, so the newest complete month is
usually 1 to 2 months behind today.

| Data | Typical delay |
|---|---|
| NASA POWER weather | a few days |
| Exchange rate | daily |
| DA retail prices | weekly |
| Brent oil, inflation | about 1 month |
| Rice stocks, farmgate | 1 to 2 months |
| Volume of production | quarterly |
