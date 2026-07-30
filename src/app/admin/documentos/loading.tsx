export default function Loading() {
  return (
    <div className="space-y-6 pb-8" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="h-80 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
    </div>
  );
}
