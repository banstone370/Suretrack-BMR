export function PlaceholderPage({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 p-8">
      <h1 className="font-display text-2xl font-semibold text-brand-950">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">{note}</p>
    </div>
  );
}
