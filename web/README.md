# P-RICE Web Dashboard

This is the website version of P-RICE — the same forecasts from the
notebook, shown as a dashboard instead of a notebook with charts. This
guide assumes you've never run a website like this before, so it spells
out every click. Follow it top to bottom.

**This is UI only.** It does not retrain the model. It reads numbers
straight from the files the notebook already makes:
- `Model Development/*.csv` → the actual historical prices (the solid
  green line in the chart)
- `Model Development/P-RICE Results.xlsx` → the forecasts, accuracy
  numbers, and SHAP values (the forecast card and the dashed red line)

So the order is always: **run the notebook first (Run All) → then start
the website below → the website shows whatever the notebook last
produced.** If you run the website without running the notebook first,
it will show an error, because there's nothing to read yet.

---

## Before you start: words used in this guide

| Word | What it means |
|---|---|
| **Terminal** | A dark window where you type commands. On Windows, search "Command Prompt" or "PowerShell" in the Start menu. |
| **Server / API** | A small background program that reads the Excel/CSV files and hands the numbers to the website. It has no visible window of its own besides the terminal running it. |
| **Client / Website** | The part you actually see and click on, in your browser. |
| **`cd`** | Short for "change directory" — it means "go into this folder" inside the terminal. |
| **`npm install`** | Downloads all the small code libraries the project needs. You only do this once per computer (per folder), similar to installing an app. |
| **Localhost** | Means "this same computer." `http://localhost:5173` is a website running only on your own machine — no one else can open that link, only you, from that computer. |

---

## Part 1: One-time setup

### Step 1.1 — Install Node.js
Node.js is what runs the server and builds the website.
1. Go to **https://nodejs.org/**.
2. Click the button that says **LTS** (this means "Long Term Support" —
   the stable version). Do not pick the "Current" version.
3. Open the downloaded installer.
4. Click **Next** through every screen, keeping all the default options
   checked, then **Install**, then **Finish**.

**Check it worked:** open a terminal (see Step 1.2) and type:
```
node -v
```
then press Enter. You should see something like `v22.13.0`. If you get
`'node' is not recognized`, restart your computer and try again — Node
sometimes needs a restart to be added to your system's PATH.

### Step 1.2 — Get to the `web` folder in a terminal
1. Open File Explorer and go to the `P-RICE` folder, then into the `web`
   folder inside it (`P-RICE\web`).
2. Click once on the address bar at the top (where the folder path is
   shown), type `cmd`, and press Enter. A terminal opens already inside
   that `web` folder.

You'll do this twice, in **two separate terminal windows** — one for the
server, one for the website. Keep both open at the same time while using
the dashboard.

### Step 1.3 — Install the server's libraries (Terminal #1)
1. In your first terminal (opened per Step 1.2, inside the `web` folder),
   type:
   ```
   cd server
   ```
   and press Enter.
2. Then type:
   ```
   npm install
   ```
   and press Enter. Wait — you'll see a progress bar and some text. This
   can take 1–2 minutes the first time. When it stops and you get a plain
   new line, it's done. (You'll also see "npm warn" messages in yellow —
   those are normal and not errors.)

### Step 1.4 — Install the website's libraries (Terminal #2)
1. Open a **second** terminal window the same way as Step 1.2, again
   inside the `web` folder (not inside `server`).
2. Type:
   ```
   cd client
   ```
   and press Enter.
3. Then type:
   ```
   npm install
   ```
   and press Enter. Wait for it to finish the same way as Step 1.3.

**You only need Part 1 once per computer.** Everything below (Part 2) is
what you repeat every time you want to view the dashboard.

---

## Part 2: Running the dashboard (do this every time)

You need **both terminals running at the same time** — one keeps the data
server alive, the other keeps the website alive. Neither works alone.

### Step 2.1 — Make sure the model has been run at least once
Open `Model Development/P-RICE Results.xlsx` — if that file exists and
has numbers in it, you're good. If it doesn't exist yet, go run the
notebook first (see the main `README.md` in the `P-RICE` folder, Part 2),
then come back here.

### Step 2.2 — Start the server (Terminal #1)
1. In your first terminal, make sure you're inside the `web/server`
   folder (if you closed the terminal, redo `cd` into `web`, then
   `cd server`).
2. Type:
   ```
   npm run dev
   ```
   and press Enter.
3. You should see a message like:
   ```
   P-RICE API running on http://localhost:4000
   Reading model output from: ...P-RICE Results.xlsx
   ```
4. **Leave this terminal open and running.** Don't close it or press
   Ctrl+C in it while you're using the dashboard — closing it turns the
   dashboard off.

**If instead you see:**
```
WARNING: ...P-RICE Results.xlsx not found yet. Run the notebook (Run All) first.
```
this means the notebook hasn't been run yet, or was run somewhere else.
Go back to Step 2.1.

### Step 2.3 — Start the website (Terminal #2)
1. In your second terminal, make sure you're inside `web/client`.
2. Type:
   ```
   npm run dev
   ```
   and press Enter.
3. You should see something like:
   ```
   VITE ready in 300 ms
   ➜  Local:   http://localhost:5173/
   ```
4. **Leave this terminal open too.**

### Step 2.4 — Open the dashboard
1. Open your browser (Chrome, Edge, whichever you normally use).
2. In the address bar, type exactly:
   ```
   http://localhost:5173
   ```
3. Press Enter. The dashboard should load, showing the 8 rice types at
   the top and a forecast card below.

### Step 2.5 — Using the dashboard
- **Click a rice type** at the top (e.g. "Local Special") to switch which
  one is shown.
- **The dropdown at the top-right** ("Forecast horizon") changes how many
  months ahead the forecast card and chart are showing (1 to 6 months).
- **The green card** shows the model's forecast price, whether it expects
  an increase or decrease, and a confidence label.
- **"more details" / "More details"** opens a panel showing the model's
  accuracy (MAE) compared to ARIMA and a naive guess, plus which factors
  (oil price, farmgate price, etc.) mattered most for that forecast.
- **The chart below** shows the actual price (solid green line) against
  the model's forecast (dashed red line). Use the **3M / 6M / 1Y / 2Y /
  ALL** buttons top-right of the chart to zoom in or out.

**Important:** the forecast shown is the model's most recent *backtested*
forecast — meaning it's for a month that's already inside the historical
data used to test the model, not a real, still-unknown future month. This
is explained inside the "more details" panel too. This is the same
evaluation Chapter 4 is built on — it shows how well the model performed
on data it hadn't been trained on, not a live crystal-ball prediction.

### Step 2.6 — When you're done
In each terminal, click inside it and press **Ctrl+C** to stop it. It's
fine to just close both terminal windows too.

**Next time you want to open the dashboard again:** you don't need to
repeat Part 1 (installing libraries) — just repeat Part 2 (open two
terminals, `npm run dev` in each, then open the browser link).

---

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| `'node' is not recognized as an internal or external command` | Node.js isn't installed, or your computer needs a restart after installing it | Redo Step 1.1, then restart your computer |
| `npm error could not determine executable to run` or similar right after `npm install` | You're in the wrong folder | Check you typed `cd server` (Terminal #1) or `cd client` (Terminal #2) before running the command |
| Server terminal shows `WARNING: ...P-RICE Results.xlsx not found yet` | The notebook hasn't been run, or was run in a different copy of the folder | Run the notebook (main README, Part 2), confirm `P-RICE Results.xlsx` exists inside `Model Development`, then restart the server (Ctrl+C, then `npm run dev` again) |
| Browser says "This site can't be reached" at `localhost:5173` | The website terminal (Terminal #2) isn't running, or hasn't finished starting yet | Check Terminal #2 shows the "VITE ready" message; if you closed it, redo Step 2.3 |
| The dashboard loads but shows "Couldn't load model data" | The server (Terminal #1) isn't running, or crashed | Check Terminal #1 is still open and didn't show a red error; if it closed, redo Step 2.2 |
| Terminal says `Port 4000 is already in use` (or `5173`) | You already have a server or website running from before (maybe in another terminal you forgot about) | Close all terminal windows, reopen fresh ones, and try again. Or just refresh your browser — it might already be running from the older terminal |
| The numbers on the dashboard look "stuck" / didn't change after re-running the notebook | The dashboard only reads the file when you refresh the page | Just refresh the browser page (F5) — no need to restart the terminals |
| A wall of red/pink text appears in a terminal | Something crashed | Copy the **first few lines** of the red text (that's usually where the actual problem is described) and send it to Yuri |

**If you're stuck and none of the above matches:** don't keep retrying
random things. Take a screenshot of **both terminal windows** and the
browser, and send them to Yuri along with what step you were on.

---

## Quick reference (once everything is installed)

Every time you want to open the dashboard:

```
Terminal 1:                      Terminal 2:
cd P-RICE\web\server              cd P-RICE\web\client
npm run dev                       npm run dev
```
Then open **http://localhost:5173** in your browser.

---

## Not built yet (for later, not needed for the current deadline)

- A true "next month" forecast beyond the historical dataset — this needs
  the trained model itself saved to a file (the notebook currently only
  saves its *results*, not the model). This is a small addition Yuri can
  make once it's needed.
- Connecting this directly to the OpenSTAT API, instead of reading from
  the CSV files, once the automated data pipeline is ready.
- Putting this online (so it has a real shareable link) instead of only
  running on one computer at a time.
