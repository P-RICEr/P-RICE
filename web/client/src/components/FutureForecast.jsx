import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bot, CalendarClock, Loader2, Sparkles } from "lucide-react";
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

export default function FutureForecast({ series, seriesLabel }) {
  const [data, setData] = useState(null);
  const [horizon, setHorizon] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLang, setAiLang] = useState("en");
  const [ai, setAi] = useState({ status: "idle" }); // idle | loading | done | error

  useEffect(() => {
    api
      .explainStatus()
      .then((s) => setAiEnabled(Boolean(s.enabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  // A new rice type, month or language needs a new explanation.
  useEffect(() => {
    setAi({ status: "idle" });
  }, [series, horizon, aiLang]);

  function askGemini(h) {
    setAi({ status: "loading" });
    api
      .explain(series, h, aiLang)
      .then((r) => setAi({ status: "done", text: r.text, model: r.model }))
      .catch((e) => setAi({ status: "error", error: e.message }));
  }

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

  if (!data?.available || !data.rows?.length) return null;
  const row = data.rows.find((r) => r.horizon === horizon) || data.rows[0];
  const maxEffect = Math.max(...row.reasons.map((r) => Math.abs(r.effect)), 0.01);

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
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
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

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <p className="text-xs text-rice-900/60 dark:text-rice-100/60">{monthYear(row.targetDate)}</p>
          <p className="text-3xl font-extrabold text-rice-900 dark:text-white">
            {peso(row.forecast)}
            <span className="text-base font-medium text-rice-900/60 dark:text-rice-100/60">/kg</span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-rice-900 dark:text-rice-100">
            {row.changePct >= 0 ? (
              <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            {row.changePct > 0 ? "+" : ""}
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
          <p className="flex gap-2 text-sm leading-relaxed text-rice-900/85 dark:text-rice-100/85">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rice-600 dark:text-rice-300" />
            {summary(seriesLabel, row)}
          </p>

          {aiEnabled && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-400/20 dark:bg-sky-400/5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => askGemini(row.horizon)}
                  disabled={ai.status === "loading"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-700 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60 dark:bg-sky-500 dark:text-sky-950 dark:hover:bg-sky-400"
                >
                  {ai.status === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                  {ai.status === "done" ? "Explain again" : "Explain with AI"}
                </button>
                <div className="flex rounded-full bg-white p-0.5 text-[11px] font-semibold dark:bg-white/10">
                  {[
                    ["en", "English"],
                    ["tl", "Taglish"],
                  ].map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => setAiLang(code)}
                      className={`rounded-full px-2.5 py-0.5 transition ${
                        aiLang === code
                          ? "bg-sky-700 text-white dark:bg-sky-500 dark:text-sky-950"
                          : "text-sky-800 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {ai.status === "done" && (
                <p className="mt-2 text-sm leading-relaxed text-rice-900/85 dark:text-rice-100/85">{ai.text}</p>
              )}
              {ai.status === "error" && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  The AI explanation is not available right now ({ai.error}). The summary above is still
                  accurate.
                </p>
              )}
              <p className="mt-2 text-[11px] text-rice-900/50 dark:text-rice-100/50">
                {ai.status === "done"
                  ? `Written by ${ai.model} from the forecast and SHAP numbers on this card.`
                  : "Gemini rewrites the forecast and SHAP numbers on this card in plain language."}{" "}
                AI can make mistakes: the numbers on this card are the official model output.
              </p>
            </div>
          )}

          {row.reasons.length > 0 && (
            <div className="mt-4 space-y-2">
              {row.reasons.map((r) => {
                const up = r.effect > 0;
                return (
                  <div key={r.factor} className="grid grid-cols-[140px_1fr_64px] items-center gap-3">
                    <span className="truncate text-xs text-rice-900 dark:text-rice-100" title={r.label}>
                      {r.label}
                    </span>
                    <div className="relative h-2.5 rounded-full bg-rice-50 dark:bg-white/10">
                      <div
                        className="absolute top-0 h-2.5 rounded-full"
                        style={{
                          width: `${Math.max(4, (Math.abs(r.effect) / maxEffect) * 100)}%`,
                          background: up ? "var(--p-rice-push-up)" : "var(--p-rice-push-down)",
                        }}
                      />
                    </div>
                    <span className="flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-rice-900 dark:text-rice-100">
                      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {peso(Math.abs(r.effect))}
                    </span>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-rice-900/50 dark:text-rice-100/50">
                How much each factor pushed this forecast up or down (SHAP, in ₱/kg), straight from the model.
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
