# P-RICE
An XGBoost Regression Based Model for Philippine Rice Price Forecasting

P-RICE forecasts the monthly retail price (PHP/kg) of Philippine rice, 1 to
6 months ahead, using XGBoost. It compares XGBoost with two benchmarks
(ARIMA and a Naive "same as last month" forecast), explains every forecast
with SHAP, and shows everything on a web dashboard.

The project has three parts. You run them in this order:

| # | Part | What it does | Folder |
|---|---|---|---|
| 1 | **Notebook (the model)** | Trains and tests the model, saves the results to Excel | `Model Development/` |
| 2 | **Backend (server)** | Reads the Excel and CSV files and sends the numbers to the website | `web/server/` |
| 3 | **Frontend (website)** | The dashboard you open in your browser | `web/client/` |

The website only **shows** what the notebook made. If you change the data
or settings, run the notebook again first, then refresh the website.

---

## Contents

1. [What's in this repository](#1-whats-in-this-repository)
2. [One-time setup](#2-one-time-setup)
3. [Run the notebook (the model)](#3-run-the-notebook-the-model)
4. [Run the backend (server)](#4-run-the-backend-server)
5. [Run the frontend (website)](#5-run-the-frontend-website)
6. [Quick start (after the first time)](#6-quick-start-after-the-first-time)
7. [Optional: AI features (Gemini)](#7-optional-ai-features-gemini)
8. [Optional: get the latest data](#8-optional-get-the-latest-data)
9. [Where to find the results (Chapter 4)](#9-where-to-find-the-results-chapter-4)
10. [Changing settings](#10-changing-settings)
11. [Troubleshooting](#11-troubleshooting)
12. [Getting updates](#12-getting-updates)

---

## 1. What's in this repository

```
P-RICE/
├── Model Development/
│   ├── P-RICE Model - All Rice Types (Monthly).ipynb   <- MAIN MODEL
│   ├── P-RICE Model - All Rice Types (Weekly).ipynb    <- weekly version (comparison)
│   ├── P-RICE Extra Analysis (Monthly).ipynb           <- ablation, Diebold-Mariano, future forecast
│   ├── P-RICE Results.xlsx          <- results of the main model (made by the notebook)
│   ├── P-RICE Results (Weekly).xlsx <- results of the weekly model
│   ├── P-RICE Extra Results.xlsx    <- results of the extra analysis
│   ├── Local/Imported ... Rice.csv  <- current dataset: 8 rice types + 8 factors
│   ├── monthly_1990/                <- new monthly dataset, 1990-2026, 4 rice types
│   └── data_pipeline/               <- scripts that download and build the data
└── web/
    ├── server/   <- backend (Node.js + Express)
    └── client/   <- frontend (React + Vite + Tailwind)
```

The 8 factors (predictors) are: Brent crude oil, farmgate price, inflation
rate, rice stocks, exchange rate (USD to PHP), temperature, rainfall, and
volume of production.

---

## 2. One-time setup

You only do this once per computer.

### Step 2.1: Install the tools

| Tool | Download | Notes |
|---|---|---|
| **Python 3.11 or newer** | https://www.python.org/downloads/ | During installation, **tick "Add python.exe to PATH"** |
| **Node.js (LTS)** | https://nodejs.org/ | Pick the **LTS** version. Click Next through every screen |
| **Git** | https://git-scm.com/downloads | Keep all the default options |
| **VS Code** | https://code.visualstudio.com/ | For opening the notebook |

In VS Code, open the **Extensions** tab (`Ctrl+Shift+X`) and install
**Python** and **Jupyter** (both by Microsoft).

**Check that everything installed:** open PowerShell (Start menu, type
`PowerShell`) and run these one at a time:
```
python --version
node -v
npm -v
git --version
```
Each one should print a version number. If one says "not recognized",
restart your computer and try again.

### Step 2.2: Download the project

In PowerShell, go to the folder where you want the project (for example
Downloads), then clone it:
```
cd $HOME\Downloads
git clone https://github.com/P-RICEr/P-RICE.git
cd P-RICE
```

No Git? On the GitHub page, click the green **Code** button, then
**Download ZIP**, and extract it. (You won't be able to use `git pull` for
updates.)

### Step 2.3: Install the Python libraries

Still in the `P-RICE` folder:
```
pip install xgboost scikit-learn pandas numpy matplotlib statsmodels openpyxl ipykernel requests xlrd
```
If `pip` is not recognized, use `py -m pip install ...` instead.

### Step 2.4: Install the website libraries

Backend:
```
cd web\server
npm install
cd ..\..
```
Frontend:
```
cd web\client
npm install
cd ..\..
```
Each `npm install` takes 1 to 2 minutes the first time. Yellow `npm warn`
messages are normal.

---

## 3. Run the notebook (the model)

### Step 3.1: Open the project in VS Code
1. Open VS Code.
2. **File > Open Folder**, then pick the **`P-RICE`** folder.
3. In the left sidebar, open **`Model Development/P-RICE Model - All Rice Types (Monthly).ipynb`**.

### Step 3.2: Choose the Python kernel
1. Click **Select Kernel** (top right of the notebook).
2. Choose **Python Environments**, then pick the Python you installed in Step 2.1.

### Step 3.3: Run it
1. Click **Run All** at the top of the notebook.
2. Wait about **2 to 5 minutes**. Section 7 (tuning and walk-forward
   testing for 6 horizons) is the slow part.
3. When it finishes, the result tables and charts are inside the notebook,
   and **`P-RICE Results.xlsx`** is saved in `Model Development/`.

**Close `P-RICE Results.xlsx` in Excel before running.** The notebook
cannot save over a file that is open.

### Step 3.4: The other notebooks (optional)

| Notebook | When to run it | Saves |
|---|---|---|
| `P-RICE Model - All Rice Types (Weekly).ipynb` | For the weekly vs monthly comparison | `P-RICE Results (Weekly).xlsx` |
| `P-RICE Extra Analysis (Monthly).ipynb` | After the main notebook. Ablation, Diebold-Mariano test, and the "Next forecast" on the website | `P-RICE Extra Results.xlsx` |

Open each one and click **Run All**, the same as Step 3.3.

---

## 4. Run the backend (server)

The backend reads the Excel and CSV files and sends the numbers to the
website. Keep it running while you use the dashboard.

### Step 4.1: Open a terminal in `web/server`
1. In File Explorer, open the `P-RICE\web\server` folder.
2. Click the address bar, type `powershell`, and press Enter.

(Or in VS Code: **Terminal > New Terminal**, then `cd web\server`.)

### Step 4.2: Start it
```
npm run dev
```
You should see:
```
P-RICE API running on http://localhost:4000
Reading model output from: ...\Model Development\P-RICE Results.xlsx
Gemini AI: off (no GEMINI_API_KEY in web/server/.env)
```
"Gemini AI: off" is fine. The AI features are optional (see Section 7).

`npm run dev` restarts the server by itself whenever a server file
changes. `npm start` also works, but then you must restart it yourself
(`Ctrl+C`, then `npm start`) after every change.

### Step 4.3: Check that it works
Open **http://localhost:4000/api/health** in your browser. You should see
`"ok": true`. If it says `false`, run the notebook first (Section 3).

**Leave this terminal open.** Closing it turns the dashboard off.

---

## 5. Run the frontend (website)

### Step 5.1: Open a SECOND terminal in `web/client`
Same as Step 4.1, but in the `P-RICE\web\client` folder. You now have two
terminals open: one for the server, one for the website.

### Step 5.2: Start it
```
npm run dev
```
You should see:
```
VITE ready in 300 ms
➜  Local:   http://localhost:5173/
```

### Step 5.3: Open the dashboard
Open **http://localhost:5173** in your browser.

| Tab | What it shows |
|---|---|
| **Dashboard** | Pick a rice type. Forecast card, price trend chart, Next forecast (beyond the data) and the factors behind it |
| **Compare All** | All rice types side by side |
| **Test Results** | Accuracy by horizon and rice type (MAE, RMSE, MAPE, monthly or weekly), ablation, Diebold-Mariano, SHAP, CSV download |
| **About** | Project description, SDGs, who it helps |

The moon/sun button (top right) switches dark mode.

### Step 5.4: When you're done
Click inside each terminal and press **`Ctrl+C`**, or just close both
terminals.

---

## 6. Quick start (after the first time)

```
Terminal 1                         Terminal 2
cd P-RICE\web\server               cd P-RICE\web\client
npm run dev                        npm run dev
```
Then open **http://localhost:5173**.

Changed the data or settings? Run the notebook again (Run All), then
refresh the browser (F5). You don't need to restart the terminals.

---

## 7. Optional: AI features (Gemini)

With a Gemini key, the dashboard gets two extra features:

- **AI explain** on the Next forecast card: rewrites the forecast and its
  factor effects in plain English or Taglish.
- **P-RICE Assistant** (the "Ask P-RICE" button, bottom right): a chatbot
  that answers questions about the forecasts, past prices, factors, test
  results and how to use the dashboard.

Both only use numbers from the model's own files. The numbers always come
from the model; Gemini only puts them into words.

### Setup
1. In `web\server`, copy `.env.example` and name the copy `.env`:
   ```
   cd web\server
   copy .env.example .env
   ```
2. Open `.env` in VS Code and paste the key after `GEMINI_API_KEY=`.
   Get a key at https://aistudio.google.com/apikey.
3. Check the key:
   ```
   npm run check:gemini
   ```
   It should end with `OK: Gemini explanations will work.`
4. Restart the server (`Ctrl+C`, then `npm run dev`). The terminal now says
   `Gemini AI (explainer + assistant): on`.

**Never commit `.env` or paste the key in a group chat.** `.env` is
already in `.gitignore`. Without a key, the dashboard works the same and
hides both AI features.

### How the assistant is kept safe and on-topic

| Layer | What it does |
|---|---|
| Key on the server only | The browser never sees the key |
| Allowed origins | Only the dashboard itself can call the API from a browser (`ALLOWED_ORIGINS` in `.env` for a deployed site) |
| Rate limit | 8 questions per minute and 60 per hour per user |
| Input checks | Max 500 characters per question, last 12 messages only, 20 KB request limit |
| Jailbreak filter | Requests for the prompt, keys, or to "ignore instructions" are refused without calling Gemini |
| Scope rules | Answers only about P-RICE, rice prices in the data, the factors and the dashboard; no buying or investment advice |
| Grounded answers | The server builds the facts from the model output; the bot must say "no data" instead of guessing |
| Output check | Replies are shown as plain text (no HTML) and blocked if they contain anything that looks like a key |

---

## 8. Optional: get the latest data

The scripts in `Model Development/data_pipeline/` download the factors
automatically (no API keys needed) and rebuild the dataset. See
[`data_pipeline/README_DATA_PIPELINE.md`](Model%20Development/data_pipeline/README_DATA_PIPELINE.md)
for the details. In short:

```
cd "Model Development\data_pipeline"
python update_data.py --start 1990-01-01   # download Brent, weather, rice stocks, production, farmgate
python build_monthly.py                    # build the monthly 1990-2026 dataset (monthly_1990/)
```

---

## 9. Where to find the results (Chapter 4)

| Main notebook section | What it shows |
|---|---|
| 3. Split | Train / validation / test months (80-10-10 by date) |
| 6. ARIMA orders | The (p, d, q) chosen for each rice type |
| 6b. Lags | PACF charts and the lag search table (how many past months the model uses) |
| 8. Results | MAE, RMSE, MAPE for XGBoost, ARIMA, Naive per horizon (lower is better) |
| 8. Horizon decision | Horizons where XGBoost beats both benchmarks, plus the error-by-horizon chart |
| 9. Per rice type | MAE for each rice type |
| 10. Actual vs predicted | One chart per rice type. Black line = actual, markers = forecasts |
| 11. SHAP | Top features, importance by factor, and the dot (beeswarm) chart |

The same tables are saved as sheets in **`P-RICE Results.xlsx`**: Test
Summary, Test by Rice Type, Horizon Decision, All Predictions, SHAP
Features, SHAP Factors, Best Settings, ARIMA Orders.

The **Test Results** tab of the website shows the same numbers as charts,
and each table has a **CSV** button.

**To save a notebook chart as an image:** hover over the chart in VS Code,
click the **`...`** in its corner, then **Save As** (PNG). Or right-click
it, choose **Copy Image**, and paste into Word.

---

## 10. Changing settings

All settings are in **Section 1 (Settings)** of the main notebook:

| Setting | Meaning |
|---|---|
| `FILES` | Which rice CSVs to use |
| `EXOG` | Predictor columns |
| `FREQ` | `"MS"` = monthly. `None` keeps the original weekly data |
| `HORIZONS` | How many months ahead to test (default 1 to 6) |
| `SPLIT` | Train / validation / test ratio (default 80-10-10) |
| `PARAM_GRID` | XGBoost hyperparameter grid (Table 3 in the paper) |

After changing anything, click **Run All** again, then refresh the website.

---

## 11. Troubleshooting

### Notebook

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'xgboost'` (or another library) | Run the `pip install ...` command in Step 2.3, click **Restart** at the top of the notebook, then **Run All** |
| No Python in the kernel list | Check that the Python and Jupyter extensions are installed, then restart VS Code |
| `FileNotFoundError: ... Rice.csv` | Open the notebook from the `Model Development` folder (the CSVs must be next to it) |
| `PermissionError` when saving `P-RICE Results.xlsx` | The Excel file is open. Close it in Excel, then run the last cell again |
| Results are slightly different from before | Normal when the data, lag setting or random search changes |
| `pip` is not recognized | Python is not on PATH. Reinstall Python with "Add python.exe to PATH" ticked, or use `py -m pip install ...` |

### Server and website

| Problem | Fix |
|---|---|
| `'node'` or `'npm'` is not recognized | Install Node.js (Step 2.1), then restart your computer |
| `Cannot find module 'express'` (or another module) | You skipped `npm install`. Run it inside `web\server` (or `web\client`) |
| Server says `WARNING: ...P-RICE Results.xlsx not found yet` | Run the main notebook first (Section 3) |
| Browser: "This site can't be reached" at `localhost:5173` | The website terminal is not running. Do Step 5.2 |
| Website loads but says it couldn't load data, or shows `Request failed: 500` / `404` | The server terminal is not running or is an old copy. Do Step 4.2 again |
| `Port 4000 is already in use` (or `5173`) | An old terminal is still running. Close all terminals and start again |
| Numbers did not change after re-running the notebook | Refresh the browser (F5) |
| AI explain or Ask P-RICE is missing | No Gemini key yet. See Section 7 |
| `Gemini 404 ... no longer available` | The model was retired. The server switches to a newer one by itself; run `npm run check:gemini` to see which ones your key can use |
| `The AI is busy right now` | Google's servers are busy. Wait a minute and try again |

**Still stuck?** Take a screenshot of both terminals and the browser, and
send them with the step you were on.

---

## 12. Getting updates

In the `P-RICE` folder:
```
git pull
```
Then run `npm install` in `web\server` and `web\client` again (in case new
libraries were added), and restart both terminals.

If `git pull` says your local changes would be overwritten:
```
git stash
git pull
```

**Tips**
- Close the notebook and Excel files before pulling.
- Don't edit the shared notebook directly. Make a copy if you want to experiment.
- Never commit `web/server/.env` (your Gemini key).
