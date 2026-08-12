"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bug, X, Check, Camera } from "lucide-react";
import { reportarBug, type ReportarBugState } from "@/app/alumno/reportar-bug-actions";

const estadoInicial: ReportarBugState = { error: null, ok: false };

/**
 * Botón flotante de "algo se ve mal", sobre toda la app del alumno.
 *
 * Pedido de Alejandro: un botón chico que no moleste, siempre visible, que al
 * tocarlo saque una captura del momento del error, deje escribir qué pasó y lo
 * mande al panel del entrenador. La captura es la parte importante: describir
 * un bug por escrito es difícil, y una imagen del momento exacto vale más que
 * tres párrafos.
 *
 * La librería de captura se importa dinámicamente y SOLO al tocar el botón:
 * no tiene por qué entrar en el bundle inicial de una app que se usa con el
 * wifi del gimnasio.
 *
 * Se usa `html-to-image` y NO `html2canvas`: html2canvas reimplementa el
 * parser de CSS por su cuenta y revienta con las funciones de color modernas
 * ("Attempting to parse an unsupported color function 'color'"), y esta app
 * usa `color-mix()` en 130+ lugares. `html-to-image` serializa el DOM dentro
 * de un <foreignObject> de SVG y deja que el navegador lo dibuje, así que
 * soporta todo lo que el navegador ya soporta.
 */
export function BotonReportarBug() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [captura, setCaptura] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [estado, accion, enviando] = useActionState(reportarBug, estadoInicial);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setMontado(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Cierra solo después de un envío correcto, dejando ver el "listo" un
  // momento — sin esto el panel desaparece de golpe y no queda claro si se
  // mandó.
  useEffect(() => {
    if (!estado.ok) return;
    const id = window.setTimeout(() => {
      setAbierto(false);
      setCaptura(null);
    }, 1600);
    return () => window.clearTimeout(id);
  }, [estado.ok]);

  const abrir = async () => {
    setCapturando(true);
    setAbierto(true);
    try {
      // La captura se toma ANTES de abrir el panel (el panel taparía justo lo
      // que el alumno quiere mostrar). El `await` del import ya deja pasar un
      // frame, así que el diálogo todavía no se pintó cuando se dispara.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(document.body, {
        // Pixel ratio 1 y no el del dispositivo: en un teléfono moderno
        // (DPR 3) una captura a escala nativa son varios MB por reporte, y
        // para ver qué se rompió alcanza con el tamaño lógico.
        pixelRatio: 1,
        // Solo lo que el alumno tiene a la vista: el scroll completo de una
        // pantalla larga no aporta y multiplica el peso.
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
        // El propio botón flotante no aporta nada a la captura del problema.
        filter: (nodo) =>
          !(nodo instanceof HTMLElement && nodo.classList?.contains("boton-reportar-bug")),
      });
      setCaptura(dataUrl);
    } catch {
      // Sin captura se puede reportar igual — ver el comentario en la acción.
      setCaptura(null);
    } finally {
      setCapturando(false);
    }
  };

  if (!montado) return null;

  return (
    <>
      {/* Chico y translúcido a propósito: tiene que estar siempre disponible
          sin competir con los botones reales de cada pantalla. Va por encima
          de la barra de navegación (z-40) pero por debajo de los modales
          (z-50), para no taparlos cuando estén abiertos. */}
      <button
        type="button"
        onClick={abrir}
        aria-label="Reportar una falla"
        className="boton-reportar-bug fixed z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/80 text-text-tertiary shadow-lg backdrop-blur active:scale-95"
      >
        <Bug size={15} />
      </button>

      {abierto &&
        createPortal(
          <div
            role="dialog"
            aria-label="Reportar una falla"
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            onClick={() => !enviando && setAbierto(false)}
          >
            <div
              ref={dialogoRef}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[22px] border border-border bg-surface p-4 shadow-2xl"
            >
              {estado.ok ? (
                <div className="py-3 text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/15 text-success">
                    <Check size={22} />
                  </span>
                  <p className="text-card-title mt-3 text-text">Reporte enviado</p>
                  <p className="text-caption mt-1 text-text-secondary">
                    El entrenador ya lo puede ver. Gracias por avisar.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error/15 text-error">
                      <Bug size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-card-title text-text">Reportar una falla</p>
                      <p className="text-caption mt-0.5 text-text-secondary">
                        Cuéntanos qué se ve mal en esta pantalla.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAbierto(false)}
                      aria-label="Cerrar"
                      disabled={enviando}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form action={accion} className="mt-3 space-y-3">
                    <input type="hidden" name="ruta" value={pathname} />
                    <input type="hidden" name="captura" value={captura ?? ""} />
                    <input
                      type="hidden"
                      name="dispositivo"
                      value={`${window.innerWidth}x${window.innerHeight} · ${navigator.userAgent}`}
                    />

                    <textarea
                      name="descripcion"
                      required
                      minLength={5}
                      rows={3}
                      autoFocus
                      placeholder="Ej: el botón de completar no hace nada"
                      className="radius-control w-full border border-border bg-surface-2 px-3 py-2 text-secondary text-text placeholder:text-text-tertiary"
                    />

                    {/* Estado de la captura, siempre visible: el alumno tiene
                        que saber QUÉ se está mandando junto a su mensaje. */}
                    <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-3 py-2">
                      <Camera size={14} className="shrink-0 text-text-tertiary" />
                      <span className="text-micro flex-1 text-text-secondary">
                        {capturando
                          ? "Tomando captura de la pantalla…"
                          : captura
                            ? "Captura de esta pantalla adjunta"
                            : "Sin captura — se enviará solo tu mensaje"}
                      </span>
                    </div>

                    {estado.error && <p className="text-caption text-error">{estado.error}</p>}

                    <button
                      type="submit"
                      disabled={enviando || capturando}
                      className="radius-control flex h-11 w-full items-center justify-center bg-vip text-caption font-bold text-black disabled:opacity-60"
                    >
                      {enviando ? "Enviando…" : "Enviar reporte"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
