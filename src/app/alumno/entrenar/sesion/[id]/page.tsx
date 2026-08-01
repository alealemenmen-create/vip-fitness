import { RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { SesionEjercicios } from "@/components/student/SesionEjercicios";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { VolverAEntrenar } from "@/components/student/VolverAEntrenar";
import { ConsejoEntrenamiento } from "@/components/student/ConsejoEntrenamiento";
import { consejoInicial } from "@/lib/frasesMotivacionales";
import { obtenerSesionCompleta } from "../../data";
import { reabrirSesion } from "../../actions";

const ESTADO_LABEL: Record<string, { texto: string; tone: "neutral" | "vip" | "success" | "error" }> = {
  en_progreso: { texto: "En progreso", tone: "vip" },
  completada: { texto: "Completada", tone: "success" },
  finalizada_incompleta: { texto: "Finalizada incompleta", tone: "error" },
  abandonada: { texto: "Abandonada", tone: "neutral" },
};

export default async function SesionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { alumnoId, soloLectura: vistaSoloLectura } = await requireAlumno();
  const supabase = await createClient();

  const sesion = await obtenerSesionCompleta(supabase, alumnoId, id);

  if (!sesion) {
    return (
      <div className="space-y-4 pb-8">
        <VolverAEntrenar titulo="Entrenar" />
        <Card>
          <p className="text-body text-text-secondary">No se encontró esta sesión.</p>
        </Card>
      </div>
    );
  }

  const sesionSoloLectura = sesion.estado !== "en_progreso" || vistaSoloLectura;
  const completados = sesion.ejercicios.filter((e) => e.completado).length;
  const total = sesion.ejercicios.length;
  const estadoInfo = ESTADO_LABEL[sesion.estado];
  const esDescanso = sesion.diaTipo === "descanso";

  // El consejo va fijo abajo, así que solo se muestra mientras se está
  // entrenando de verdad: en un día de descanso no hay nada que ejecutar, y
  // revisando una sesión ya cerrada solo taparía contenido.
  const mostrarConsejo = !esDescanso && !sesionSoloLectura;

  return (
    <div className={`space-y-4 ${mostrarConsejo ? "pb-16" : "pb-8"}`}>
      <VolverAEntrenar
        titulo={`${sesion.numeroCalendario ? `#${sesion.numeroCalendario} · ` : ""}${sesion.diaNombre}`}
      />
      <div className="flex items-center gap-2">
        <Pill tone={estadoInfo.tone}>{estadoInfo.texto}</Pill>
        {!esDescanso && (
          <Pill tone="neutral">
            {completados} de {total} ejercicios
          </Pill>
        )}
      </div>

      {/* Barra de avance del día. Las pastillas de arriba ya dicen "2 de 7",
          pero hay que leerlas; la barra se entiende de una mirada, con el
          celular apoyado y a medio ejercicio. */}
      {!esDescanso && total > 0 && (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-vip transition-[width] duration-500 ease-out"
              style={{ width: `${Math.round((completados / total) * 100)}%` }}
            />
          </div>
          <p className="text-caption mt-1 text-text-tertiary">
            {Math.round((completados / total) * 100)}% completado
          </p>
        </div>
      )}

      {esDescanso ? (
        <Card>
          <p className="text-caption mb-1 text-text-tertiary">DÍA DE DESCANSO</p>
          <p className="text-body text-text">
            {sesion.diaDescripcion || "Tu entrenador no dejó una sugerencia para este día."}
          </p>
        </Card>
      ) : (
        <SesionEjercicios
          ejercicios={sesion.ejercicios}
          sesionId={sesion.id}
          soloLectura={sesionSoloLectura}
          completados={completados}
          total={total}
        />
      )}

      {sesion.comentario && (
        <Card>
          <p className="text-caption text-text-tertiary">{esDescanso ? "TU NOTA" : "COMENTARIO"}</p>
          <p className="text-body text-text">{sesion.comentario}</p>
        </Card>
      )}

      {!sesionSoloLectura && esDescanso && (
        <FinalizarEntrenamiento
          sesionId={sesion.id}
          completados={completados}
          total={total}
          esDescanso={esDescanso}
        />
      )}

      {sesionSoloLectura && !vistaSoloLectura && (
        <form action={reabrirSesion}>
          <input type="hidden" name="sesion_id" value={sesion.id} />
          <button
            type="submit"
            className="radius-control flex h-12 w-full items-center justify-center gap-2 border border-vip text-body font-medium text-vip"
          >
            <RotateCcw size={18} /> Reiniciar / reabrir entrenamiento
          </button>
        </form>
      )}

      {mostrarConsejo && <ConsejoEntrenamiento inicial={consejoInicial()} />}
    </div>
  );
}
