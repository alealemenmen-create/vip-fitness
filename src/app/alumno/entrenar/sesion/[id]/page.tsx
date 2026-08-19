import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { SesionEjercicios } from "@/components/student/SesionEjercicios";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { VolverAEntrenar } from "@/components/student/VolverAEntrenar";
import { SalidaGuiadaSesion } from "@/components/student/SalidaGuiadaSesion";
import { ReabrirSesionBoton } from "@/components/student/ReabrirSesionBoton";
import { EliminarSesionBoton } from "@/components/student/EliminarSesionBoton";
import { CancelarSesionBoton } from "@/components/student/CancelarSesionBoton";
import { RefrescarRecomendaciones } from "@/components/student/RefrescarRecomendaciones";
import { BotonIniciarRutinaFijo } from "@/components/student/BotonIniciarRutinaFijo";
import { sePuedeCorregir, diasDesdeInicio } from "@/lib/entrenamiento/estado-sesion";
import { obtenerSesionCompleta, obtenerConflictoSesionActiva, tienePedidoDeBorradoPendiente } from "../../data";
import { terminarCorreccion } from "../../actions";
import { SincronizarIndicacionesAle } from "@/components/student/SincronizarIndicacionesAle";
import { AvisoSesionColgada } from "@/components/student/AvisoSesionColgada";
import Link from "next/link";

// Más de esto y ya no es "seguí donde quedaste", es una sesión que el
// alumno se olvidó de cerrar hace días — ver AvisoSesionColgada.
const DIAS_SESION_COLGADA = 1;

// El aviso de fin de descanso lo programa `programarAvisoDescanso` (Server
// Action de esta página, ver push-actions.ts) con `after()`: el servidor
// espera los segundos del descanso y recién ahí manda el push. maxDuration
// de una Server Action se fija a nivel de página — sin esto, el default de
// la plataforma corta la espera mucho antes de que termine un descanso
// típico (90-180s).
export const maxDuration = 300;

export default async function SesionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const { alumnoId, soloLectura: vistaSoloLectura } = await requireAlumno();
  const supabase = await createClient();

  // Las dos en paralelo: el pedido de borrado no depende de la sesión, y
  // encadenarlas agregaba un viaje de ida y vuelta a una pantalla que ya es la
  // más pesada de la pestaña.
  const [sesion, pedidoDeBorradoPendiente] = await Promise.all([
    obtenerSesionCompleta(supabase, alumnoId, id),
    tienePedidoDeBorradoPendiente(supabase, alumnoId, id),
  ]);

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
  // Solo se consulta cuando hace falta: es el único momento en que
  // "Iniciar rutina" puede chocar con otra sesión activa (ver
  // BotonIniciarRutinaFijo, pedido de Alejandro 2026-08-17 — antes este
  // camino redirigía en silencio sin preguntar, a diferencia del calendario).
  const conflictoIniciar = bloqueadaPorIniciar
    ? await obtenerConflictoSesionActiva(supabase, alumnoId, sesion.id)
    : null;
  /**
   * Corrigiendo un registro ya cerrado (migración 0077). NO es entrenar: la
   * sesión sigue cerrada, no corre ningún reloj y no vuelve a sumar puntos.
   * Solo se destraban los campos para arreglar un kilo mal escrito.
   *
   * Antes esto se hacía poniendo la sesión en `en_progreso`, y el efecto era
   * volver a arrancar la rutina entera — con cronómetro, aviso al salir y
   * bloqueo de cualquier otra sesión. "Corregir registro inicia nuevamente la
   * rutina, y no es la idea" (Alejandro).
   */
  const enCorreccion = !vistaSoloLectura && sesion.corrigiendoDesde !== null;
  const diasSinCerrar = diasDesdeInicio(sesion.horaInicio);
  const sesionColgada =
    !esDescanso &&
    sesion.estado === "en_progreso" &&
    rutinaIniciada &&
    !vistaSoloLectura &&
    !enCorreccion &&
    diasSinCerrar >= DIAS_SESION_COLGADA;
  const sesionSoloLectura =
    (sesion.estado !== "en_progreso" && !enCorreccion) || vistaSoloLectura || bloqueadaPorIniciar;
  const completados = sesion.ejercicios.filter((e) => e.completado).length;
  const total = sesion.ejercicios.length;
  const modoEnfocadoActivo = !esDescanso && !sesionSoloLectura && !enCorreccion;
  const tituloSesion = `${sesion.numeroCalendario ? `S${sesion.numeroCalendario} · ` : ""}${sesion.diaNombre}`;
  const firmaIntervenciones = JSON.stringify(
    sesion.ejercicios.flatMap((ejercicio) => ejercicio.intervencionesImpulso.map((intervencion) => ({
      id: intervencion.id,
      origen: intervencion.origen,
      instruccion: intervencion.instruccion,
      estado: intervencion.estado,
    }))).sort((a, b) => a.id.localeCompare(b.id)),
  );

  return (
    // space-y-3 y no 4: con siete ejercicios, cada 4 px entre tarjetas son
    // 28 px de scroll. Lo que se busca es que el ejercicio en curso y la
    // cabecera del siguiente entren juntos en una pantalla.
    // `pb-32` cuando "Iniciar rutina" queda fijo abajo (ver más abajo): sin
    // ese aire de más, el botón fijo tapaba el último ejercicio de la lista.
    <div className={`entrenar-minimalista space-y-3 ${bloqueadaPorIniciar ? "pb-32" : "pb-8"}`}>
      {sesion.estado === "en_progreso" && rutinaIniciada && !vistaSoloLectura && (
        <SincronizarIndicacionesAle
          sesionId={sesion.id}
          sesionEjercicioIds={sesion.ejercicios.map((ejercicio) => ejercicio.sesionEjercicioId)}
          firmaInicial={firmaIntervenciones}
        />
      )}
      {sesion.estado === "en_progreso" && !vistaSoloLectura && (
        <RefrescarRecomendaciones sesionId={sesion.id} />
      )}
      {sesionColgada && <AvisoSesionColgada sesionId={sesion.id} dias={diasSinCerrar} />}
      {aviso === "pedido-enviado" && (
        <Card padding="p-3" className="border border-success/40 bg-success/10">
          <p className="text-caption font-semibold text-success">Tu pedido llegó a tu entrenador</p>
          <p className="text-micro mt-1 text-text-secondary">
            Él revisa y borra el registro. Mientras tanto queda como está.
          </p>
        </Card>
      )}
      {aviso === "pedido-en-curso" && (
        <Card padding="p-3" className="border border-warning/40 bg-warning/10">
          <p className="text-caption font-semibold text-warning">Ya tenías un pedido para este registro</p>
          <p className="text-micro mt-1 text-text-secondary">
            No hizo falta mandar otro. Tu entrenador todavía lo está revisando.
          </p>
        </Card>
      )}
      {aviso === "falta-migracion" && (
        <Card padding="p-3" className="border border-warning/40 bg-warning/10">
          <p className="text-caption font-semibold text-warning">Esta opción todavía no está activa</p>
          <p className="text-micro mt-1 text-text-secondary">
            Avísale a tu entrenador. Tu registro no se tocó.
          </p>
        </Card>
      )}
      {/* Título, estado y avance quedan clavados arriba y los ejercicios pasan
          por debajo al hacer scroll (igual que la cabecera de Nutrición): con
          siete ejercicios, a mitad de sesión ya no se veía en qué día se está
          ni cuánto falta sin volver hasta arriba.
          El `-mx-4 px-4` es para que el fondo tape de borde a borde — el padding
          lateral lo pone el layout, y sin esto se veían las tarjetas colándose
          por los costados. */}
      {!modoEnfocadoActivo && <div className="sticky top-0 z-20 -mx-4 space-y-1.5 bg-bg px-4 pb-2 pt-1">
        <VolverAEntrenar
          titulo={tituloSesion}
          compacto
          accion={
            !esDescanso && sesion.estado === "en_progreso" && !vistaSoloLectura && rutinaIniciada ? (
              <div className="flex items-center gap-2">
                <p className="text-caption font-semibold tabular-nums text-text-secondary">{completados}/{total}</p>
                <Link
                  href="/alumno/entrenar"
                  className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-caption font-semibold text-text-secondary"
                >
                  Salir
                </Link>
              </div>
            ) : null
          }
        />
        {/* Barra de avance del día. Las pastillas de arriba ya dicen "2 de 7",
            pero hay que leerlas; la barra se entiende de una mirada, con el
            celular apoyado y a medio ejercicio. Los puntos van ARRIBA de la
            barra (antes quedaban abajo a la derecha, sueltos y chicos) y el
            porcentaje al lado, mismo renglón — así se lee de una sola vez qué
            se gana y cuánto falta antes de mirar la barra en sí. */}
        {!esDescanso && total > 0 && (
          <div className="flex items-center gap-2.5">
            {/* h-3.5 y con resplandor propio en el relleno: antes era una
                barra plana, ahora se nota más que algo se está llenando de
                verdad, no solo un rectángulo que crece. */}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-label={`Progreso: ${completados} de ${total} ejercicios`}>
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
      </div>}

      {/* Por portal a document.body (ver BotonIniciarRutinaFijo): dentro de
          `.pantalla-scroll` un `position: fixed` normal queda "fijo" respecto
          a ese contenedor, que es el que scrollea — subía y bajaba con la
          lista en vez de quedarse clavado abajo. */}
      {bloqueadaPorIniciar && <BotonIniciarRutinaFijo sesionId={sesion.id} conflicto={conflictoIniciar} />}

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
          tituloSesion={tituloSesion}
          soloLectura={sesionSoloLectura}
          modoCorreccion={enCorreccion}
          completados={completados}
          total={total}
          accionCancelarSesion={
            sesion.estado === "en_progreso" && !vistaSoloLectura && !enCorreccion ? (
              <CancelarSesionBoton sesionId={sesion.id} tieneProgreso={completados > 0} compacto />
            ) : null
          }
        />
      )}

      {sesion.comentario && (
        <Card>
          <p className="text-caption text-text-tertiary">{esDescanso ? "TU NOTA" : "COMENTARIO"}</p>
          <p className="text-body text-text">{sesion.comentario}</p>
        </Card>
      )}

      {/* Barra de corrección. Va arriba de las opciones y no abajo de todo:
          mientras se corrige, salir es lo único que el alumno va a querer
          hacer después de arreglar el número. */}
      {enCorreccion && (
        <div className="space-y-2 rounded-[14px] border border-vip/40 bg-vip/10 p-3">
          <p className="text-caption font-semibold text-vip">Estás corrigiendo este registro</p>
          <p className="text-micro text-text-secondary">
            Edita los kilos y las repeticiones que estén mal. La sesión sigue cerrada y tus Puntos
            VIP no cambian — esto no vuelve a empezar la rutina.
          </p>
          <form action={terminarCorreccion}>
            <input type="hidden" name="sesion_id" value={sesion.id} />
            <button
              type="submit"
              className="btn-accion radius-control h-11 w-full text-caption font-semibold"
            >
              Listo, terminé de corregir
            </button>
          </form>
        </div>
      )}

      {!sesionSoloLectura && !enCorreccion && esDescanso && (
        <FinalizarEntrenamiento
          sesionId={sesion.id}
          completados={completados}
          total={total}
          esDescanso={esDescanso}
        />
      )}

      {/* Solo con la rutina realmente arrancada, y NUNCA en una corrección:
          corregir un registro viejo no es entrenar, así que no va cronómetro,
          ni aviso al salir, ni cierre automático. */}
      {!esDescanso && !sesionSoloLectura && !enCorreccion && rutinaIniciada && (
        <>
          <SalidaGuiadaSesion sesionId={sesion.id} completados={completados} total={total} />
          {/* Todo hecho: el cierre aparece solo, sin buscarlo. */}
        </>
      )}

      {/* Opciones del registro, al final de todo y con rótulo.
          Pedido de Alejandro, textual: "desde registro me aparezcan las
          opciones al final, abajo".

          Antes el botón estaba suelto, sin título, pegado al último ejercicio:
          quien no supiera que existía no lo encontraba. El criterio de qué
          sesiones se pueden corregir sale de `estado-sesion.ts`, el mismo que
          usa `reabrirSesion` — antes acá decía `!== "en_progreso"` y la acción
          rechazaba otras, así que el botón aparecía y no hacía nada. */}
      {sePuedeCorregir(sesion.estado) && !vistaSoloLectura && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
            Opciones de este registro
          </p>
          {/* Corregir NO se ofrece mientras ya se está corrigiendo: el botón
              ya se tocó y volver a tocarlo no hace nada. Alejandro: "cuando
              entro a corregir me da opciones de este registro y me dan de
              nuevo el botón corregir registro, y ahí no funciona. Ese botón
              está solamente cuando le das en ver registro".
              Es el mismo error que la 1.21 dio por cerrado —un botón visible
              que no responde se lee como app colgada—, solo que del otro lado
              de la puerta: allá faltaba la migración, acá sobra el botón.
              Salir de la corrección se hace con "Listo, terminé de corregir",
              arriba. */}
          {!enCorreccion && (
            <>
              <ReabrirSesionBoton sesionId={sesion.id} />
              <p className="text-micro text-text-tertiary">
                Corregir vuelve a abrir esta sesión para editar kilos y repeticiones. Tus Puntos VIP
                no cambian: esta sesión no vuelve a sumar ni pierde lo ya ganado.
              </p>
            </>
          )}
          {/* Debajo de corregir y más apagado, en ese orden a propósito:
              corregir es lo que se va a querer casi siempre, borrar es la
              excepción de haber marcado la rutina hecha sin querer. Y borrar
              no lo hace el alumno: lo pide, y lo resuelve el entrenador.

              Con un pedido ya esperando NO se ofrece el botón de nuevo: sin
              esto, la pantalla quedaba igual que antes de pedir —ninguna
              señal de que el pedido existía— y el alumno volvía a tocarlo
              creyendo que no había pasado nada. */}
          {pedidoDeBorradoPendiente ? (
            <div className="radius-control border border-warning/40 bg-warning/10 p-3">
              <p className="text-caption font-semibold text-warning">
                Ya pediste que borren este registro
              </p>
              <p className="text-micro mt-1 text-text-secondary">
                Tu entrenador lo revisa y decide. Mientras tanto el registro queda como está, y
                podés seguir corrigiéndolo.
              </p>
            </div>
          ) : (
            <>
              <EliminarSesionBoton sesionId={sesion.id} />
              <p className="text-micro text-text-tertiary">
                Borrar elimina el registro y sus Puntos VIP, y no se puede deshacer. Tu entrenador
                lo revisa antes; después vas a poder hacer esta sesión de nuevo.
              </p>
            </>
          )}
        </div>
      )}

    </div>
  );
}
