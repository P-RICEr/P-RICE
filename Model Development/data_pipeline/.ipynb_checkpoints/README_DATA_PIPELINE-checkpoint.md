# Monthly data pipeline (OpenSTAT / FRED / NASA POWER)

These scripts pull the predictors needed for the **monthly** version of
P-RICE. **Run them yourself, on your own computer, in your own
terminal/VS Code** — Claude's linked-device session cannot reach any of
these websites (confirmed blocked: OpenSTAT, FRED, NASA POWER, BSP). Only
GitHub is reachable from there. This isn't a bug to fix — it's how the
sandboxed session's network is set up — so this part has to run on your
side.

## One-time setup
```
pip install requests pandas openpyxl xlrd
```

## Run these, in this order

```
python fetch_openstat_rice_prices.py
python fetch_brent_oil_fred.py
python fetch_rainfall_nasa_power.py
python fetch_openstat_rice_stocks.py     # will need a fix — see below
```

Each one prints what it downloaded and writes a CSV next to itself. If one
fails with an error, **copy the whole error message and send it to
Claude/Yuri** rather than trying to fix the script yourself — some of the
OpenSTAT table codes couldn't be verified without internet access, so the
first run may need a small correction.

### Known unfinished piece: rice stocks
`fetch_openstat_rice_stocks.py` writes a "RAW" file because the exact
column layout of that OpenSTAT table couldn't be confirmed ahead of time.
After running it, open `openstat_rice_stocks_monthly_RAW.csv` and send it
back — the parsing will get finished once we can see what it actually
looks like.

### Farmgate price — no script yet
Farmgate price isn't a simple PXWeb table like the others (it's a
regular PSA web page, not an API), so for now, download it the same way
you did **Inflation Rate.xls** and **Exchange Rate Processed.xlsx** —
manually, as a file — from:
https://psa.gov.ph/farmgate-prices-palay/index
Save it into this same folder and let Claude know.

## What still needs to happen after all this

1. Put **Inflation Rate.xls**, **Exchange Rate Processed.xlsx**, and the
   farmgate file into this folder too.
2. Send Claude a note that everything is here — the merge script that
   combines all of these into one monthly table (matching what the main
   notebook's "Load data" cell expects) will be finished once every piece
   exists and its exact format has been checked.
3. **Important scope note:** OpenSTAT's rice price table only has
   **3 rice types** (Well-milled, Regular-milled, Special) with **no
   Local vs. Imported split** — that split only exists in the weekly DA
   data used for the original weekly notebook. So the monthly version of
   the model will cover 3 series, not 8, unless a different source with
   the Local/Imported split is found. This is exactly open decision #1
   from the handoff brief ("3 vs 8 rice types") — worth confirming with
   the adviser/panel before writing Chapter 3 around it.
