export function StatTile({
  value,
  label,
  accent = false,
}: {
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-h3 ${accent ? "text-vip" : "text-text"}`}>{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-2">{children}</div>;
}
