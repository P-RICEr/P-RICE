import { Wheat } from "lucide-react";

const VARIETY_ACCENT = {
  Special: "bg-emerald-500",
  Premium: "bg-lime-500",
  "Well-milled": "bg-amber-500",
  "Regular-milled": "bg-teal-500",
};

export default function RiceTypeSelector({ series, selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {series.map((s) => {
        const active = s.key === selected;
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
              active
                ? "border-rice-700 bg-rice-800 text-white shadow-sm"
                : "border-rice-100 bg-white text-rice-900 hover:border-rice-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-rice-400"
            }`}
          >
            <span
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-white/15" : "bg-rice-50 dark:bg-white/10"
              }`}
            >
              <Wheat
                className={`h-4 w-4 ${active ? "text-white" : "text-rice-700 dark:text-white"}`}
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${
                  active ? "ring-rice-800" : "ring-white dark:ring-rice-950"
                } ${VARIETY_ACCENT[s.variety] || "bg-rice-500"}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {s.origin}
              </span>
              <span className="block truncate text-sm font-semibold">{s.variety}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
