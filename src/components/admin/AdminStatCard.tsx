import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function AdminStatCard({
  icon,
  value,
  label,
  detail,
  color,
  href,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  detail: string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-vip"
      aria-label={`Abrir ${label}: ${value}`}
    >
    <div
      className="admin-metric-card min-w-0 rounded-3xl p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--metric-color)] group-hover:shadow-lg group-active:translate-y-0"
      style={{ "--metric-color": color } as React.CSSProperties}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-text md:text-3xl">{value}</p>
          <p className="mt-1 truncate text-sm font-semibold text-text">{label}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">{detail}</p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="grid size-10 place-items-center rounded-2xl border"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            {icon}
          </span>
          <ChevronRight size={15} className="text-text-tertiary transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </div>
    </Link>
  );
}
