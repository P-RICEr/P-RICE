function Shimmer({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-rice-100 dark:bg-white/10 ${className}`}
    />
  );
}

export function RiceTypeSelectorSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-rice-100 bg-white p-2.5 dark:border-white/10 dark:bg-white/5"
        >
          <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className="h-2.5 w-10" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ForecastCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-rice-100 dark:bg-white/5">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Shimmer className="h-14 w-14 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-5 w-40" />
            <Shimmer className="h-3 w-28" />
          </div>
        </div>
        <div className="space-y-2 sm:items-end sm:text-right">
          <Shimmer className="ml-auto h-5 w-28 rounded-full" />
          <Shimmer className="ml-auto h-10 w-32" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-rice-200/50 px-6 py-4 dark:border-white/10">
        <Shimmer className="h-9 w-56" />
        <Shimmer className="h-4 w-40" />
      </div>
    </div>
  );
}

export function TrendChartSkeleton() {
  return (
    <div className="rounded-2xl border border-rice-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-7 w-48 rounded-full" />
      </div>
      <Shimmer className="h-[340px] w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="space-y-2 rounded-2xl border border-rice-100 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
