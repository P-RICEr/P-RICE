# P-RICE
An XGBoost Regression Based Model for Philippine Rice Prices

P-RICE forecasts the monthly retail price (PHP/kg) of 8 rice types, 1 to 6 months ahead, using XGBoost. It compares XGBoost against two benchmarks (ARIMA and a Naive "same as last month" forecast) and explains the model with SHAP.

---

## What's in this repository

| File (inside `Model Development/`) | What it is |
|---|---|
| `P-RICE Model - All Rice Types (Monthly).ipynb` | **Main model.** All 8 rice types, monthly, 1–6 months ahead, XGBoost vs ARIMA vs Naive, SHAP. Use this one. |
| `Local Special Rice - Model Development (with charts).ipynb` | Original weekly notebook (Local Special only), with correct overall scores, naive comparison and charts added. |
| `Local/Imported ... Rice.csv` (8 files) | Weekly rice prices (DA Price Monitoring) with the 5 predictors: Brent oil, farmgate, inflation, rice stocks, rainfall. |
| `P-RICE Results.xlsx` | Results created by the main notebook (tables for Chapter 4). Re-created every time you run it. |

---

## How to run it (first time)

### Step 1: Install the tools (one time only)
1. **Python 3.11 or newer**: download from https://www.python.org/downloads/
   During installation, **tick "Add python.exe to PATH"**.
2. **VS Code**: https://code.visualstudio.com/
3. In VS Code, open the **Extensions** tab (`Ctrl+Shift+X`) and install:
   - **Python** (by Microsoft)
   - **Jupyter** (by Microsoft)

### Step 2: Get the project
**Option A: With Git** (recommended, so you can get updates later)
```bash
git clone https://github.com/P-RICEr/P-RICE.git
```

**Option B: Without Git**
On the GitHub page, click the green **Code** button, then **Download ZIP**, and extract it.

### Step 3: Install the Python libraries
Open a terminal (in VS Code: **Terminal > New Terminal**) and run:
```bash
pip install xgboost scikit-learn pandas numpy matplotlib statsmodels openpyxl ipykernel
```
(The notebook's first cell also installs these automatically, so if you skip this step it still works.)

### Step 4: Open and run the notebook
1. In VS Code: **File > Open Folder**, then pick the **`P-RICE`** folder.
2. Open **`Model Development/P-RICE Model - All Rice Types (Monthly).ipynb`**.
3. Click **Select Kernel** (top right), choose **Python Environments**, then pick the Python you installed.
4. Click **Run All** (top of the notebook).
5. Wait **about 2–5 minutes**. Section 7 is the slow part (tuning + walk-forward for 6 horizons).

When it finishes you'll have:
- Result tables and charts inside the notebook (Sections 8–11)
- **`P-RICE Results.xlsx`** in the `Model Development` folder

---

## Where to find the results (for Chapter 4)

| Notebook section | What it shows |
|---|---|
| 3. Split | Train / Validation / Test months (80-10-10 by date) |
| 6. ARIMA orders | The (p, d, q) chosen for each rice type |
| 6b. Lags | PACF charts + lag search table (how many past months the model uses) |
| 8. Results | MAE, RMSE, MAPE for XGBoost, ARIMA, Naive per horizon (lower = better) |
| 8. Horizon decision | Which horizons XGBoost beats both benchmarks, plus the error-by-horizon chart |
| 9. Per rice type | MAE for each of the 8 rice types |
| 10. Actual vs predicted | 8 charts. Black line = actual, markers = forecasts, orange area = test period |
| 11. SHAP | Top features, importance by factor, and the dot (beeswarm) chart |

The same tables are saved as sheets in **`P-RICE Results.xlsx`** (Test Summary, Test by Rice Type, Horizon Decision, All Predictions, SHAP Features, SHAP Factors, Best Settings, ARIMA orders).

**To save a chart as an image:** hover over the chart in VS Code, click the **`...`** in its corner, then **Save As** (PNG). Or right-click the chart and choose **Copy Image**, then paste into Word.

---

## Changing settings

All settings are in **Section 1 (Settings)** of the main notebook:

| Setting | Meaning |
|---|---|
| `FILES` | Which rice CSVs to use |
| `EXOG` | Predictor columns |
| `FREQ` | `"MS"` = monthly. Set to `None` to keep the original weekly data |
| `HORIZONS` | How many months ahead to test (default 1–6) |
| `SPLIT` | Train / validation / test ratio (default 80-10-10) |
| `PARAM_GRID` | XGBoost hyperparameter grid (same as Table 3 in the paper) |

After changing anything, click **Run All** again.

**New data (e.g. OpenSTAT monthly data):** only **Section 2 (Load data)** needs to change. It must produce a table with the columns `Date, Price, Origin, Variety, Series` plus the predictor columns listed in `EXOG`. Everything after that runs automatically.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'xgboost'` (or another library) | Run the `pip install ...` command in Step 3, then **restart the kernel** (Restart button at the top) and Run All again. |
| VS Code can't find a kernel / no Python in the list | Make sure the Python and Jupyter extensions are installed, then restart VS Code. |
| `FileNotFoundError: ... Rice.csv` | Open the notebook from inside the `Model Development` folder (the CSVs must be in the same folder as the notebook). |
| `PermissionError` when saving `P-RICE Results.xlsx` | The Excel file is open. Close it in Excel, then re-run the last cell. |
| Results are slightly different from before | Normal when the data, lag setting or random search changes. The test set is small (few months), so numbers can move a little. |
| `pip` is not recognized | Python wasn't added to PATH. Reinstall Python and tick "Add python.exe to PATH", or use `py -m pip install ...` |

---

## Getting updates

If you used Git (Option A), open a terminal in the `P-RICE` folder and run:
```bash
git pull
```
If you downloaded the ZIP, download it again.

> Tip: before pulling, close the notebook, and don't edit the shared notebook directly. Make a copy (right-click > Copy, then Paste) if you want to experiment.
