import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TituloPestana } from "@/components/admin/TituloPestana";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  backHref,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}) {
  const heading = (
    <div className="min-w-0">
      {eyebrow && (
        <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-vip">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">{title}</h1>
      {description && (
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary md:text-base">
          {description}
        </p>
      )}
    </div>
  );

  return (
    <TituloPestana>
      <div className="flex items-start justify-between gap-3">
        {backHref ? (
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={backHref}
              aria-label="Volver"
              className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:border-vip/50 hover:text-vip"
            >
              <ArrowLeft size={18} />
            </Link>
            {heading}
          </div>
        ) : (
          heading
        )}
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </TituloPestana>
  );
}
