"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, DoorOpen, Dumbbell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { finalizarSesion } from "@/app/alumno/entrenar/actions";
import { programarAvisoSesionSinCerrar } from "@/app/alumno/entrenar/push-actions";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";
import { hayDescansoVencido } from "@/lib/entrenamiento/descanso";
import { BotonFinalizarSesion } from "@/components/student/BotonFinalizarSesion";

/**
 * Nadie cierra la rutina.
 *
 * El error más reportado del panel del alumno no es equivocarse cargando kilos:
 * es salirse de la sesión y dejarla abierta para siempre. La app no decía nada
 * — te ibas y listo — así que la sesión quedaba `en_progreso`, sin puntos, y
 * encima le tapaba el paso a la sesión siguiente.
 *
 * Esto pone una sola pregunta en el único momento donde importa: cuando el
 * alumno se está yendo. Tres caminos de salida, según lo que haya hecho:
 *
 * - Terminó todo  → se le ofrece cerrar y cobrar, que es lo obvio pero nadie
 *   hace; salir sin cerrar sigue estando, pero avisado.
 * - Le falta      → se le dice cuánto lleva y qué pasa si se va.
 * - Nada hecho    → salir es gratis y se lo dice, para no asustar a quien solo
 *   entró a mirar.
 *
 * Se enganchan las TRES formas reales de irse de un teléfono: tocar un enlace
 * (menú de abajo, "Volver"), el gesto/botón de atrás, y cerrar o recargar la
 * pestaña. Ninguna se puede interceptar desde el router de Next, así que van
 * por eventos del documento.
 */
export function SalidaGuiadaSesion({
  sesionId,
  completados,
  total,
}: {
  sesionId: string;
  completados: number;
  total: number;
}) {
  const [destino, setDestino] = useState<string | null>(null);
  /** Se fue a otra pestaña/app y volvió: aviso suave, sin bloquear nada. */
  const [volvio, setVolvio] = useState(false);
  /** Además tenía un descanso corriendo cuando se fue. Cambia el mensaje: no
   * es lo mismo "seguí donde lo dejaste" que "el reloj corrió sin vos". */
  const [descansoCorrio, setDescansoCorrio] = useState(false);
  /** Ya decidió salir: deja pasar la próxima navegación sin volver a preguntar. */
  const permitidoRef = useRef(false);
  /** El recordatorio push se programa una sola vez por visita: cada llamada
   * deja una función del servidor esperando doce minutos, y no hace falta más
   * de una — al vencer, igual vuelve a mirar la base antes de mandar nada. */
  const avisoProgramadoRef = useRef(false);
  const pendientes = total - completados;
  const completa = total > 0 && pendientes <= 0;
  const sinTocar = completados === 0;
  const puntos = calcularPuntosEntrenamiento(completados, total);

  const programarAviso = useCallback(() => {
    if (avisoProgramadoRef.current) return;
    avisoProgramadoRef.current = true;
    // Sin `await`: es un recordatorio, no puede demorar una salida. Si falla
    // (sin permiso de notificaciones, sin claves VAPID) se ignora en silencio
    // — la app adentro ya avisa igual.
    void programarAvisoSesionSinCerrar(sesionId).catch(() => {});
  }, [sesionId]);

  useEffect(() => {
    // 1. Enlaces. En fase de captura, para llegar antes que el router de Next.
    const alClic = (evento: MouseEvent) => {
      if (permitidoRef.current || evento.defaultPrevented) return;
      if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      const enlace = (evento.target as HTMLElement | null)?.closest?.("a");
      if (!(enlace instanceof HTMLAnchorElement)) return;
      const href = enlace.getAttribute("href");
      if (!href || href.startsWith("#") || enlace.target === "_blank") return;
      const url = new URL(enlace.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Quedarse dentro de la misma sesión no es salir.
      if (url.pathname === window.location.pathname) return;
      evento.preventDefault();
      evento.stopPropagation();
      setDestino(url.pathname + url.search);
    };
    document.addEventListener("click", alClic, true);

    // 2. Atrás del teléfono. Se deja una entrada de más en el historial para
    //    tener algo que consumir: al volver atrás se cae en ella, se pregunta,
    //    y se repone para que un segundo "atrás" tampoco se escape solo.
    window.history.pushState({ vipSesionAbierta: true }, "");
    const alVolver = () => {
      if (permitidoRef.current) return;
      window.history.pushState({ vipSesionAbierta: true }, "");
      setDestino("/alumno/entrenar");
    };
    window.addEventListener("popstate", alVolver);

    // 3. Cerrar o recargar la pestaña. Acá el navegador solo deja mostrar su
    //    propio cartel — no se puede elegir el texto, pero al menos frena.
    const alCerrar = (evento: BeforeUnloadEvent) => {
      if (permitidoRef.current) return;
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", alCerrar);

    // 4. Se fue a otra pestaña o a otra app (WhatsApp entre serie y serie es
    //    lo normal) y volvió. Acá NO se bloquea nada: solo un recordatorio al
    //    pie de que la sesión sigue abierta, porque volver y olvidarse es
    //    justo como quedan las sesiones sin cerrar. Solo si estuvo afuera más
    //    de dos minutos: mirar una notificación no merece un cartel.
    let salioEn = 0;
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        salioEn = Date.now();
        // Se fue de la app. Acá es donde se pierde de verdad al alumno: puede
        // no volver nunca a esta pantalla, así que el recordatorio se programa
        // ahora y lo entrega el sistema operativo aunque cierre todo.
        programarAviso();
        return;
      }
      if (salioEn && Date.now() - salioEn > 120_000) {
        setDescansoCorrio(hayDescansoVencido(sesionId));
        setVolvio(true);
      }
      salioEn = 0;
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      document.removeEventListener("click", alClic, true);
      window.removeEventListener("popstate", alVolver);
      window.removeEventListener("beforeunload", alCerrar);
    };
  }, [programarAviso, sesionId]);

  const salir = () => {
    permitidoRef.current = true;
    programarAviso();
    const ir = destino ?? "/alumno/entrenar";
    setDestino(null);
    // Navegación dura y no `router.push`: el guard de arriba ya se desarmó y
    // así no queda ninguna forma de que la intercepción vuelva a dispararse a
    // mitad de camino.
    window.location.href = ir;
  };

  if (!destino) {
    if (!volvio) return null;
    return createPortal(
      <div className="aviso-sesion-abierta" role="status">
        <p className="text-caption font-semibold text-warning">
          {descansoCorrio ? "Tu descanso siguió corriendo" : "Tu entrenamiento sigue abierto"}
        </p>
        {/* Decir "nada se perdió" mientras el contador de exceso descontaba
            puntos por ese mismo rato era mentirle en la cara. La penalización
            se queda como está —es lo que hace que el alumno vuelva y no se
            enfríe— pero el aviso ahora dice lo que de verdad pasó, y le
            recuerda dónde está el botón para frenarla. */}
        <p className="text-micro mt-0.5 text-text-secondary">
          {descansoCorrio
            ? "Mientras no estabas el reloj no se detuvo. Toca “toca para frenar”, sobre la serie en curso, para parar el descuento."
            : completa
              ? `Terminaste los ${total} ejercicios. Ciérralo para cobrar tus +${puntos} pts.`
              : `Llevas ${completados} de ${total}. Sigue donde lo dejaste.`}
        </p>
        <button
          type="button"
          onClick={() => setVolvio(false)}
          className="text-micro mt-1.5 text-text-tertiary underline"
        >
          Entendido
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center">
      <Card padding="p-4" className="w-full max-w-sm space-y-3">
        <div className="flex items-start gap-2.5">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              completa ? "bg-vip/15 text-vip" : "bg-surface-2 text-text-secondary"
            }`}
          >
            {completa ? <Trophy size={20} /> : sinTocar ? <DoorOpen size={20} /> : <Dumbbell size={20} />}
          </span>
          <div className="min-w-0">
            <p className="text-card-title text-text">
              {completa
                ? "¡Terminaste los ejercicios!"
                : sinTocar
                  ? "¿Salir de la rutina?"
                  : "Tu entrenamiento sigue abierto"}
            </p>
            <p className="text-caption mt-1 text-text-secondary">
              {completa
                ? `Hiciste los ${total}. Falta cerrarla para que se sumen tus +${puntos} Puntos VIP.`
                : sinTocar
                  ? "Todavía no registraste nada, así que no pierdes nada. Puedes volver cuando quieras."
                  : `Llevas ${completados} de ${total} ejercicios. Si sales ahora la sesión queda abierta y no suma puntos hasta que la cierres.`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!sinTocar && (
            <form action={finalizarSesion}>
              <input type="hidden" name="sesion_id" value={sesionId} />
              <BotonFinalizarSesion variant={completa ? "accion" : "primary"} size="sm" className="w-full">
                {completa ? `Cerrar y sumar +${puntos} pts` : `Finalizar así (+${puntos} pts)`}
              </BotonFinalizarSesion>
            </form>
          )}
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => setDestino(null)}>
            Seguir entrenando
          </Button>
          <button
            type="button"
            onClick={salir}
            className="text-caption min-h-10 text-text-tertiary underline"
          >
            {sinTocar ? "Sí, salir" : "Salir y seguir después"}
          </button>
        </div>
      </Card>
    </div>,
    document.body
  );
}
