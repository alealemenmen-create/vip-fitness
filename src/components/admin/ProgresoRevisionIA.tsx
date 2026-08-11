"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/** Duración típica real, medida contra la base de producción: dos revisiones
 * seguidas de una rutina de un día tardaron 118 s y 137 s. La barra se calibra
 * contra este número en vez de inventar un porcentaje — si algún día la
 * revisión se acelera (modo rápido, menos capas), hay que bajar este valor o
 * la barra va a quedarse corta y mentir al revés. */
const DURACION_TIPICA_SEG = 120;

/** Lo que la IA audita de verdad, en el orden en que se lo pide el prompt del
 * sistema (ver SISTEMA en `lib/ai/revisarRutina.ts`). No se muestra cuál está
 * corriendo ahora mismo: la API no lo informa, así que decirlo sería inventar.
 * Se muestran como lo que son — el temario de la auditoría. */
const CAPAS = [
  "Perfil y antecedentes",
  "Estructura del split",
  "Cobertura muscular",
  "Redundancia",
  "Orden de ejercicios",
  "Volumen semanal",
  "Técnicas de intensidad",
  "Seguridad",
];

function formatearTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

/** Qué está pasando mientras la revisión con IA corre.
 *
 * Antes la pantalla se quedaba muda alrededor de dos minutos y parecía
 * colgada. Esto no acelera nada — dice qué está haciendo, cuánto lleva y
 * cuánto suele tardar, que es lo que faltaba. */
export function ProgresoRevisionIA() {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Tope en 95%: la barra nunca llega a 100 sola. Llegar al 100 y quedarse ahí
  // es peor que ir lento — parece que se colgó justo al final.
  const porcentaje = Math.min(95, Math.round((segundos / DURACION_TIPICA_SEG) * 100));
  const demorada = segundos > DURACION_TIPICA_SEG * 1.5;

  return (
    <div className="radius-control mt-3 border border-vip/30 bg-vip/5 p-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 animate-pulse text-vip" />
        <p className="text-caption flex-1 font-medium text-text">Analizando la rutina…</p>
        <span className="text-micro tabular-nums text-text-secondary">{formatearTiempo(segundos)}</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-vip transition-all duration-1000 ease-linear"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <p className="text-micro mt-2 text-text-tertiary">
        {demorada
          ? "Está tardando más de lo habitual, pero sigue trabajando. No cierres esta pantalla."
          : `Suele tardar cerca de ${Math.round(DURACION_TIPICA_SEG / 60)} minutos. Puedes seguir leyendo la rutina mientras tanto.`}
      </p>

      <p className="text-micro mt-2 text-text-tertiary">
        REVISA ESTAS 8 CAPAS
        <span className="sr-only">
          {" "}
          (el orden es el del método; no se indica cuál está en curso porque la IA no lo informa)
        </span>
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {CAPAS.map((capa) => (
          <span key={capa} className="radius-control bg-surface-2 px-1.5 py-0.5 text-micro text-text-secondary">
            {capa}
          </span>
        ))}
      </div>
    </div>
  );
}
