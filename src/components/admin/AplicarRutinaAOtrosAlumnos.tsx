"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { obtenerRutinaComoBorrador } from "@/app/admin/alumnos/rutinaTexto";
import { guardarAsistenteArmado } from "@/lib/generador-rutinas/asistente-armado-local";

/**
 * Pedido de Alejandro: "cuando entro a ver la rutina de un alumno... colócame
 * la opción de agregar[la a] varios alumnos". `CopiarRutinaAlumno` ya cubre el
 * camino manual (texto → Documentos → Pegar texto → un alumno a la vez); este
 * es el atajo directo a "Armar rutina" con varios alumnos de una.
 *
 * No publica nada acá: deja la rutina en el mismo respaldo local que usa el
 * asistente de "Armar rutina" (`asistente-armado-local.ts`, la misma clave que
 * lee `ArmarRutinaPanel` al montar) y manda al entrenador al selector de
 * alumnos, ya con la rutina cargada — de ahí en más es el camino normal:
 * elegir alumnos, revisar en la mesa de trabajo, publicar. Mismo criterio que
 * `CopiarRutinaAlumno`: nunca copiar directo sin pasar por esa revisión, para
 * que dos alumnos no terminen con la misma rutina sin que nadie la haya
 * mirado — acá el "nadie la mira" se evita porque la mesa de trabajo es
 * parada obligatoria antes de publicar, no un paso que se pueda saltear.
 */
export function AplicarRutinaAOtrosAlumnos({ rutinaId, nombreRutina }: { rutinaId: string; nombreRutina: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aplicar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await obtenerRutinaComoBorrador(rutinaId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Misma forma que `EstadoAsistente` en ArmarRutinaPanel.tsx: ese
      // componente lee esta clave tal cual al montar y restaura cada campo.
      // `seleccionados` vacío a propósito — el entrenador elige a quién desde
      // cero; en cuanto elija al menos uno, `rutina` ya viene cargada y salta
      // directo a la mesa de trabajo sin pasar por "Usar base VIP".
      guardarAsistenteArmado({
        seleccionados: [],
        nivel: "intermedio",
        dias: r.diasEntrenamiento,
        minutos: 60,
        rutina: r.rutina,
        alertas: [],
        seleccionando: true,
        disenandoEstructura: false,
        sesionesPlan: [],
        sesionActiva: 0,
        configuracionManual: false,
        seriesManuales: 3,
        repeticionesManuales: "8-12",
        ejerciciosPlaneadosPorDia: {},
        seriesPlaneadasPorDia: {},
        organizacionPlaneadaPorDia: {},
      });
      // Navegación completa (no `router.push`) a propósito: Next.js
      // prefetchea "/admin/armar-rutina" en segundo plano (el link de la
      // barra inferior) y, si ya lo hizo, una transición de cliente
      // reutiliza esa instancia YA montada de `ArmarRutinaPanel` —que leyó
      // el respaldo local ANTES de que existiera este que acabamos de
      // guardar— en vez de volver a montarla. Con una recarga dura no queda
      // duda: monta de cero y lee el respaldo recién escrito.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- La recarga dura es necesaria por el respaldo local explicado arriba.
      window.location.href = "/admin/armar-rutina";
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar la rutina.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Card>
      <p className="text-caption text-text-tertiary">APLICAR A OTROS ALUMNOS</p>
      <p className="text-caption mt-0.5 text-text-secondary">
        Lleva “{nombreRutina}” a Armar rutina, elegí ahí a quién más se la das y revisala antes de publicar.
      </p>
      <Button variant="secondary" size="xs" onClick={aplicar} loading={cargando} className="mt-2">
        <Users size={14} /> {cargando ? "Preparando…" : "Elegir alumnos"}
      </Button>
      {error && <p className="text-caption mt-2 text-error">{error}</p>}
    </Card>
  );
}
