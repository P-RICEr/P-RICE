// P-RICE dashboard API
//
// Reads directly from the same files the notebook uses/produces:
//   - Model Development/*.csv          -> actual historical prices (for the trend line)
//   - Model Development/P-RICE Results.xlsx -> XGBoost/ARIMA/Naive forecasts, MAPE, SHAP
//
// There is no separate "export" step: re-run the notebook (Run All), then
// refresh the website, and the numbers below update automatically.

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { loadEnv, geminiConfig, callGemini, streamGemini, buildExplainPrompt } from "./gemini.mjs";
import {
  rateLimit,
  cleanMessages,
  quickGuard,
  guessLang,
  buildFacts,
  cleanReply,
  isUnsafe,
  BLOCKED_REPLY,
  CHAT_RULES,
} from "./chat.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Model Development lives two folders up from web/server (P-RICE/Model Development).
// Override with MODEL_DIR="C:\path\to\Model Development" if your layout differs.
const MODEL_DIR =
  process.env.MODEL_DIR || path.resolve(__dirname, "..", "..", "Model Development");
const RESULTS_XLSX = path.join(MODEL_DIR, "P-RICE Results.xlsx");

// Same (Origin, Variety) -> file mapping as Section 1 of the main notebook.
const RICE_FILES = {
  "Local Special": "Local Special Rice.csv",
  "Local Premium": "Local Premium Rice.csv",
  "Local Well-milled": "Local Well-milled Rice.csv",
  "Local Regular-milled": "Local Regular-Milled Rice.csv",
  "Imported Special": "Imported Special Rice.csv",
  "Imported Premium": "Imported Premium Rice.csv",
  "Imported Well-milled": "Imported Well-milled Rice.csv",
  "Imported Regular-milled": "Imported Regular-milled Rice.csv",
};

function seriesMeta(series) {
  const [origin, ...rest] = series.split(" ");
  return { key: series, origin, variety: rest.join(" ") };
}

// ---------- CSV (actual monthly price history) ----------

function parseCsvNumberRows(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",");
  const priceCol = header.findIndex(
    (h) => h.includes("_PHP_kg_") && !h.includes("_lag")
  );
  const dateCol = header.indexOf("Date");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length < header.length) continue;
    const [m, d, y] = cells[dateCol].split("/").map(Number);
    rows.push({ date: new Date(Date.UTC(y, m - 1, d)), price: Number(cells[priceCol]) });
  }
  return rows;
}

// Weekly -> monthly average, matching data.resample("MS").mean() in the notebook.
function toMonthlyAverage(rows) {
  const buckets = new Map(); // "YYYY-MM" -> {sum, count, y, m}
  for (const r of rows) {
    const y = r.date.getUTCFullYear();
    const m = r.date.getUTCMonth();
    const key = `${y}-${m}`;
    const b = buckets.get(key) || { sum: 0, count: 0, y, m };
    b.sum += r.price;
    b.count += 1;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .sort((a, b) => a.y - b.y || a.m - b.m)
    .map((b) => ({
      date: new Date(Date.UTC(b.y, b.m, 1)).toISOString().slice(0, 10),
      actual: Math.round((b.sum / b.count) * 100) / 100,
    }));
}

const monthlyCache = new Map();
function getMonthlyActual(series) {
  if (monthlyCache.has(series)) return monthlyCache.get(series);
  const file = RICE_FILES[series];
  if (!file) throw new Error(`Unknown series: ${series}`);
  const rows = parseCsvNumberRows(path.join(MODEL_DIR, file));
  const monthly = toMonthlyAverage(rows);
  monthlyCache.set(series, monthly);
  return monthly;
}

// ---------- Excel (forecasts + model evaluation) ----------

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function excelDateToISO(v) {
  // SheetJS builds Date objects at local midnight. Read the local calendar
  // date instead of toISOString(), which converts to UTC and, in UTC+8
  // (Philippines), rolls every date back one day (June 1 -> May 31).
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
      .toISOString()
      .slice(0, 10);
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

// Excel dates and the CSV-derived monthly-average dates don't always land on
// the same day of the month, so match forecasts to actuals by month, not by
// exact day.
function monthKey(iso) {
  return iso.slice(0, 7); // "YYYY-MM"
}

let resultsCache = null;
let resultsCacheAt = 0;

function loadResults() {
  const stat = fs.statSync(RESULTS_XLSX);
  if (resultsCache && stat.mtimeMs === resultsCacheAt) return resultsCache;
  const wb = XLSX.readFile(RESULTS_XLSX, { cellDates: true });

  const predictions = readSheet(wb, "All Predictions").map((r) => ({
    horizon: r.Horizon,
    series: r.Series,
    originDate: excelDateToISO(r.Origin_Date),
    targetDate: excelDateToISO(r.Target_Date),
    set: r.Set,
    actual: r.Actual,
    xgboost: r.XGBoost,
    arima: r.ARIMA,
    naive: r.Naive, // Naive = Base_Price (price known at Origin_Date)
  }));

  const testByType = readSheet(wb, "Test by Rice Type").map((r) => ({
    horizon: r.Horizon,
    series: r.Series,
    model: r.Model,
    mae: r.MAE,
    rmse: r.RMSE,
    mape: r["MAPE (%)"],
  }));

  const horizonDecision = readSheet(wb, "Horizon Decision").map((r) => ({
    horizon: r.Horizon,
    xgboost: r.XGBoost,
    arima: r.ARIMA,
    naive: r.Naive,
    beatsArima: r["Beats ARIMA"],
    beatsNaive: r["Beats Naive"],
    improvementVsArima: r["Improvement vs ARIMA (%)"],
    improvementVsNaive: r["Improvement vs Naive (%)"],
  }));

  const shapFactors = readSheet(wb, "SHAP Factors")
    .map((r) => ({ factor: r[""] ?? r[Object.keys(r)[0]], meanAbsShap: r["Mean |SHAP|"] }))
    .filter((r) => r.factor);

  resultsCache = { predictions, testByType, horizonDecision, shapFactors };
  resultsCacheAt = stat.mtimeMs;
  return resultsCache;
}

// ---------- Exogenous factor snapshot (for the SHAP factors panel) ----------
//
// Brent oil, farmgate price, inflation, rice stocks, exchange rate,
// temperature, rainfall and volume of production are nationwide indicators baked into every rice-type CSV as identical columns
// (see Section 1 of the notebook), so we read them once from a fixed
// reference file rather than per selected series.
const FACTOR_REFERENCE_FILE = "Local Special Rice.csv";

const EXOGENOUS_COLUMNS = {
  Brent_Oil_USD: { label: "Brent Crude Oil", unit: "$/bbl", decimals: 2 },
  Farmgate_LCU_tonne: { label: "Farmgate Price", unit: "₱/tonne", decimals: 0 },
  Inflation_Rate: { label: "Inflation Rate", unit: "%", decimals: 1 },
  Stocks_MT: { label: "Rice Stocks", unit: "MT", decimals: 0 },
  USD_to_PHP: { label: "Exchange Rate", unit: "₱ per $", decimals: 2 },
  Temp_C: { label: "Temperature", unit: "°C", decimals: 1 },
  Rainfall_mm: { label: "Rainfall", unit: "mm", decimals: 1 },
  VoP_MT: { label: "Volume of Production", unit: "MT", decimals: 0 },
};

function parseCsvFactorRows(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",");
  const dateCol = header.indexOf("Date");
  const factorCols = Object.keys(EXOGENOUS_COLUMNS)
    .map((name) => ({ name, idx: header.indexOf(name) }))
    .filter((c) => c.idx !== -1);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length < header.length) continue;
    const [m, d, y] = cells[dateCol].split("/").map(Number);
    const row = { date: new Date(Date.UTC(y, m - 1, d)) };
    for (const c of factorCols) row[c.name] = Number(cells[c.idx]);
    rows.push(row);
  }
  return rows;
}

function toMonthlyFactorAverage(rows) {
  const names = Object.keys(EXOGENOUS_COLUMNS);
  const buckets = new Map();
  for (const r of rows) {
    const y = r.date.getUTCFullYear();
    const m = r.date.getUTCMonth();
    const key = `${y}-${m}`;
    let b = buckets.get(key);
    if (!b) {
      b = { y, m, count: 0 };
      for (const name of names) b[name] = 0;
      buckets.set(key, b);
    }
    b.count += 1;
    for (const name of names) {
      if (Number.isFinite(r[name])) b[name] += r[name];
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.y - b.y || a.m - b.m)
    .map((b) => {
      const out = { date: new Date(Date.UTC(b.y, b.m, 1)).toISOString().slice(0, 10) };
      for (const name of names) out[name] = Math.round((b[name] / b.count) * 100) / 100;
      return out;
    });
}

let factorCache = null;
function getMonthlyFactors() {
  if (factorCache) return factorCache;
  const rows = parseCsvFactorRows(path.join(MODEL_DIR, FACTOR_REFERENCE_FILE));
  factorCache = toMonthlyFactorAverage(rows);
  return factorCache;
}

// Most recent reading + trend vs. the prior month, per exogenous factor,
// keyed by the same column names used in the "SHAP Factors" sheet.
function latestFactorSnapshot() {
  const monthly = getMonthlyFactors();
  if (!monthly.length) return {};
  const latest = monthly.at(-1);
  const prev = monthly.length > 1 ? monthly.at(-2) : null;
  const snapshot = {};
  for (const [name, meta] of Object.entries(EXOGENOUS_COLUMNS)) {
    const current = latest[name];
    const previous = prev ? prev[name] : null;
    let trend = "flat";
    if (previous != null && current != null) {
      const diff = current - previous;
      if (Math.abs(diff) > 0.005 * Math.max(Math.abs(previous), 1)) {
        trend = diff > 0 ? "up" : "down";
      }
    }
    snapshot[name] = {
      label: meta.label,
      unit: meta.unit,
      decimals: meta.decimals,
      currentValue: current,
      previousValue: previous,
      trend,
      asOf: latest.date,
    };
  }
  return snapshot;
}

function confidenceFromMape(mape) {
  if (mape == null) return { label: "Unknown", mape: null };
  if (mape < 3) return { label: "High", mape };
  if (mape < 6) return { label: "Moderate", mape };
  return { label: "Low", mape };
}

// ---------- API ----------

const app = express();
app.disable("x-powered-by");

// Only the dashboard itself may call this API from a browser.
// Add your deployed site to ALLOWED_ORIGINS in .env (comma-separated).
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  })
);
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});
app.use(express.json({ limit: "20kb" }));

function resultsLastUpdated() {
  if (!fs.existsSync(RESULTS_XLSX)) return null;
  return fs.statSync(RESULTS_XLSX).mtime.toISOString();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: fs.existsSync(RESULTS_XLSX),
    modelDir: MODEL_DIR,
    resultsFile: RESULTS_XLSX,
    resultsUpdatedAt: resultsLastUpdated(),
  });
});

app.get("/api/meta", (req, res) => {
  res.json({
    resultsUpdatedAt: resultsLastUpdated(),
    seriesCount: Object.keys(RICE_FILES).length,
  });
});

app.get("/api/series", (req, res) => {
  res.json(Object.keys(RICE_FILES).map(seriesMeta));
});

// Shared logic for one rice type + horizon -> {confidence, card, history}.
// Used by both /api/forecast (single series) and /api/compare (all series).
function buildForecast(series, horizon) {
  const { predictions, testByType } = loadResults();
  const monthly = getMonthlyActual(series);

  const predRows = predictions
    .filter((p) => p.series === series && p.horizon === horizon)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  const forecastByMonth = new Map(predRows.map((p) => [monthKey(p.targetDate), p.xgboost]));
  const history = monthly.map((m) => {
    const key = monthKey(m.date);
    return {
      date: m.date,
      actual: m.actual,
      forecast: forecastByMonth.has(key)
        ? Math.round(forecastByMonth.get(key) * 100) / 100
        : null,
    };
  });

  // Prefer the most recent Test-set row; fall back to the most recent Validation row.
  const testRows = predRows.filter((p) => p.set === "Test");
  const latest = (testRows.length ? testRows : predRows).at(-1) || null;

  const mapeRow = testByType.find(
    (t) => t.series === series && t.horizon === horizon && t.model === "XGBoost"
  );
  const confidence = confidenceFromMape(mapeRow?.mape);

  let card = null;
  if (latest) {
    const current = latest.naive; // price known at Origin_Date
    const forecast = latest.xgboost; // predicted price at Target_Date
    const changePct = ((forecast - current) / current) * 100;
    card = {
      currentDate: latest.originDate,
      currentPrice: Math.round(current * 100) / 100,
      forecastDate: latest.targetDate,
      forecastPrice: Math.round(forecast * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      direction: changePct > 0.05 ? "increase" : changePct < -0.05 ? "decrease" : "flat",
      isBacktest: true, // Target_Date falls inside the historical dataset (validation/test), not beyond it
    };
  }

  return { confidence, card, history };
}

app.get("/api/forecast", (req, res) => {
  try {
    const series = req.query.series || "Local Special";
    const horizon = Number(req.query.horizon || 1);
    if (!RICE_FILES[series]) {
      return res.status(400).json({ error: `Unknown series "${series}"` });
    }

    const { confidence, card, history } = buildForecast(series, horizon);

    res.json({
      series,
      horizon,
      unit: "PHP/kg",
      confidence,
      card,
      history,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// All 8 rice types at once, for the "Compare all" table -- one request
// instead of 8 separate /api/forecast calls.
app.get("/api/compare", (req, res) => {
  try {
    const horizon = Number(req.query.horizon || 1);
    const rows = Object.keys(RICE_FILES).map((series) => {
      const meta = seriesMeta(series);
      const { confidence, card } = buildForecast(series, horizon);
      return { ...meta, confidence, card };
    });
    res.json({ horizon, unit: "PHP/kg", rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/model-info", (req, res) => {
  try {
    const horizon = Number(req.query.horizon || 1);
    const { horizonDecision, shapFactors } = loadResults();
    const decision = horizonDecision.find((h) => h.horizon === horizon) || null;
    const snapshot = latestFactorSnapshot();
    const topFactors = shapFactors.map((f) => ({
      ...f,
      ...(snapshot[f.factor] || {}),
    }));
    res.json({
      horizon,
      decision,
      allHorizons: horizonDecision,
      topFactors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Full test results (Results tab) ----------
//
// Everything the notebook saves to Excel, for either the monthly or the
// weekly run, so the website can show every evaluation table and chart.
const RESULTS_FILES = {
  monthly: { file: "P-RICE Results.xlsx", unit: "month" },
  weekly: { file: "P-RICE Results (Weekly).xlsx", unit: "week" },
};

const fullResultsCache = new Map(); // freq -> { mtimeMs, data }

function firstColumn(row) {
  return row[""] ?? row["Unnamed: 0"] ?? row[Object.keys(row)[0]];
}

function loadFullResults(freq) {
  const spec = RESULTS_FILES[freq];
  if (!spec) throw new Error(`Unknown frequency "${freq}"`);
  const file = path.join(MODEL_DIR, spec.file);
  if (!fs.existsSync(file)) {
    const err = new Error(
      `${spec.file} not found. Run the ${freq} notebook (Run All) to create it.`
    );
    err.status = 404;
    throw err;
  }
  const mtimeMs = fs.statSync(file).mtimeMs;
  const cached = fullResultsCache.get(freq);
  if (cached && cached.mtimeMs === mtimeMs) return cached.data;

  const wb = XLSX.readFile(file, { cellDates: true });
  const metrics = (r) => ({ mae: r.MAE, rmse: r.RMSE, mape: r["MAPE (%)"] });

  const data = {
    freq,
    unit: spec.unit,
    file: spec.file,
    updatedAt: fs.statSync(file).mtime.toISOString(),
    testSummary: readSheet(wb, "Test Summary").map((r) => ({
      horizon: r.Horizon,
      model: r.Model,
      ...metrics(r),
    })),
    valTestSummary: readSheet(wb, "Val+Test Summary").map((r) => ({
      horizon: r.Horizon,
      set: r.Set,
      model: r.Model,
      ...metrics(r),
    })),
    byRiceType: readSheet(wb, "Test by Rice Type").map((r) => ({
      horizon: r.Horizon,
      series: r.Series,
      model: r.Model,
      ...metrics(r),
    })),
    horizonDecision: readSheet(wb, "Horizon Decision").map((r) => ({
      horizon: r.Horizon,
      xgboost: r.XGBoost,
      arima: r.ARIMA,
      naive: r.Naive,
      beatsArima: r["Beats ARIMA"],
      beatsNaive: r["Beats Naive"],
      improvementVsArima: r["Improvement vs ARIMA (%)"],
      improvementVsNaive: r["Improvement vs Naive (%)"],
    })),
    shapFactors: readSheet(wb, "SHAP Factors")
      .map((r) => ({ factor: firstColumn(r), meanAbsShap: r["Mean |SHAP|"] }))
      .filter((r) => r.factor),
    bestSettings: readSheet(wb, "Best Settings").map((r) => {
      const { [Object.keys(r)[0]]: horizon, ...params } = r;
      return { horizon, ...params };
    }),
    arimaOrders: readSheet(wb, "ARIMA Orders").map((r) => ({
      series: firstColumn(r),
      order: r["ARIMA order"],
    })),
  };

  // Label SHAP factors the same way the dashboard does.
  for (const f of data.shapFactors) {
    f.label = EXOGENOUS_COLUMNS[f.factor]?.label || f.factor;
  }

  fullResultsCache.set(freq, { mtimeMs, data });
  return data;
}

// ---------- Extra analysis (ablation, Diebold-Mariano, future forecast) ----------
//
// Written by "P-RICE Extra Analysis (Monthly).ipynb". Optional: if the file
// is missing, these parts of the website simply stay hidden.
const EXTRA_XLSX = path.join(MODEL_DIR, "P-RICE Extra Results.xlsx");
let extraCache = null;

function loadExtraResults() {
  if (!fs.existsSync(EXTRA_XLSX)) return null;
  const mtimeMs = fs.statSync(EXTRA_XLSX).mtimeMs;
  if (extraCache && extraCache.mtimeMs === mtimeMs) return extraCache.data;

  const wb = XLSX.readFile(EXTRA_XLSX, { cellDates: true });
  const data = {
    ablation: readSheet(wb, "Ablation").map((r) => ({
      horizon: r.Horizon,
      priceOnlyMae: r["Price-only MAE"],
      fullMae: r["Full model MAE"],
      priceOnlyMape: r["Price-only MAPE (%)"],
      fullMape: r["Full model MAPE (%)"],
      factorsHelp: r["Factors help"],
      reduction: r["MAE reduction from factors (%)"],
    })),
    dieboldMariano: readSheet(wb, "Diebold-Mariano").map((r) => ({
      horizon: r.Horizon,
      versus: r["XGBoost vs"],
      months: r["Months tested"],
      stat: r["DM statistic"],
      pValue: r["p-value (one-sided)"],
      sig5: r["Significant at 5%"],
      sig10: r["Significant at 10%"],
    })),
    future: readSheet(wb, "Future Forecast").map((r) => ({
      horizon: r.Horizon,
      series: r.Series,
      originDate: excelDateToISO(r.Origin_Date),
      targetDate: excelDateToISO(r.Target_Date),
      basePrice: r.Base_Price,
      forecast: r.Forecast,
      changePct: r["Change (%)"],
      testMape: r["Test MAPE (%)"],
    })),
    futureShap: readSheet(wb, "Future SHAP").map((r) => ({
      horizon: r.Horizon,
      series: r.Series,
      factor: r.Factor,
      value: r["SHAP (PHP/kg)"],
    })),
    updatedAt: fs.statSync(EXTRA_XLSX).mtime.toISOString(),
  };
  extraCache = { mtimeMs, data };
  return data;
}

// Plain-language reason list for one future forecast, built only from the
// model's own SHAP values and the latest factor readings (no AI text).
function explainFuture(series, horizon, extra) {
  const snapshot = latestFactorSnapshot();
  const rows = extra.futureShap
    .filter((r) => r.series === series && r.horizon === horizon && Math.abs(r.value) >= 0.01)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return rows.slice(0, 4).map((r) => {
    const meta = EXOGENOUS_COLUMNS[r.factor];
    const snap = snapshot[r.factor];
    return {
      factor: r.factor,
      label: meta?.label || r.factor,
      effect: Math.round(r.value * 100) / 100, // PHP/kg pushed up (+) or down (-)
      currentValue: snap?.currentValue ?? null,
      unit: snap?.unit ?? null,
      decimals: snap?.decimals ?? null,
      trend: snap?.trend ?? null,
    };
  });
}

function futureRows(series) {
  const extra = loadExtraResults();
  if (!extra) return null;
  const horizons = [...new Set(extra.future.map((r) => r.horizon))].sort((a, b) => a - b);
  // Only offer horizons where XGBoost beat both benchmarks on the test set.
  const { horizonDecision } = loadResults();
  const trusted = horizonDecision.filter((h) => h.beatsArima && h.beatsNaive).map((h) => h.horizon);
  const rows = extra.future
    .filter((r) => r.series === series && trusted.includes(r.horizon))
    .sort((a, b) => a.horizon - b.horizon)
    .map((r) => ({
      ...r,
      forecast: Math.round(r.forecast * 100) / 100,
      basePrice: Math.round(r.basePrice * 100) / 100,
      changePct: Math.round(r.changePct * 100) / 100,
      confidence: confidenceFromMape(r.testMape),
      reasons: explainFuture(series, r.horizon, extra),
    }));
  return { horizons, trusted, rows, updatedAt: extra.updatedAt };
}

app.get("/api/future", (req, res) => {
  try {
    const series = req.query.series || "Local Special";
    const data = futureRows(series);
    if (!data) return res.json({ available: false });
    res.json({ available: true, series, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Optional Gemini features (explainer + chatbot) ----
const explainCache = new Map();

// Gemini error text can include model names and Google's wording; keep it
// in the server log and send the browser something short and safe.
function publicAiError(err) {
  if (/busy/i.test(err.message)) return "The AI is busy right now. Please try again in a minute.";
  if (/not set/i.test(err.message)) return "AI features are turned off on this server.";
  if (err.message === "blocked") return "The AI could not answer that. Please rephrase your question.";
  return "The AI is not available right now. Please try again later.";
}

app.get("/api/explain/status", (req, res) => {
  res.json({ enabled: Boolean(geminiConfig().key) });
});

app.post("/api/explain", rateLimit, async (req, res) => {
  try {
    const series = String(req.body?.series || "");
    if (!RICE_FILES[series]) return res.status(400).json({ error: "Unknown rice type" });
    const horizon = Number(req.body?.horizon);
    const lang = req.body?.lang === "tl" ? "tl" : "en";
    const data = futureRows(series);
    const row = data?.rows.find((r) => r.horizon === horizon);
    if (!row) return res.status(404).json({ error: "No forecast for that rice type and month" });

    const cacheKey = `${series}|${horizon}|${lang}|${data.updatedAt}`;
    if (!req.body?.fresh && explainCache.has(cacheKey)) {
      return res.json({ ...explainCache.get(cacheKey), cached: true });
    }

    const out = await callGemini(buildExplainPrompt(series, row, lang), { temperature: 0.5 });
    const result = { text: cleanReply(out.text), model: out.model, lang };
    explainCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("Gemini (explain):", err.message);
    res.status(502).json({ error: publicAiError(err) });
  }
});

// FACTS for the chatbot, rebuilt only when the model output files change.
let factsCache = { key: null, text: "" };
function chatFacts() {
  const extra = loadExtraResults();
  const key = `${resultsLastUpdated()}|${extra?.updatedAt}`;
  if (factsCache.key === key) return factsCache.text;
  const series = Object.keys(RICE_FILES);
  const text = buildFacts({
    series,
    monthlyActual: (s) => getMonthlyActual(s),
    results: loadResults(),
    extra,
    future: (s) => futureRows(s),
    snapshot: latestFactorSnapshot(),
  });
  factsCache = { key, text };
  return text;
}

app.post("/api/chat", rateLimit, async (req, res) => {
  let messages;
  try {
    messages = cleanMessages(req.body?.messages);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const question = messages.at(-1).text;
  const lang = guessLang(question);

  const guarded = quickGuard(question, lang);
  if (guarded) return res.json({ text: guarded, guarded: true });

  if (!geminiConfig().key) return res.status(503).json({ error: "AI features are turned off on this server." });

  // The rice type open on the dashboard, only if it is one we know.
  const viewing = RICE_FILES[req.body?.context?.series] ? req.body.context.series : null;

  try {
    const system =
      CHAT_RULES +
      (viewing ? `\n\nThe user is currently viewing: ${viewing} rice.` : "") +
      "\n\nFACTS (from the P-RICE model output; the only source of numbers)\n" +
      chatFacts();
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    // Stream the answer as it is written (one JSON object per line), so the
    // first words show up in a second or two instead of after the whole reply.
    let full = "";
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      res.status(200).set({
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
    };
    const send = (obj) => res.write(JSON.stringify(obj) + "\n");

    for await (const piece of streamGemini({ system, contents }, { temperature: 0.2 })) {
      start();
      full += piece;
      if (isUnsafe(full)) {
        // Output check failed mid-answer: replace everything sent so far.
        send({ replace: BLOCKED_REPLY });
        send({ done: true });
        return res.end();
      }
      send({ delta: piece });
      if (full.length > 2500) break;
    }
    start();
    send({ done: true });
    res.end();
  } catch (err) {
    console.error("Gemini (chat):", err.message);
    if (res.headersSent) {
      res.write(JSON.stringify({ error: publicAiError(err) }) + "\n");
      return res.end();
    }
    res.status(502).json({ error: publicAiError(err) });
  }
});

app.get("/api/results", (req, res) => {
  try {
    const freq = String(req.query.freq || "monthly");
    const available = Object.entries(RESULTS_FILES)
      .filter(([, s]) => fs.existsSync(path.join(MODEL_DIR, s.file)))
      .map(([k]) => k);
    const extra = freq === "monthly" ? loadExtraResults() : null;
    res.json({
      available,
      ...loadFullResults(freq),
      ablation: extra?.ablation ?? null,
      dieboldMariano: extra?.dieboldMariano ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`P-RICE API running on http://localhost:${PORT}`);
  console.log(`Reading model output from: ${RESULTS_XLSX}`);
  console.log(
    geminiConfig().key
      ? `Gemini AI (explainer + assistant): on, first model ${geminiConfig().model}`
      : "Gemini AI: off (no GEMINI_API_KEY in web/server/.env)"
  );
  if (!fs.existsSync(RESULTS_XLSX)) {
    console.warn(
      `WARNING: ${RESULTS_XLSX} not found yet. Run the notebook (Run All) first.`
    );
  }
});
