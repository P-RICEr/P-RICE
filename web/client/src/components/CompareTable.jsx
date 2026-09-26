import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { downloadCSV } from "../utils/export";

const DIRECTION_ICON = {
  increase: { Icon: TrendingUp, tone: "text-emerald-600 dark:text-emerald-400" },
  decrease: { Icon: TrendingDown, tone: "text-red-600 dark:text-red-400" },
  flat: { Icon: Minus, tone: "text-slate-500 dark:text-slate-400" },
};

const CONFIDENCE_TONE = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Low: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Unknown: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function toCSVRows(rows, horizon) {
  const header = [
    "Origin",
    "Variety",
    `Base Price (as of, ${horizon}mo before forecast)`,
    "Base Date",
    "Forecast Price",
    "Forecast Date",
    "Change %",
    "Confidence",
    "MAPE %",
  ];
  const body = rows.map((r) => [
    r.origin,
    r.variety,
    r.card?.currentPrice ?? "",
    r.card?.currentDate ?? "",
    r.card?.forecastPrice ?? "",
    r.card?.forecastDate ?? "",
    r.card?.changePct ?? "",
    r.confidence?.label ?? "",
    r.confidence?.mape ?? "",
  ]);
  return [header, ...body];
}

export default function CompareTable({ rows, horizon, onSelectSeries }) {
  return (
    <div className="rounded-2xl border border-rice-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-rice-100 p-4 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rice-600 dark:text-rice-300">
            Compare All Rice Types
          </p>
          <h3 className="text-sm text-rice-900 dark:text-white">
            {horizon}-month-ahead forecast, all 8 types
          </h3>
        </div>
        <button
          onClick={() => downloadCSV(`p-rice-compare-${horizon}mo.csv`, toCSVRows(rows, horizon))}
          className="flex items-center gap-1.5 rounded-lg border border-rice-700 px-3 py-1.5 text-xs font-semibold text-rice-700 hover:bg-rice-50 dark:border-rice-400 dark:text-rice-300 dark:hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-rice-100 text-left text-xs uppercase tracking-wide text-rice-600 dark:border-white/10 dark:text-rice-300">
              <th className="px-4 py-3 font-semibold">Rice Type</th>
              <th className="px-4 py-3 font-semibold">Current Price</th>
              <th className="px-4 py-3 font-semibold">Forecast Price</th>
              <th className="px-4 py-3 font-semibold">Change</th>
              <th className="px-4 py-3 font-semibold">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dir = r.card?.direction || "flat";
              const { Icon, tone } = DIRECTION_ICON[dir];
              const confTone = CONFIDENCE_TONE[r.confidence?.label] || CONFIDENCE_TONE.Unknown;
              return (
                <tr
                  key={r.key}
                  onClick={() => onSelectSeries(r.key)}
                  className="cursor-pointer border-b border-rice-50 last:border-0 hover:bg-rice-50 dark:border-white/5 dark:hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-rice-900 dark:text-white">{r.origin}</p>
                    <p className="text-xs text-rice-600 dark:text-rice-300">{r.variety}</p>
                  </td>
                  <td className="px-4 py-3 text-rice-900 dark:text-white">
                    {r.card ? `₱${r.card.currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-rice-900 dark:text-white">
                    {r.card ? `₱${r.card.forecastPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${tone}`}>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3.5 w-3.5" />
                      {r.card ? `${r.card.changePct > 0 ? "+" : ""}${r.card.changePct}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confTone}`}>
                      {r.confidence?.label || "Unknown"}
                      {r.confidence?.mape != null && ` (${r.confidence.mape.toFixed(1)}%)`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-rice-100 p-3 text-center text-xs text-rice-600 dark:border-white/10 dark:text-rice-300">
        Click a row to open that rice type in the single-view dashboard.
      </p>
    </div>
  );
}
