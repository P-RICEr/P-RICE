# P-RICE Web Dashboard

The website version of P-RICE: the same forecasts and test results as the
notebook, shown as a dashboard.

| Part | Folder | Built with |
|---|---|---|
| Backend (server / API) | `web/server/` | Node.js, Express, SheetJS (reads the Excel and CSV files) |
| Frontend (website) | `web/client/` | React, Vite, Tailwind CSS, Recharts |

**The dashboard does not train the model.** It reads the files the
notebook makes:

- `Model Development/*.csv`: actual historical prices and factor values
- `Model Development/P-RICE Results.xlsx`: forecasts, accuracy and SHAP (main notebook)
- `Model Development/P-RICE Results (Weekly).xlsx`: weekly results (weekly notebook)
- `Model Development/P-RICE Extra Results.xlsx`: ablation, Diebold-Mariano and the Next forecast (extra notebook)

So the order is always: **run the notebook (Run All) → start the server →
start the website.**

The full setup guide (installing Python, Node.js and Git, and running the
notebook) is in the main [README](../README.md). This page covers only the
website.

---

## Words used in this guide

| Word | Meaning |
|---|---|
| **Terminal** | The window where you type commands. On Windows: PowerShell or Command Prompt |
| **Server / API** | A background program that reads the Excel/CSV files and sends the numbers to the website |
| **Client / website** | The part you see and click in your browser |
| **`cd`** | "Change directory": go into a folder in the terminal |
| **`npm install`** | Downloads the code libraries the project needs. Once per computer |
| **localhost** | "This computer". `http://localhost:5173` only works on the computer running it |

---

## Part 1: One-time setup

### Step 1.1: Install Node.js
1. Go to https://nodejs.org/ and download the **LTS** version.
2. Run the installer and click **Next** through every screen.
3. Check it in a terminal:
   ```
   node -v
   ```
   You should see a version like `v22.x`. If it says "not recognized",
   restart your computer.

### Step 1.2: Install the server's libraries (Terminal 1)
1. In File Explorer, open `P-RICE\web\server`.
2. Click the address bar, type `powershell`, press Enter.
3. Run:
   ```
   npm install
   ```

### Step 1.3: Install the website's libraries (Terminal 2)
1. Open `P-RICE\web\client` the same way, in a **second** terminal.
2. Run:
   ```
   npm install
   ```

Yellow `npm warn` messages are normal.

### Step 1.4 (optional): Turn on the AI features
See the main README, Section 7. Without a Gemini key the dashboard works
the same, just without "AI explain" and "Ask P-RICE".

---

## Part 2: Run the dashboard (every time)

### Step 2.1: Make sure the notebook has been run
`Model Development/P-RICE Results.xlsx` must exist. If it doesn't, run the
main notebook first (main README, Section 3).

### Step 2.2: Start the server (Terminal 1, in `web\server`)
```
npm run dev
```
Expected output:
```
P-RICE API running on http://localhost:4000
Reading model output from: ...P-RICE Results.xlsx
```
Check it: open http://localhost:4000/api/health. It should say `"ok": true`.

**Leave this terminal open.**

### Step 2.3: Start the website (Terminal 2, in `web\client`)
```
npm run dev
```
Expected output:
```
VITE ready in 300 ms
➜  Local:   http://localhost:5173/
```
**Leave this terminal open too.**

### Step 2.4: Open the dashboard
Go to **http://localhost:5173** in your browser.

- **Rice type buttons** (top): switch the rice type shown.
- **Forecast horizon** (dropdown): 1 to 6 months ahead.
- **Forecast card**: the model's forecast for the last test month, whether
  it expects an increase or decrease, and a confidence label. **more
  details** shows MAE vs ARIMA and Naive, and the factors behind it.
- **Trend chart**: actual price (green) vs the model's forecast (blue,
  dashed). Zoom with **3M / 6M / 1Y / 2Y / ALL**; export with **CSV / PNG**.
- **Next forecast**: a true forecast beyond the data, with the factors that
  pushed it up (red) or down (green). **AI explain** writes it in plain
  English or Taglish (needs a Gemini key).
- **Ask P-RICE** (bottom right): the chatbot (needs a Gemini key).
- **Test Results** tab: all accuracy tables and charts for Chapter 4.

### Step 2.5: When you're done
Press **`Ctrl+C`** in each terminal, or close them.

---

## Quick reference

```
Terminal 1                         Terminal 2
cd P-RICE\web\server               cd P-RICE\web\client
npm run dev                        npm run dev
```
Then open **http://localhost:5173**.

After re-running a notebook, just refresh the browser (F5).

---

## For developers

| Command | Folder | What it does |
|---|---|---|
| `npm run dev` | `server` | Start the API on port 4000 and restart on file changes |
| `npm start` | `server` | Start the API without auto-restart |
| `npm run check:gemini` | `server` | Test the Gemini key in `.env` and list the models it can use |
| `npm run dev` | `client` | Start the website on port 5173 (calls to `/api` go to port 4000) |
| `npm run build` | `client` | Build the website for deployment into `client/dist` |

Settings in `web/server/.env` (copy from `.env.example`):

| Setting | Meaning |
|---|---|
| `GEMINI_API_KEY` | Turns on AI explain and the assistant |
| `GEMINI_MODEL` | First Gemini model to try (default `gemini-flash-lite-latest`, the fastest) |
| `ALLOWED_ORIGINS` | Websites allowed to call the API from a browser, comma-separated (for a deployed site) |
| `PORT` | Server port (default 4000) |
| `MODEL_DIR` | Path to `Model Development` if your folders are arranged differently |

Main API endpoints: `/api/health`, `/api/series`, `/api/forecast`,
`/api/compare`, `/api/model-info`, `/api/results?freq=monthly|weekly`,
`/api/future`, `/api/explain` (POST), `/api/chat` (POST, streamed).

---

## Troubleshooting

| What you see | What to do |
|---|---|
| `'node'` or `'npm'` is not recognized | Install Node.js (Step 1.1) and restart your computer |
| `Cannot find module ...` | Run `npm install` in that folder (`web\server` or `web\client`) |
| `WARNING: ...P-RICE Results.xlsx not found yet` | Run the main notebook, then restart the server |
| "This site can't be reached" at `localhost:5173` | Terminal 2 isn't running. Do Step 2.3 |
| Dashboard loads but shows an error, `Request failed: 500` or `404` | Terminal 1 isn't running, or is an old copy. Restart it (`Ctrl+C`, `npm run dev`) |
| `Port 4000 is already in use` (or `5173`) | An old terminal is still running. Close all terminals and start again |
| Numbers didn't change after re-running the notebook | Refresh the browser (F5) |
| Old icon in the browser tab | Press `Ctrl+Shift+R` |

**Still stuck?** Screenshot both terminals and the browser, and send them
with the step you were on.
