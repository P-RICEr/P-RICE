import { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Image as ImageIcon } from "lucide-react";
import { downloadCSV, downloadNodeAsPNG } from "../utils/export";

const RANGES = [
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
  { key: "2Y", months: 24 },
  { key: "ALL", months: null },
];

function formatTick(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-rice-100 bg-white px-3 py-2 text-xs shadow-md dark:border-white/10 dark:bg-rice-900">
      <p className="mb-1 font-semibold text-rice-900 dark:text-white">{formatTick(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: ₱{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ history, seriesLabel, dark }) {
  const [range, setRange] = useState("1Y");
  const [exporting, setExporting] = useState(false);
  const chartAreaRef = useRef(null); // just the title + chart, so exported PNGs exclude the buttons

  const data = useMemo(() => {
    const r = RANGES.find((r) => r.key === range);
    if (!r || !r.months) return history;
    return history.slice(-r.months);
  }, [history, range]);

  async function handlePngExport() {
    if (!chartAreaRef.current) return;
    setExporting(true);
    try {
      await downloadNodeAsPNG(chartAreaRef.current, `p-rice-${seriesLabel.replace(/\s+/g, "-")}-chart.png`);
    } catch (e) {
      console.error(e);
      alert("Couldn't export the chart as an image. You can still export the CSV.");
    } finally {
      setExporting(false);
    }
  }

  function handleCsvExport() {
    const header = ["Date", "Actual Price (PHP/kg)", "Forecasted Price (PHP/kg)"];
    const rows = data.map((d) => [d.date, d.actual ?? "", d.forecast ?? ""]);
    downloadCSV(`p-rice-${seriesLabel.replace(/\s+/g, "-")}-data.csv`, [header, ...rows]);
  }

  return (
    <div className="rounded-2xl border border-rice-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-rice-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-rice-300">
            View Trend
          </p>
          <h3 className="text-sm text-rice-900 dark:text-white">
            {seriesLabel} — Actual vs. Forecasted Price
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-rice-50 p-1 dark:bg-white/10">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  range === r.key
                    ? "bg-rice-700 text-white shadow-sm"
                    : "text-rice-700 hover:bg-white dark:text-rice-200 dark:hover:bg-white/10"
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              onClick={handleCsvExport}
              title="Download this chart's data as CSV"
              className="flex items-center gap-1 rounded-lg border border-rice-200 px-2.5 py-1.5 text-xs font-semibold text-rice-700 hover:bg-rice-50 dark:border-white/20 dark:text-rice-200 dark:hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={handlePngExport}
              disabled={exporting}
              title="Download this chart as a PNG image"
              className="flex items-center gap-1 rounded-lg border border-rice-200 px-2.5 py-1.5 text-xs font-semibold text-rice-700 hover:bg-rice-50 disabled:opacity-50 dark:border-white/20 dark:text-rice-200 dark:hover:bg-white/10"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {exporting ? "Saving…" : "PNG"}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={chartAreaRef}
        className="bg-white p-1 text-rice-700 dark:bg-rice-900 dark:text-rice-200"
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={dark ? 0.15 : 0.5} />
            <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 12 }} stroke="currentColor" />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `₱${v}`}
              width={56}
              domain={["auto", "auto"]}
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Price"
              stroke="var(--p-rice-actual-stroke)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecasted Price"
              stroke="var(--p-rice-forecast-stroke)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
