import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, ChevronDown, Download, X } from "lucide-react";
import { api } from "../api";
import { downloadCSV } from "../utils/export";
import { TableSkeleton } from "./Skeletons";

const MODELS = [
  { key: "XGBoost", label: "XGBoost (P-RICE)", color: "var(--p-rice-xgb)" },
  { key: "ARIMA", label: "ARIMA", color: "var(--p-rice-arima)" },
  { key: "Naive", label: "Naive", color: "var(--p-rice-naive)" },
];

const METRICS = [
  { key: "mae", label: "MAE", unit: "₱/kg", hint: "Average error in pesos per kilo" },
  { key: "rmse", label: "RMSE", unit: "₱/kg", hint: "Like MAE, but punishes big misses more" },
  { key: "mape", label: "MAPE", unit: "%", hint: "Average error as a percent of the price" },
];

const FREQS = [
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
];

const card =
  "rounded-2xl border border-rice-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-rice-900";
const chip = (active) =>
  `rounded-full px-3 py-1 text-xs font-semibold transition ${
    active
      ? "bg-rice-700 text-white shadow-sm"
      : "text-rice-700 hover:bg-white dark:text-white dark:hover:bg-white/10"
  }`;

const legendText = (v) => <span className="text-rice-900 dark:text-white">{v}</span>;

function horizonLabel(h, unit, short = false) {
  if (short) return `${h} ${unit === "week" ? "wk" : "mo"}`;
  return `${h} ${unit}${h > 1 ? "s" : ""}`;
}

function fmt(v, digits = 3) {
  return v == null || Number.isNaN(v) ? "–" : Number(v).toFixed(digits);
}

function horizonRange(list, unit) {
  if (!list.length) return "none";
  const sorted = [...list].sort((a, b) => a - b);
  const label = unit === "week" ? "weeks" : "months";
  const consecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${sorted[0]}–${sorted.at(-1)} ${label}`;
  return sorted.length === 1
    ? horizonLabel(sorted[0], unit)
    : `${sorted.join(", ")} ${label}`;
}

function ChartTooltip({ active, payload, label, unit, metric }) {
  if (!active || !payload?.length) return null;
  const m = METRICS.find((x) => x.key === metric);
  return (
    <div className="rounded-lg border border-rice-100 bg-white px-3 py-2 text-xs shadow-md dark:border-white/10 dark:bg-rice-900">
      <p className="mb-1 font-semibold text-rice-900 dark:text-white">
        {unit ? horizonLabel(label, unit) + " ahead" : label}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-rice-900 dark:text-white">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {fmt(p.value)} {m?.unit}
        </p>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-white">
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold text-rice-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-rice-900/60 dark:text-white/80">{sub}</p>}
    </div>
  );
}

function Mark({ ok }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
      <Check className="h-3.5 w-3.5" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
      <X className="h-3.5 w-3.5" /> No
    </span>
  );
}

function SectionTitle({ title, sub, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-rice-900 dark:text-white">{title}</h3>
        {sub && <p className="text-xs text-rice-900/60 dark:text-white/80">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-rice-700 dark:text-white";
const td = "px-3 py-2 text-sm text-rice-900 dark:text-white";

export default function ResultsPage() {
  const [freq, setFreq] = useState("monthly");
  const [metric, setMetric] = useState("mae");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [typeHorizon, setTypeHorizon] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .results(freq)
      .then((d) => {
        setData(d);
        setTypeHorizon(d.horizonDecision[0]?.horizon ?? 1);
      })
      .catch((e) => setError(e.message));
  }, [freq]);

  const metricInfo = METRICS.find((m) => m.key === metric);

  // Test error by horizon: one row per horizon, one column per model.
  const byHorizon = useMemo(() => {
    if (!data) return [];
    const rows = new Map();
    for (const r of data.testSummary) {
      const row = rows.get(r.horizon) || { horizon: r.horizon };
      row[r.model] = r[metric];
      rows.set(r.horizon, row);
    }
    return [...rows.values()].sort((a, b) => a.horizon - b.horizon);
  }, [data, metric]);

  // Per rice type at the chosen horizon.
  const byType = useMemo(() => {
    if (!data) return [];
    const rows = new Map();
    for (const r of data.byRiceType.filter((x) => x.horizon === typeHorizon)) {
      const row = rows.get(r.series) || { series: r.series };
      row[r.model] = r[metric];
      rows.set(r.series, row);
    }
    return [...rows.values()];
  }, [data, metric, typeHorizon]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <strong>Couldn't load test results.</strong> {error}
        </div>
      </div>
    );
  }

  const unit = data?.unit;
  const wins = data
    ? data.horizonDecision.filter((h) => h.beatsArima && h.beatsNaive).map((h) => h.horizon)
    : [];
  const bestGain = data
    ? [...data.horizonDecision].sort((a, b) => b.improvementVsArima - a.improvementVsArima)[0]
    : null;
  const topDriver = data?.shapFactors.find((f) => f.factor !== "Price history");
  const shapMax = data ? Math.max(...data.shapFactors.map((f) => f.meanAbsShap)) : 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Controls: one row, above everything they affect */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-rice-900 dark:text-white">Test Results</h2>
          <p className="text-xs text-rice-900/60 dark:text-white/80">
            How P-RICE (XGBoost) performed on the held-out test set, against ARIMA and a naive
            "same as last {unit || "period"}" forecast.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-rice-50 p-1 dark:bg-white/10">
            {FREQS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFreq(f.key)}
                disabled={data && !data.available.includes(f.key)}
                className={chip(freq === f.key) + " disabled:opacity-40"}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full bg-rice-50 p-1 dark:bg-white/10">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                title={m.hint}
                className={chip(metric === m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data ? (
        <TableSkeleton />
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Beats both benchmarks at"
              value={wins.length ? horizonRange(wins, unit) : "No horizon"}
              sub="Lower MAE than ARIMA and Naive on the test set"
            />
            <Stat
              label="Best gain vs ARIMA"
              value={`${bestGain.improvementVsArima > 0 ? "+" : ""}${fmt(
                bestGain.improvementVsArima,
                1
              )}%`}
              sub={`at ${horizonLabel(bestGain.horizon, unit)} ahead (MAE)`}
            />
            <Stat
              label="Strongest market factor"
              value={topDriver?.label || "–"}
              sub="Highest mean |SHAP| after price history"
            />
          </div>

          {/* 1. Error by horizon */}
          <div className={card}>
            <SectionTitle
              title={`Test ${metricInfo.label} by forecast horizon`}
              sub={`${metricInfo.hint} (${metricInfo.unit}). Lower is better.`}
            />
            <div className="text-rice-700 dark:text-white">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={byHorizon} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
                  <XAxis
                    dataKey="horizon"
                    tickFormatter={(h) => horizonLabel(h, unit, true)}
                    tick={{ fontSize: 12 }}
                    stroke="currentColor"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="currentColor" width={48} />
                  <Tooltip content={<ChartTooltip unit={unit} metric={metric} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
                  {MODELS.map((m) => (
                    <Line
                      key={m.key}
                      type="monotone"
                      dataKey={m.key}
                      name={m.label}
                      stroke={m.color}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, fill: "var(--chart-surface)" }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Horizon decision table */}
          <div className={card}>
            <SectionTitle
              title="Horizon decision"
              sub="Test MAE per horizon, and whether XGBoost beats each benchmark."
            >
              <button
                onClick={() =>
                  downloadCSV(`p-rice-${freq}-horizon-decision.csv`, [
                    ["Horizon", "XGBoost MAE", "ARIMA MAE", "Naive MAE", "Beats ARIMA", "Beats Naive", "Improvement vs ARIMA (%)", "Improvement vs Naive (%)"],
                    ...data.horizonDecision.map((h) => [
                      horizonLabel(h.horizon, unit), h.xgboost, h.arima, h.naive,
                      h.beatsArima, h.beatsNaive, h.improvementVsArima, h.improvementVsNaive,
                    ]),
                  ])
                }
                className="flex items-center gap-1 rounded-lg border border-rice-200 px-2.5 py-1.5 text-xs font-semibold text-rice-700 hover:bg-rice-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-rice-100 dark:border-white/10">
                  <tr>
                    <th className={th}>Horizon</th>
                    <th className={th}>XGBoost</th>
                    <th className={th}>ARIMA</th>
                    <th className={th}>Naive</th>
                    <th className={th}>Beats ARIMA</th>
                    <th className={th}>Beats Naive</th>
                    <th className={th}>vs ARIMA</th>
                    <th className={th}>vs Naive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rice-100 dark:divide-white/10">
                  {data.horizonDecision.map((h) => {
                    const win = h.beatsArima && h.beatsNaive;
                    return (
                      <tr key={h.horizon} className={win ? "bg-emerald-50 dark:bg-emerald-400/10" : ""}>
                        <td className={td + " font-semibold"}>{horizonLabel(h.horizon, unit)}</td>
                        <td className={td + " font-semibold"}>{fmt(h.xgboost)}</td>
                        <td className={td}>{fmt(h.arima)}</td>
                        <td className={td}>{fmt(h.naive)}</td>
                        <td className={td}><Mark ok={h.beatsArima} /></td>
                        <td className={td}><Mark ok={h.beatsNaive} /></td>
                        <td className={td}>{h.improvementVsArima > 0 ? "+" : ""}{fmt(h.improvementVsArima, 1)}%</td>
                        <td className={td}>{h.improvementVsNaive > 0 ? "+" : ""}{fmt(h.improvementVsNaive, 1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-rice-900/60 dark:text-white/80">
              Highlighted rows: XGBoost has a lower MAE than both ARIMA and Naive. Improvement is the
              percent reduction in MAE.
            </p>
          </div>

          {/* 3. Per rice type */}
          <div className={card}>
            <SectionTitle
              title={`Test ${metricInfo.label} per rice type`}
              sub={`${horizonLabel(typeHorizon, unit)} ahead · ${metricInfo.unit} · lower is better`}
            >
              <div className="flex flex-wrap gap-1 rounded-full bg-rice-50 p-1 dark:bg-white/10">
                {data.horizonDecision.map((h) => (
                  <button
                    key={h.horizon}
                    onClick={() => setTypeHorizon(h.horizon)}
                    className={chip(typeHorizon === h.horizon)}
                  >
                    {horizonLabel(h.horizon, unit, true)}
                  </button>
                ))}
              </div>
            </SectionTitle>
            <div className="text-rice-700 dark:text-white">
              <ResponsiveContainer width="100%" height={460}>
                <BarChart
                  data={byType}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  barGap={2}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="currentColor" />
                  <YAxis
                    type="category"
                    dataKey="series"
                    width={150}
                    tick={{ fontSize: 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip
                    cursor={{ fill: "currentColor", opacity: 0.06 }}
                    content={<ChartTooltip metric={metric} />}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
                  {MODELS.map((m) => (
                    <Bar
                      key={m.key}
                      dataKey={m.key}
                      name={m.label}
                      fill={m.color}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-rice-700 dark:text-white">
                Show as table
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead className="border-b border-rice-100 dark:border-white/10">
                    <tr>
                      <th className={th}>Rice type</th>
                      {MODELS.map((m) => <th key={m.key} className={th}>{m.key}</th>)}
                      <th className={th}>Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rice-100 dark:divide-white/10">
                    {byType.map((r) => {
                      const best = MODELS.reduce((a, b) => (r[b.key] < r[a.key] ? b : a)).key;
                      return (
                        <tr key={r.series}>
                          <td className={td}>{r.series}</td>
                          {MODELS.map((m) => (
                            <td key={m.key} className={td + (m.key === best ? " font-bold" : "")}>
                              {fmt(r[m.key])}
                            </td>
                          ))}
                          <td className={td}>{best}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* 3b. Ablation */}
          {data.ablation?.length > 0 && (
            <div className={card}>
              <SectionTitle
                title="Do the market factors help? (ablation)"
                sub="Test MAE of XGBoost with price history only vs. price history + 8 market factors. Lower is better."
              />
              <div className="text-rice-700 dark:text-white">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.ablation} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
                    <XAxis dataKey="horizon" tickFormatter={(h) => horizonLabel(h, unit, true)} tick={{ fontSize: 12 }} stroke="currentColor" />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" width={48} />
                    <Tooltip content={<ChartTooltip unit={unit} metric="mae" />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
                    <Line type="monotone" dataKey="priceOnlyMae" name="Price history only" stroke="var(--p-rice-ablation)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, strokeWidth: 2, strokeDasharray: "0", fill: "var(--chart-surface)" }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="fullMae" name="Price + 8 market factors" stroke="var(--p-rice-xgb)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--chart-surface)" }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.ablation.map((a) => (
                  <span key={a.horizon} className="rounded-lg border border-rice-100 px-2.5 py-1 text-xs text-rice-900 dark:border-white/10 dark:text-white">
                    {horizonLabel(a.horizon, unit, true)}:{" "}
                    <strong>{a.reduction > 0 ? "−" : "+"}{fmt(Math.abs(a.reduction), 1)}% MAE</strong>{" "}
                    {a.factorsHelp ? "with factors" : "(factors don't help)"}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-rice-900/60 dark:text-white/80">
                From P-RICE Extra Analysis (Monthly). Both models were tuned and tested the same way, in the
                same run, so the comparison is fair. Numbers can differ slightly from the table above because
                that comes from a separate run.
              </p>
            </div>
          )}

          {/* 3c. Diebold-Mariano */}
          {data.dieboldMariano?.length > 0 && (
            <div className={card}>
              <SectionTitle
                title="Is the difference significant? (Diebold-Mariano test)"
                sub="One-sided test that XGBoost is more accurate (absolute error), validation + test months, Harvey-Leybourne-Newbold correction."
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="border-b border-rice-100 dark:border-white/10">
                    <tr>
                      <th className={th}>Horizon</th>
                      <th className={th}>XGBoost vs</th>
                      <th className={th}>Months</th>
                      <th className={th}>DM stat</th>
                      <th className={th}>p-value</th>
                      <th className={th}>Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rice-100 dark:divide-white/10">
                    {data.dieboldMariano.map((d) => (
                      <tr key={`${d.horizon}-${d.versus}`} className={d.sig5 ? "bg-emerald-50 dark:bg-emerald-400/10" : ""}>
                        <td className={td}>{horizonLabel(d.horizon, unit)}</td>
                        <td className={td}>{d.versus}</td>
                        <td className={td}>{d.months}</td>
                        <td className={td}>{fmt(d.stat)}</td>
                        <td className={td}>{fmt(d.pValue)}</td>
                        <td className={td}>
                          {d.pValue == null
                            ? "Not computable"
                            : d.sig5
                            ? "Significant (5%)"
                            : d.sig10
                            ? "Weak (10%)"
                            : "Not significant"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-rice-900/60 dark:text-white/80">
                Only {data.dieboldMariano[0].months} months could be tested, so the test has low power. "Not
                significant" means there is not enough evidence yet, not that the models are equal.
              </p>
            </div>
          )}

          {/* 4. SHAP */}
          <div className={card}>
            <SectionTitle
              title="What drives the forecast (SHAP)"
              sub={`Mean |SHAP| at ${horizonLabel(1, unit)} ahead, in ₱/kg: how much each factor moves the prediction on average.`}
            />
            <div className="space-y-2">
              {data.shapFactors.map((f) => (
                <div key={f.factor} className="group grid grid-cols-[150px_1fr_56px] items-center gap-3" title={`${f.label}: ${fmt(f.meanAbsShap, 4)}`}>
                  <span className="truncate text-xs text-rice-900 dark:text-white">{f.label}</span>
                  <div className="h-3 rounded-full bg-rice-50 dark:bg-white/10">
                    <div
                      className="h-3 rounded-full transition-opacity group-hover:opacity-80"
                      style={{
                        width: `${Math.max(2, (f.meanAbsShap / shapMax) * 100)}%`,
                        background: "var(--p-rice-shap)",
                      }}
                    />
                  </div>
                  <span className="text-right text-xs tabular-nums text-rice-900/70 dark:text-white/80">
                    {fmt(f.meanAbsShap, 3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Details */}
          <details className={card + " group"}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-rice-900 dark:text-white">
              Model details: validation vs test, tuned settings, ARIMA orders
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-6">
              <div className="overflow-x-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-white">
                  Validation vs test ({metricInfo.label})
                </p>
                <table className="w-full min-w-[520px]">
                  <thead className="border-b border-rice-100 dark:border-white/10">
                    <tr>
                      <th className={th}>Horizon</th>
                      <th className={th}>Set</th>
                      {MODELS.map((m) => <th key={m.key} className={th}>{m.key}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rice-100 dark:divide-white/10">
                    {[...new Set(data.valTestSummary.map((r) => `${r.horizon}|${r.set}`))].map((k) => {
                      const [h, set] = k.split("|");
                      const rows = data.valTestSummary.filter((r) => String(r.horizon) === h && r.set === set);
                      return (
                        <tr key={k}>
                          <td className={td}>{horizonLabel(Number(h), unit)}</td>
                          <td className={td}>{set}</td>
                          {MODELS.map((m) => (
                            <td key={m.key} className={td}>{fmt(rows.find((r) => r.model === m.key)?.[metric])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-white">
                  Tuned XGBoost settings per horizon
                </p>
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-rice-100 dark:border-white/10">
                    <tr>
                      {Object.keys(data.bestSettings[0] || {}).map((k) => (
                        <th key={k} className={th}>{k.replace(/_/g, " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rice-100 dark:divide-white/10">
                    {data.bestSettings.map((r) => (
                      <tr key={r.horizon}>
                        {Object.entries(r).map(([k, v]) => (
                          <td key={k} className={td}>{k === "horizon" ? horizonLabel(v, unit) : v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-white">
                  ARIMA order per rice type (p, d, q)
                </p>
                <div className="grid gap-2 sm:grid-cols-4">
                  {data.arimaOrders.map((a) => (
                    <div key={a.series} className="rounded-lg border border-rice-100 px-3 py-2 text-sm dark:border-white/10">
                      <p className="text-xs text-rice-900/60 dark:text-white/80">{a.series}</p>
                      <p className="font-mono font-semibold text-rice-900 dark:text-white">{a.order}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <p className="text-center text-[11px] text-rice-900/50 dark:text-white/80">
            Source: {data.file}, last updated{" "}
            {new Date(data.updatedAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}.
            Re-run the notebook to refresh these numbers.
          </p>
        </>
      )}
    </div>
  );
}
