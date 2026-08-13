import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { VolverAEntrenar } from "@/components/student/VolverAEntrenar";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { obtenerDiaVistaPrevia } from "../../data";

/**
 * Qué toca en un día, **sin empezarlo**.
 *
 * "Ver entrenamiento" crea la sesión de una, así que con otro entrenamiento
 * activo el alumno rebotaba a la sesión en curso: el botón decía "ver" y no
 * dejaba ver nada. Alejandro: "me posiciono en la sesión seis y le doy ver
 * entrenamiento y no lo veo, solo me lleva a la sesión que está abierta;
 * debería dejarme ver".
 *
 * Mirar no compromete nada: esta pantalla no crea sesión, no toca el cupo del
 * mes y no ofrece ningún botón para arrancar — para eso está el calendario,
 * que es donde vive la decisión de empezar un día. Lo que no puede mostrar son
 * las metas de Impulso VIP: se congelan al crear la sesión, y acá no hay
 * sesión todavía.
 */
export default async function DiaVistaPreviaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();

  const dia = await obtenerDiaVistaPrevia(supabase, alumnoId, id);

  if (!dia) {
    return (
      <div className="space-y-4 pb-8">
        <VolverAEntrenar titulo="Entrenar" />
        <Card>
          <p className="text-body text-text-secondary">No se encontró este día.</p>
        </Card>
      </div>
    );
  }

  const totalSeries = dia.ejercicios.reduce((acc, e) => acc + e.seriesProgramadas, 0);

  return (
    <div className="space-y-3 pb-8">
      <VolverAEntrenar titulo={dia.nombre} compacto />

      <Card padding="p-3" className="border border-border">
        <div className="flex items-start gap-2.5">
          <Eye size={18} className="mt-0.5 shrink-0 text-text-tertiary" />
          <div>
            <p className="text-caption font-semibold text-text">Estás mirando, no entrenando</p>
            <p className="text-micro mt-1 text-text-secondary">
              Este día todavía no empezó y nada de lo que veas acá se guarda. Para hacerlo, entrá
              desde Entrenar cuando te toque.
            </p>
          </div>
        </div>
      </Card>

      {dia.tipo === "descanso" ? (
        <Card>
          <p className="text-caption mb-1 text-text-tertiary">DÍA DE DESCANSO</p>
          <p className="text-body text-text">
            {dia.descripcion || "Tu entrenador no dejó una sugerencia para este día."}
          </p>
        </Card>
      ) : (
        <>
          <p className="text-micro px-1 text-text-tertiary">
            {dia.ejercicios.length} {dia.ejercicios.length === 1 ? "ejercicio" : "ejercicios"} ·{" "}
            {totalSeries} series
          </p>

          {dia.ejercicios.map((ejercicio) => (
            <Card key={ejercicio.id} padding="p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <IlustracionEjercicio
                  ilustracionSlug={null}
                  grupoMuscular={ejercicio.grupoMuscular}
                  nombre={ejercicio.nombre}
                  tamano={34}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {ejercicio.orden} {ejercicio.grupoMuscular ? `· ${ejercicio.grupoMuscular}` : ""}
                  </p>
                  <p className="text-body truncate font-semibold text-text">{ejercicio.nombre}</p>
                  <p className="text-caption text-text-secondary">
                    {ejercicio.seriesProgramadas} series · {ejercicio.repsProgramadas} reps
                    {ejercicio.descansoSegundos ? ` · ${ejercicio.descansoSegundos}s descanso` : ""}
                  </p>
                </div>
              </div>

              {ejercicio.tecnicaTipo && (
                <p className="text-micro mt-2 font-semibold text-vip">{ejercicio.tecnicaTipo}</p>
              )}
              {ejercicio.observacion && (
                <p className="text-micro mt-1 text-text-tertiary">{ejercicio.observacion}</p>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
