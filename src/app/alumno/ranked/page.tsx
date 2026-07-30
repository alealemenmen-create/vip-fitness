import { Suspense } from "react";
import { Dumbbell, UtensilsCrossed, Smartphone, Trophy, Newspaper } from "lucide-react";
import { BadgeRango } from "@/components/student/BadgeRango";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { obtenerRankingSemanal } from "@/lib/ranking/data";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { TablaGeneral } from "@/components/student/TablaGeneral";
import { HistorialTorneos } from "@/components/student/HistorialTorneos";
import { EscalaRangos } from "@/components/student/EscalaRangos";
import { obtenerHistorialTorneos } from "@/lib/torneos/data";

export default async function RankedPage() {
  const { alumnoId } = await requireAlumno();

  // El título sale de inmediato con el resto del layout; el ranking y el
  // historial de torneos llegan cada uno por su lado (ver Inicio, mismo
  // criterio: nada de pantalla en blanco esperando la consulta más lenta).
  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-h2 text-text">
        Ranked <span className="text-vip">VIP</span>
      </h1>

      <Suspense fallback={<RankedCargando />}>
        <ContenidoRanked alumnoId={alumnoId} />
      </Suspense>
    </div>
  );
}

/** Esqueleto del bloque principal: reserva un alto parecido al del emblema
 * grande más las tarjetas, para que al llegar los datos no salte la página. */
function RankedCargando() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
    </div>
  );
}

async function ContenidoRanked({ alumnoId }: { alumnoId: string }) {
  const filas = await obtenerRankingSemanal();
  const propia = filas.find((f) => f.alumnoId === alumnoId);

  if (!propia) {
    return (
      <Card>
        <p className="text-body text-text-secondary">
          Todavía no estás participando del ranking.
        </p>
      </Card>
    );
  }

  const progreso = progresoAlSiguiente(propia.puntosAcumulados);

  return (
    <>
      {/* A) MI RANKING */}
      <Card className="efecto-3d">
        <div className="flex flex-col items-center text-center">
          <BadgeRango rango={propia.rango} size={150} destacado eager />
          <p className="text-caption mt-2 text-text-tertiary">TU RANGO</p>
          <p className="text-h2" style={{ color: propia.rango.color }}>
            {propia.rango.nombre}
          </p>
          <p className="text-secondary mt-1 text-text-secondary">
            {propia.puntosAcumulados.toLocaleString("es-CL")} pts acumulados
          </p>
          <p className="text-caption text-text-tertiary">
            Puesto #{propia.posicion} de {filas.length} esta semana · {propia.puntos.toLocaleString("es-CL")} pts
          </p>
        </div>

        {progreso && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-caption text-text-tertiary">
                Te faltan {progreso.faltan.toLocaleString("es-CL")} pts para{" "}
                {progreso.siguiente.nombre}
              </p>
              <p className="text-caption font-semibold text-vip">{progreso.pct}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all duration-500 ease-in-out"
                style={{
                  width: `${progreso.pct}%`,
                  background: `linear-gradient(90deg, ${propia.rango.color}, ${progreso.siguiente.color})`,
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Desglose de la semana */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">TUS PUNTOS DE ESTA SEMANA</p>
        <div className="space-y-2">
          <Categoria
            icono={<Dumbbell size={16} />}
            nombre="Asistencia al gimnasio"
            puntos={propia.desglose.asistencia}
          />
          <Categoria
            icono={<UtensilsCrossed size={16} />}
            nombre="Plan de alimentación"
            puntos={propia.desglose.alimentacion}
          />
          <Categoria
            icono={<Smartphone size={16} />}
            nombre="Actividad en la app"
            puntos={propia.desglose.app}
          />
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
          <p className="text-body font-semibold text-text">Total</p>
          <p className="text-h3 text-vip">{propia.puntos.toLocaleString("es-CL")}</p>
        </div>

        {propia.desglose.totalCrudo < 0 && (
          <p className="text-caption mt-2 text-text-tertiary">
            Las penalizaciones de esta semana no bajan tu puntaje de cero, pero tampoco sumas nada.
            Registra tus comidas y entrenamientos para empezar a subir.
          </p>
        )}
      </Card>

      {/* B) TABLA GENERAL */}
      <Card>
        <p className="text-caption mb-3 flex items-center gap-1.5 text-text-tertiary">
          <Trophy size={14} className="text-vip" /> TABLA GENERAL
        </p>
        <TablaGeneral filas={filas} alumnoId={alumnoId} />
      </Card>

      {/* C) NOTICIAS DE TORNEOS */}
      <Card>
        <p className="text-caption mb-3 flex items-center gap-1.5 text-text-tertiary">
          <Newspaper size={14} className="text-vip" /> RESULTADOS DE TORNEOS
        </p>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-md bg-surface-2" />}>
          <TorneosCerrados />
        </Suspense>
      </Card>

      {/* D) ESCALA DE RANGOS — para que se vea a qué se está jugando */}
      <Card>
        <p className="text-caption mb-1 text-text-tertiary">LOS 7 RANGOS</p>
        <p className="text-caption mb-3 text-text-secondary">
          Del más alto al más bajo. Compite en los torneos y cumple tu plan para subir.
        </p>
        <EscalaRangos rangoActual={propia.rango.nombre} />
      </Card>
    </>
  );
}

async function TorneosCerrados() {
  return <HistorialTorneos historial={await obtenerHistorialTorneos()} />;
}

function Categoria({
  icono,
  nombre,
  puntos,
}: {
  icono: React.ReactNode;
  nombre: string;
  puntos: number;
}) {
  const positivo = puntos >= 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-text-tertiary">{icono}</span>
        <p className="text-secondary truncate text-text-secondary">{nombre}</p>
      </div>
      <p
        className="text-secondary shrink-0 font-semibold"
        style={{ color: positivo ? "var(--color-success)" : "var(--color-error)" }}
      >
        {positivo ? "+" : ""}
        {puntos.toLocaleString("es-CL")}
      </p>
    </div>
  );
}
