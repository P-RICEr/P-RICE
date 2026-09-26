import { TrendingUp, TrendingDown, Minus, Wheat, PackageSearch } from "lucide-react";

function monthYear(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const DIRECTION = {
  increase: { Icon: TrendingUp, label: "Expected Increase", tone: "text-emerald-300" },
  decrease: { Icon: TrendingDown, label: "Expected Decrease", tone: "text-red-300" },
  flat: { Icon: Minus, label: "Expected to Hold Steady", tone: "text-slate-300" },
};

export default function ForecastCard({ seriesLabel, unit, card, confidence, onMoreDetails }) {
  if (!card) {
    return (
      <div className="rounded-2xl bg-rice-900 p-8 text-center text-rice-100">
        No forecast available yet for this rice type. Run the notebook (Run All) first.
      </div>
    );
  }

  const { Icon, label, tone } = DIRECTION[card.direction] || DIRECTION.flat;

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-rice-900 via-rice-800 to-rice-700 text-white shadow-lg">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Wheat className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide">{seriesLabel}</h2>
            <p className="text-sm text-rice-100/80">Forecast for {monthYear(card.forecastDate)}</p>
          </div>
        </div>

        <div className="sm:text-right">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
            FORECAST PRICE
          </span>
          <p className="mt-2 text-4xl font-extrabold sm:text-5xl">
            ₱{card.forecastPrice.toFixed(2)}
            <span className="text-lg font-medium text-rice-100/80">/kg</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 bg-black/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <Icon className={`h-5 w-5 ${tone}`} />
          </span>
          <div>
            <p className={`text-sm font-semibold ${tone}`}>
              {label}
              {card.direction !== "flat" && ` (${card.changePct > 0 ? "+" : ""}${card.changePct}%)`}
            </p>
            <p className="text-xs text-rice-100/70">
              Confidence: {confidence.label}
              {confidence.mape != null && ` (MAPE ${confidence.mape.toFixed(1)}%)`}{" "}
              <button
                onClick={onMoreDetails}
                className="underline decoration-dotted underline-offset-2 hover:text-white"
              >
                more details
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-rice-100/70">
          <PackageSearch className="h-4 w-4" />
          <span>
            Based on {monthYear(card.currentDate)} price of ₱{card.currentPrice.toFixed(2)}
            {unit ? `/${unit.split("/")[1]}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
