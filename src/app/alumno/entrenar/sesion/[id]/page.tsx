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
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";

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
  const puntosPreparados = calcularPuntosEntrenamiento(completados, total);

  // El consejo va fijo abajo, así que solo se muestra mientras se está
  // entrenando de verdad: en un día de descanso no hay nada que ejecutar, y
  // revisando una sesión ya cerrada solo taparía contenido.
  const mostrarConsejo = !esDescanso && !sesionSoloLectura;

  return (
    // space-y-3 y no 4: con siete ejercicios, cada 4 px entre tarjetas son
    // 28 px de scroll. Lo que se busca es que el ejercicio en curso y la
    // cabecera del siguiente entren juntos en una pantalla.
    <div className="space-y-3 pb-8">
      {/* Título, estado y avance quedan clavados arriba y los ejercicios pasan
          por debajo al hacer scroll (igual que la cabecera de Nutrición): con
          siete ejercicios, a mitad de sesión ya no se veía en qué día se está
          ni cuánto falta sin volver hasta arriba.
          El `-mx-4 px-4` es para que el fondo tape de borde a borde — el padding
          lateral lo pone el layout, y sin esto se veían las tarjetas colándose
          por los costados. */}
      <div className="sticky top-[var(--alto-cabecera-alumno)] z-20 -mx-4 space-y-2 bg-bg px-4 pb-2 pt-1">
        <VolverAEntrenar
          titulo={`${sesion.numeroCalendario ? `SESIÓN ${sesion.numeroCalendario} · ` : ""}${sesion.diaNombre}`}
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
            celular apoyado y a medio ejercicio. El porcentaje va sobre la barra
            misma para no gastar un renglón entero de cabecera fija. */}
        {!esDescanso && total > 0 && (
          <div className="flex items-center gap-2">
            {/* h-3 y no h-1.5: es el único indicador de avance de toda la
                sesión y a 6 px la ola de luz apenas se veía. */}
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="barra-progreso-relleno h-full rounded-full bg-vip transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round((completados / total) * 100)}%` }}
              >
                {/* Tres olas, cada una arrancando un tercio de ciclo después
                    que la anterior (ver .ola-progreso en globals.css). */}
                {[0, 1, 2].map((indice) => (
                  <span
                    key={indice}
                    className="ola-progreso"
                    style={{ animationDelay: `${indice * 0.7}s` }}
                  />
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-micro font-semibold text-vip">+{puntosPreparados} pts</p>
              <p className="text-[8px] leading-none text-text-tertiary">al finalizar</p>
            </div>
          </div>
        )}
      </div>

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
