import Link from "next/link";
import { ArrowLeft, CircleDot } from "lucide-react";
import { requireRol } from "@/lib/auth";
import {
  obtenerIngresos,
  type EstadoIngresoAlumno,
  type IngresoDetalle,
  type RangoIngresos,
  type ResumenIngresoAlumno,
} from "@/lib/ingresos/data";
import { Card } from "@/components/ui/Card";
import { TituloPestana } from "@/components/admin/TituloPestana";
import { formatFechaDiaSemana, formatFechaHoraCorta, hoyISO, sumarDiasISO } from "@/lib/date";

const COLOR_ESTADO: Record<EstadoIngresoAlumno, string> = {
  activo_ahora: "text-vip",
  hoy: "text-text",
  esta_semana: "text-text-secondary",
  inactivo: "text-text-tertiary",
  nunca: "text-text-tertiary",
};

// Orden de lectura del panel: primero quién está más activo, al final quién
// necesita más atención. `resumen` ya viene ordenado por fecha dentro de
// cada grupo (ver obtenerIngresos), acá solo se define el orden de los
// encabezados de sección.
const SECCIONES_ESTADO: { estado: EstadoIngresoAlumno; titulo: string }[] = [
  { estado: "activo_ahora", titulo: "EN EL GIMNASIO AHORA" },
  { estado: "hoy", titulo: "ENTRARON HOY" },
  { estado: "esta_semana", titulo: "ESTA SEMANA" },
  { estado: "inactivo", titulo: "SIN ACTIVIDAD RECIENTE" },
  { estado: "nunca", titulo: "NUNCA ENTRARON" },
];

/** "Hoy", "Ayer" o "Jueves 6 de agosto" — igual criterio que el resto de la
 * app para fechas recientes, así el detalle se lee de un vistazo en vez de
 * obligar a comparar fechas. */
function tituloDia(fechaLocal: string): string {
  const hoy = hoyISO();
  if (fechaLocal === hoy) return "Hoy";
  if (fechaLocal === sumarDiasISO(hoy, -1)) return "Ayer";
  return formatFechaDiaSemana(fechaLocal);
}

function agruparPorDia(detalle: IngresoDetalle[]): { titulo: string; items: IngresoDetalle[] }[] {
  const grupos: { titulo: string; items: IngresoDetalle[] }[] = [];
  for (const item of detalle) {
    const titulo = tituloDia(item.fechaLocal);
    const grupoActual = grupos[grupos.length - 1];
    // `detalle` ya viene ordenado del más reciente al más antiguo, así que
    // el día de un ítem nuevo siempre es igual o anterior al último grupo.
    if (grupoActual?.titulo === titulo) grupoActual.items.push(item);
    else grupos.push({ titulo, items: [item] });
  }
  return grupos;
}

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRol(["entrenador", "admin"]);
  const query = await searchParams;
  const rango: RangoIngresos = query.rango === "mes" ? "mes" : "semana";

  const { resumen, detalle } = await obtenerIngresos(rango);
  const activosAhora = resumen.filter((r) => r.estado === "activo_ahora").length;
  const entraronHoy = resumen.filter((r) => r.estado === "activo_ahora" || r.estado === "hoy").length;
  const sinUsar = resumen.filter((r) => r.estado === "inactivo" || r.estado === "nunca").length;

  return (
    <div className="space-y-4 pb-8">
      <TituloPestana>
        <Link href="/admin/configuracion" className="flex items-center gap-2">
          <ArrowLeft size={20} className="text-text-secondary" />
          <span className="text-h3 text-text">Ingresos a la app</span>
        </Link>
      </TituloPestana>
      <p className="text-secondary text-text-secondary">
        Quién está usando la app y quién no. Cada visita cuenta una sola vez: si un alumno la
        abre varias veces seguidas (por ejemplo entrenando en el gimnasio), eso es UN ingreso —
        recién cuenta como otro si pasaron 2 horas o más desde el anterior.
      </p>

      <Card padding="p-1" className="leading-none">
        <div className="grid grid-cols-3 gap-1 text-center">
          <Resumen valor={activosAhora} etiqueta="en el gym ahora" />
          <Resumen valor={entraronHoy} etiqueta="entraron hoy" />
          <Resumen valor={sinUsar} etiqueta="sin novedad" />
        </div>
      </Card>

      <div className="flex gap-2">
        <TabRango rango="semana" actual={rango} etiqueta="Semana" />
        <TabRango rango="mes" actual={rango} etiqueta="Mes" />
      </div>

      <div className="space-y-4">
        <p className="text-caption text-text-tertiary">
          POR ALUMNO · {rango === "semana" ? "ÚLTIMOS 7 DÍAS" : "ÚLTIMOS 30 DÍAS"}
        </p>
        {resumen.length === 0 ? (
          <Card padding="p-4">
            <p className="text-secondary text-text-tertiary">Todavía no hay alumnos activos.</p>
          </Card>
        ) : (
          <SeccionesPorEstado resumen={resumen} />
        )}
      </div>

      <div className="space-y-3">
        <p className="text-caption text-text-tertiary">
          DETALLE CRONOLÓGICO · {rango === "semana" ? "ÚLTIMOS 7 DÍAS" : "ÚLTIMOS 30 DÍAS"}
        </p>
        {detalle.length === 0 ? (
          <Card padding="p-4">
            <p className="text-secondary text-text-tertiary">Sin ingresos registrados en este rango.</p>
          </Card>
        ) : (
          agruparPorDia(detalle).map((grupo) => (
            <div key={grupo.titulo} className="space-y-1.5">
              <p className="text-caption font-semibold text-text-tertiary">{grupo.titulo}</p>
              <Card padding="p-0" className="divide-y divide-border">
                {grupo.items.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-secondary text-text">{d.nombre}</span>
                    <span className="text-caption text-text-tertiary">{formatFechaHoraCorta(d.ingresoEn)}</span>
                  </div>
                ))}
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SeccionesPorEstado({ resumen }: { resumen: ResumenIngresoAlumno[] }) {
  return (
    <>
      {SECCIONES_ESTADO.map(({ estado, titulo }) => {
        const alumnos = resumen.filter((r) => r.estado === estado);
        if (alumnos.length === 0) return null;
        return (
          <div key={estado} className="space-y-1.5">
            <p className="text-caption font-semibold text-text-tertiary">
              {titulo} · {alumnos.length}
            </p>
            {alumnos.map((r) => (
              <Card key={r.alumnoId} padding="p-3" className="flex items-center gap-3">
                {r.estado === "activo_ahora" && <CircleDot size={16} className="shrink-0 text-vip" />}
                <span className="min-w-0 flex-1">
                  <span className="text-secondary block font-semibold text-text">{r.nombre}</span>
                  {r.ultimoIngreso && (
                    <span className={`text-caption block ${COLOR_ESTADO[r.estado]}`}>
                      {formatFechaHoraCorta(r.ultimoIngreso)}
                    </span>
                  )}
                </span>
                <span className="text-caption shrink-0 text-text-tertiary">
                  {r.totalIngresos} {r.totalIngresos === 1 ? "ingreso" : "ingresos"}
                </span>
              </Card>
            ))}
          </div>
        );
      })}
    </>
  );
}

function Resumen({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="p-2">
      <p className="text-h3 text-text">{valor}</p>
      <p className="text-caption text-text-tertiary">{etiqueta}</p>
    </div>
  );
}

function TabRango({
  rango,
  actual,
  etiqueta,
}: {
  rango: RangoIngresos;
  actual: RangoIngresos;
  etiqueta: string;
}) {
  const activo = rango === actual;
  return (
    <Link
      href={`/admin/ingresos?rango=${rango}`}
      className={`radius-control flex-1 py-2 text-center text-secondary font-semibold transition-colors ${
        activo ? "bg-surface-2 text-vip" : "border border-border text-text-tertiary"
      }`}
    >
      {etiqueta}
    </Link>
  );
}
