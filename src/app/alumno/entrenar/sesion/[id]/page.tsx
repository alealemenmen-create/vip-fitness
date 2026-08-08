import { RotateCcw, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { SesionEjercicios } from "@/components/student/SesionEjercicios";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { VolverAEntrenar } from "@/components/student/VolverAEntrenar";
import { CronometroSesion } from "@/components/student/CronometroSesion";
import { CancelarSesionBoton } from "@/components/student/CancelarSesionBoton";
import { obtenerSesionCompleta } from "../../data";
import { reabrirSesion, iniciarRutina } from "../../actions";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";

// El aviso de fin de descanso lo programa `programarAvisoDescanso` (Server
// Action de esta página, ver push-actions.ts) con `after()`: el servidor
// espera los segundos del descanso y recién ahí manda el push. maxDuration
// de una Server Action se fija a nivel de página — sin esto, el default de
// la plataforma corta la espera mucho antes de que termine un descanso
// típico (90-180s).
export const maxDuration = 300;

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

  const esDescanso = sesion.diaTipo === "descanso";
  // Un día de descanso no tiene ejercicios que bloquear ni rutina que
  // "iniciar" — el bloqueo solo aplica a sesiones de entrenamiento real.
  const rutinaIniciada = sesion.rutinaIniciadaEn !== null;
  const bloqueadaPorIniciar = !esDescanso && sesion.estado === "en_progreso" && !rutinaIniciada;
  const sesionSoloLectura = sesion.estado !== "en_progreso" || vistaSoloLectura || bloqueadaPorIniciar;
  const completados = sesion.ejercicios.filter((e) => e.completado).length;
  const total = sesion.ejercicios.length;
  const estadoInfo = ESTADO_LABEL[sesion.estado];
  const puntosPreparados = calcularPuntosEntrenamiento(completados, total);

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
          accion={
            !esDescanso && sesion.estado === "en_progreso" && !vistaSoloLectura && rutinaIniciada ? (
              <CronometroSesion horaInicio={sesion.rutinaIniciadaEn!} />
            ) : null
          }
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
            celular apoyado y a medio ejercicio. Los puntos van ARRIBA de la
            barra (antes quedaban abajo a la derecha, sueltos y chicos) y el
            porcentaje al lado, mismo renglón — así se lee de una sola vez qué
            se gana y cuánto falta antes de mirar la barra en sí. */}
        {!esDescanso && total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-caption font-semibold text-vip">+{puntosPreparados} pts al finalizar</p>
              <p className="text-caption font-semibold text-text">
                {Math.round((completados / total) * 100)}%
              </p>
            </div>
            {/* h-3.5 y con resplandor propio en el relleno: antes era una
                barra plana, ahora se nota más que algo se está llenando de
                verdad, no solo un rectángulo que crece. */}
            <div className="h-3.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="barra-progreso-relleno h-full rounded-full bg-vip transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.round((completados / total) * 100)}%`,
                  boxShadow: "0 0 12px color-mix(in srgb, var(--color-vip) 55%, transparent)",
                }}
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
          </div>
        )}
      </div>

      {/* Antes vivía arriba, chico, apretado junto al título — pasaba
          desapercibido. Acá, grande y con el mismo resplandor insistente que
          "Ver entrenamiento" en el calendario, es la primera cosa que se ve
          al entrar a la sesión. */}
      {bloqueadaPorIniciar && (
        <form action={iniciarRutina}>
          <input type="hidden" name="sesion_id" value={sesion.id} />
          <button
            type="submit"
            className="btn-accion boton-entrenar-pulso radius-control flex h-16 w-full items-center justify-center gap-2 text-body font-bold"
          >
            <Play size={20} strokeWidth={3} /> Iniciar rutina
          </button>
        </form>
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
            <RotateCcw size={18} /> Reiniciar
          </button>
        </form>
      )}

      {!vistaSoloLectura && !esDescanso && sesion.estado === "en_progreso" && completados === 0 && (
        <CancelarSesionBoton sesionId={sesion.id} />
      )}

    </div>
  );
}
