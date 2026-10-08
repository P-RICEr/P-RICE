import { useEffect, useState } from "react";
import { Info, Moon, Sun, LayoutGrid, Table2, BookOpen, BarChart3 } from "lucide-react";
import { api } from "./api";
import RiceTypeSelector from "./components/RiceTypeSelector";
import ForecastCard from "./components/ForecastCard";
import TrendChart from "./components/TrendChart";
import FutureForecast from "./components/FutureForecast";
import ChatAssistant from "./components/ChatAssistant";
import ModelInfoPanel from "./components/ModelInfoPanel";
import CompareTable from "./components/CompareTable";
import AboutPage from "./components/AboutPage";
import ResultsPage from "./components/ResultsPage";
import {
  RiceTypeSelectorSkeleton,
  ForecastCardSkeleton,
  TrendChartSkeleton,
  TableSkeleton,
} from "./components/Skeletons";

const HORIZONS = [1, 2, 3, 4, 5, 6];
const THEME_KEY = "p-rice-theme";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      /* ignore -- private browsing etc. */
    }
  }, [dark]);

  return [dark, setDark];
}

function timeAgo(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function App() {
  const [dark, setDark] = useDarkMode();
  const [view, setView] = useState("dashboard"); // "dashboard" | "compare" | "results" | "about"

  const [seriesList, setSeriesList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [horizon, setHorizon] = useState(1);
  const [forecast, setForecast] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);

  const [compareRows, setCompareRows] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Load rice types + last-updated meta once.
  useEffect(() => {
    api
      .series()
      .then((list) => {
        setSeriesList(list);
        setSelected((prev) => prev || list[0]?.key);
      })
      .catch((e) => setError(e.message));
    api.meta().then(setMeta).catch(() => {});
  }, []);

  // Load single-series forecast whenever the selection or horizon changes.
  useEffect(() => {
    if (!selected || view !== "dashboard") return;
    setLoading(true);
    setError(null);
    Promise.all([api.forecast(selected, horizon), api.modelInfo(horizon)])
      .then(([f, info]) => {
        setForecast(f);
        setModelInfo(info);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, horizon, view]);

  // Load the compare-all table whenever that tab or horizon changes.
  useEffect(() => {
    if (view !== "compare") return;
    setCompareLoading(true);
    setError(null);
    api
      .compare(horizon)
      .then((d) => setCompareRows(d.rows))
      .catch((e) => setError(e.message))
      .finally(() => setCompareLoading(false));
  }, [view, horizon]);

  const selectedMeta = seriesList.find((s) => s.key === selected);
  const seriesLabel = selectedMeta ? `${selectedMeta.origin} ${selectedMeta.variety}` : "";

  const TABS = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutGrid },
    { key: "compare", label: "Compare All", Icon: Table2 },
    { key: "results", label: "Test Results", Icon: BarChart3 },
    { key: "about", label: "About", Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-rice-50 pb-16 dark:bg-rice-950">
      <header className="border-b border-rice-100 bg-white dark:border-white/10 dark:bg-rice-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div className="flex items-center gap-3">
              <h1 className="shrink-0">
                <img src="/brand/logo-full.png" alt="P-RICE" className="h-10 w-auto dark:hidden" />
                <img src="/brand/logo-full-dark.png" alt="P-RICE" className="hidden h-10 w-auto dark:block" />
              </h1>
              <p className="hidden border-l border-rice-100 pl-3 text-xs leading-tight text-rice-700/70 sm:block dark:border-white/10 dark:text-white">
                Philippine Rice Price
                <br />
                Forecast Dashboard
              </p>
            </div>

            <button
              onClick={() => setDark(!dark)}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-rice-500 border-rice-100 text-rice-700 hover:bg-rice-50 sm:hidden dark:border-white/10 dark:text-white dark:hover:bg-white/10"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-rice-50 p-1 dark:bg-white/5">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rice-500 ${
                    view === key
                      ? "bg-rice-700 text-white shadow-sm"
                      : "text-rice-700 hover:bg-white dark:text-white dark:hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </nav>

            <button
              onClick={() => setDark(!dark)}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="hidden h-9 w-9 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-rice-500 border-rice-100 text-rice-700 hover:bg-rice-50 sm:flex dark:border-white/10 dark:text-white dark:hover:bg-white/10"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {meta?.resultsUpdatedAt && (
          <div className="border-t border-rice-100/70 bg-rice-50/60 px-4 py-1.5 text-center text-[11px] text-rice-700/80 dark:border-white/5 dark:bg-white/5 dark:text-white">
            Model results last updated {timeAgo(meta.resultsUpdatedAt)} (
            {new Date(meta.resultsUpdatedAt).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            )
          </div>
        )}
      </header>

      {view === "about" ? (
        <AboutPage />
      ) : view === "results" ? (
        <ResultsPage />
      ) : (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <strong>Couldn't load model data.</strong> {error}
              <p className="mt-1 text-red-600/80 dark:text-red-300/70">
                Make sure the API server is running and that
                "Model Development/P-RICE Results.xlsx" exists (run the notebook once first).
              </p>
            </div>
          )}

          {(view === "dashboard" || view === "compare") && (
            <div className="flex items-center justify-end gap-2">
              <label htmlFor="horizon" className="text-xs font-semibold text-rice-700 dark:text-white">
                Forecast horizon
              </label>
              <select
                id="horizon"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="rounded-lg border border-rice-100 bg-white px-2 py-1.5 text-xs font-semibold text-rice-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rice-500 dark:border-white/10 dark:bg-rice-900 dark:text-white"
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h} month{h > 1 ? "s" : ""} ahead
                  </option>
                ))}
              </select>
            </div>
          )}

          {view === "dashboard" && (
            <>
              {seriesList.length > 0 ? (
                <RiceTypeSelector series={seriesList} selected={selected} onSelect={setSelected} />
              ) : (
                <RiceTypeSelectorSkeleton />
              )}

              {loading || !forecast ? (
                <>
                  <ForecastCardSkeleton />
                  <TrendChartSkeleton />
                </>
              ) : (
                <>
                  <ForecastCard
                    seriesLabel={seriesLabel}
                    unit={forecast.unit}
                    card={forecast.card}
                    confidence={forecast.confidence}
                    onMoreDetails={() => setPanelOpen(true)}
                  />
                  <TrendChart history={forecast.history} seriesLabel={seriesLabel} dark={dark} />
                  <FutureForecast series={selected} seriesLabel={seriesLabel} />

                  <div className="flex flex-col items-start gap-3 rounded-2xl border border-rice-100 bg-white p-4 text-sm text-rice-900/80 sm:flex-row dark:border-white/10 dark:bg-white/5 dark:text-white">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-rice-600 dark:text-white" />
                    <div className="flex-1">
                      <p className="font-semibold text-rice-900 dark:text-white">
                        About this forecast
                      </p>
                      <p>
                        Forecast is generated using historical {seriesLabel.toLowerCase()} rice
                        prices and market indicators (Brent oil, farmgate price, inflation, rice
                        stocks, exchange rate, temperature, rainfall, and volume of production), read directly from this project's model output.
                      </p>
                    </div>
                    <button
                      onClick={() => setPanelOpen(true)}
                      className="shrink-0 rounded-lg border border-rice-700 px-3 py-1.5 text-xs font-semibold text-rice-700 hover:bg-rice-50 dark:border-rice-400 dark:text-white dark:hover:bg-white/10"
                    >
                      More details
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {view === "compare" && (
            <>
              {compareLoading || !compareRows ? (
                <TableSkeleton />
              ) : (
                <CompareTable
                  rows={compareRows}
                  horizon={horizon}
                  onSelectSeries={(key) => {
                    setSelected(key);
                    setView("dashboard");
                  }}
                />
              )}
            </>
          )}
        </main>
      )}

      <ChatAssistant series={selected} seriesLabel={seriesLabel} />

      <ModelInfoPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        info={modelInfo}
        horizon={horizon}
      />
    </div>
  );
}
