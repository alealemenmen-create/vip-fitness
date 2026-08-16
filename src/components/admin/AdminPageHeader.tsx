import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TituloPestana } from "@/components/admin/TituloPestana";

/**
 * Encabezado único de todas las rutas del panel
 * (INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md §6, maqueta
 * `panel-entrenador-organizado.html`).
 *
 * Cuatro piezas y ninguna más: eyebrow dorado, un solo `h1`, descripción
 * breve y una fila de acciones con UNA principal visible. Las secundarias
 * llegan como `actions` y se dibujan al lado, delineadas.
 *
 * En celular la fila de acciones baja debajo del título (`1.25fr .75fr`, como
 * en la maqueta); desde 768 px vuelve a la derecha del encabezado, que es
 * donde el entrenador la busca con el mouse. Eso lo resuelve `.acciones-panel`
 * en globals.css, no este archivo.
 */
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
      {eyebrow && <p className="encabezado-panel-eyebrow">{eyebrow}</p>}
      <h1 className="encabezado-panel-titulo font-semibold text-text">{title}</h1>
      {description && <p className="encabezado-panel-descripcion">{description}</p>}
    </div>
  );

  return (
    <TituloPestana>
      <div className="md:flex md:items-start md:justify-between md:gap-4">
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
        {actions && <div className="acciones-panel md:shrink-0">{actions}</div>}
      </div>
    </TituloPestana>
  );
}
