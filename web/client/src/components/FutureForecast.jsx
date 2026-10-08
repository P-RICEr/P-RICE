import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api } from "../api";

function monthYear(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function peso(v) {
  return `₱${Number(v).toFixed(2)}`;
}

const CONF_TONE = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  Low: "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300",
  Unknown: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

// Plain-language summary built only from the model's numbers (SHAP values),
// so every statement can be traced back to the model output.
function summary(seriesLabel, row) {
  const dir =
    Math.abs(row.changePct) < 0.05
      ? "about the same as"
      : row.changePct > 0
      ? `${Math.abs(row.changePct).toFixed(2)}% higher than`
      : `${Math.abs(row.changePct).toFixed(2)}% lower than`;
  const top = row.reasons.slice(0, 2).map((r) => {
    const name = r.factor === "Price history" ? "recent price movement" : r.label.toLowerCase();
    return `${name} (${r.effect > 0 ? "pushing it up" : "pulling it down"} by ${peso(Math.abs(r.effect))})`;
  });
  const why = top.length ? ` The biggest influences are ${top.join(" and ")}.` : "";
  return `P-RICE expects ${seriesLabel} rice to be around ${peso(row.forecast)}/kg in ${monthYear(
    row.targetDate
  )}, ${dir} the ${monthYear(row.originDate)} price of ${peso(row.basePrice)}.${why}`;
}

function Segmented({ options, value, onChange, size = "md", label }) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-rice-50 p-0.5 dark:bg-white/10">
      {options.map(([v, text, Icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rice-400 ${pad} ${
            value === v
              ? "bg-white text-rice-900 shadow-sm dark:bg-rice-600 dark:text-white"
              : "text-rice-700 hover:text-rice-900 dark:text-rice-200 dark:hover:text-white"
          }`}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {text}
        </button>
      ))}
    </div>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2 py-1" aria-hidden="true">
      {[100, 94, 72].map((w) => (
        <div key={w} className="h-3 animate-pulse rounded-full bg-rice-100 dark:bg-white/10" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

export default function FutureForecast({ series, seriesLabel }) {
  const [data, setData] = useState(null);
  const [horizon, setHorizon] = useState(1);

  // Explanation: "summary" (built-in, from SHAP) or "ai" (Gemini).
  const [aiEnabled, setAiEnabled] = useState(false);
  const [mode, setMode] = useState("summary");
  const [lang, setLang] = useState("en");
  const [ai, setAi] = useState({ status: "idle" }); // idle | loading | done | error
  const [copied, setCopied] = useState(false);
  const cache = useRef(new Map()); // "series|horizon|lang" -> text
  const requestId = useRef(0);

  useEffect(() => {
    api
      .explainStatus()
      .then((s) => setAiEnabled(Boolean(s.enabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  useEffect(() => {
    api
      .future(series)
      .then((d) => {
        setData(d);
        if (d.rows?.length && !d.rows.some((r) => r.horizon === horizon)) setHorizon(d.rows[0].horizon);
      })
      .catch(() => setData({ available: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  const row = data?.rows?.find((r) => r.horizon === horizon) || data?.rows?.[0];

  function loadAi(fresh = false) {
    if (!row) return;
    const key = `${series}|${row.horizon}|${lang}`;
    if (!fresh && cache.current.has(key)) {
      setAi({ status: "done", text: cache.current.get(key) });
      return;
    }
    const id = ++requestId.current;
    setAi({ status: "loading" });
    api
      .explain(series, row.horizon, lang, fresh)
      .then((r) => {
        cache.current.set(key, r.text);
        if (id === requestId.current) setAi({ status: "done", text: r.text });
      })
      .catch((e) => id === requestId.current && setAi({ status: "error", error: e.message }));
  }

  // Selecting AI (or changing rice type, month or language while on AI) loads it right away.
  useEffect(() => {
    setCopied(false);
    if (mode === "ai") loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang, series, row?.horizon]);

  if (!data?.available || !row) return null;
  const maxEffect = Math.max(...row.reasons.map((r) => Math.abs(r.effect)), 0.01);
  const up = row.changePct > 0;

  function copy() {
    navigator.clipboard?.writeText(ai.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-rice-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-rice-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-rice-300">
            <CalendarClock className="h-4 w-4" />
            Next forecast
          </p>
          <h3 className="text-sm text-rice-900 dark:text-white">
            Beyond the data: from {monthYear(row.originDate)} onward
          </h3>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full bg-rice-50 p-1 dark:bg-white/10">
          {data.rows.map((r) => (
            <button
              key={r.horizon}
              onClick={() => setHorizon(r.horizon)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rice-400 ${
                r.horizon === row.horizon
                  ? "bg-rice-700 text-white shadow-sm"
                  : "text-rice-700 hover:bg-white dark:text-rice-200 dark:hover:bg-white/10"
              }`}
            >
              {new Date(r.targetDate + "T00:00:00Z").toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
              })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <p className="text-xs text-rice-900/60 dark:text-rice-100/60">{monthYear(row.targetDate)}</p>
          <p className="text-3xl font-extrabold text-rice-900 dark:text-white">
            {peso(row.forecast)}
            <span className="text-base font-medium text-rice-900/60 dark:text-rice-100/60">/kg</span>
          </p>
          {/* Same colors as the factor bars: up = pricier (red), down = cheaper (green). */}
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-rice-900 dark:text-rice-100">
            {up ? (
              <ArrowUp className="h-4 w-4" style={{ color: "var(--p-rice-push-up)" }} />
            ) : (
              <ArrowDown className="h-4 w-4" style={{ color: "var(--p-rice-push-down)" }} />
            )}
            {up ? "+" : ""}
            {row.changePct.toFixed(2)}% vs {peso(row.basePrice)}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              CONF_TONE[row.confidence.label] || CONF_TONE.Unknown
            }`}
          >
            Confidence: {row.confidence.label}
            {row.confidence.mape != null && ` (test MAPE ${row.confidence.mape.toFixed(1)}%)`}
          </span>
        </div>

        <div>
          {/* ---- Why this price? ---- */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rice-700 dark:text-rice-300">
              Why this price?
            </p>
            {aiEnabled && (
              <div className="flex items-center gap-2">
                {mode === "ai" && (
                  <Segmented
                    size="sm"
                    label="Language"
                    value={lang}
                    onChange={setLang}
                    options={[
                      ["en", "EN"],
                      ["tl", "Taglish"],
                    ]}
                  />
                )}
                <Segmented
                  label="Explanation type"
                  value={mode}
                  onChange={setMode}
                  options={[
                    ["summary", "Summary"],
                    ["ai", "AI explain", Sparkles],
                  ]}
                />
              </div>
            )}
          </div>

          <div
            aria-live="polite"
            className={`rounded-xl p-4 text-sm leading-relaxed transition-colors ${
              mode === "ai"
                ? "border border-rice-200 bg-gradient-to-br from-rice-50 to-white dark:border-rice-400/20 dark:from-rice-400/10 dark:to-transparent"
                : "bg-rice-50/70 dark:bg-white/5"
            } text-rice-900/90 dark:text-rice-100/90`}
          >
            {mode === "summary" && <p>{summary(seriesLabel, row)}</p>}

            {mode === "ai" && ai.status === "loading" && (
              <>
                <SkeletonLines />
                <p className="mt-2 text-[11px] text-rice-900/50 dark:text-rice-100/50">Writing an explanation…</p>
              </>
            )}

            {mode === "ai" && ai.status === "done" && <p className="animate-[fadeIn_.3s_ease-out]">{ai.text}</p>}

            {mode === "ai" && ai.status === "error" && (
              <div className="space-y-2">
                <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {ai.error}{" "}
                    <button onClick={() => loadAi(true)} className="font-semibold underline underline-offset-2">
                      Try again
                    </button>
                  </span>
                </p>
                <p>{summary(seriesLabel, row)}</p>
              </div>
            )}
          </div>

          {mode === "ai" && ai.status === "done" && (
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rice-900/55 dark:text-rice-100/55">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Written by AI from the numbers on this card. Check them before quoting.
              </span>
              <span className="flex items-center gap-3">
                <button onClick={copy} className="inline-flex items-center gap-1 font-semibold hover:text-rice-900 dark:hover:text-white">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => loadAi(true)}
                  className="inline-flex items-center gap-1 font-semibold hover:text-rice-900 dark:hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Rewrite
                </button>
              </span>
            </div>
          )}

          {/* ---- Factor effects ---- */}
          {row.reasons.length > 0 && (
            <div className="mt-5 space-y-2">
              {row.reasons.map((r) => {
                const isUp = r.effect > 0;
                return (
                  <div key={r.factor} className="grid grid-cols-[120px_1fr_64px] items-center gap-3 sm:grid-cols-[140px_1fr_64px]">
                    <span className="truncate text-xs text-rice-900 dark:text-rice-100" title={r.label}>
                      {r.label}
                    </span>
                    <div className="relative h-2.5 rounded-full bg-rice-50 dark:bg-white/10">
                      <div
                        className="absolute top-0 h-2.5 rounded-full"
                        style={{
                          width: `${Math.max(4, (Math.abs(r.effect) / maxEffect) * 100)}%`,
                          background: isUp ? "var(--p-rice-push-up)" : "var(--p-rice-push-down)",
                        }}
                      />
                    </div>
                    <span className="flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-rice-900 dark:text-rice-100">
                      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {peso(Math.abs(r.effect))}
                    </span>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-rice-900/50 dark:text-rice-100/50">
                How much each factor pushed this forecast up (red) or down (green), in ₱/kg, straight from
                the model.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 border-t border-rice-100 pt-3 text-[11px] leading-relaxed text-rice-900/50 dark:border-white/10 dark:text-rice-100/50">
        Unlike the card above, this is a true forecast: the model was retrained on all data up to{" "}
        {monthYear(row.originDate)} and the target months are not in the dataset yet. Market factors are
        held at their latest values. Only horizons where XGBoost beat both ARIMA and Naive on the test set
        are shown.
      </p>
    </div>
  );
}
