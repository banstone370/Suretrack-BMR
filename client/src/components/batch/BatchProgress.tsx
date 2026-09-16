export function BatchProgress({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>Progress</span>
        <span className="font-medium text-ink">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line/80">
        <div
          className="h-full rounded-full bg-brand-800 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
