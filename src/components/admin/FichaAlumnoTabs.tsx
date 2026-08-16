"use client";

import { type ReactNode, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  Dumbbell,
  MessageCircle,
  Salad,
  UserCog,
} from "lucide-react";

export type IdPestanaFicha =
  | "resumen"
  | "plan"
  | "actividad"
  | "nutricion"
  | "comunicacion"
  | "documentos"
  | "cuenta";

const PESTANAS: { id: IdPestanaFicha; etiqueta: string; Icon: typeof Dumbbell }[] = [
  { id: "resumen", etiqueta: "Resumen", Icon: ClipboardList },
  { id: "plan", etiqueta: "Plan y rutina", Icon: Dumbbell },
  { id: "actividad", etiqueta: "Actividad", Icon: CalendarClock },
  { id: "nutricion", etiqueta: "Nutrición", Icon: Salad },
  { id: "comunicacion", etiqueta: "Comunicación", Icon: MessageCircle },
  { id: "documentos", etiqueta: "Documentos", Icon: BookOpen },
  { id: "cuenta", etiqueta: "Cuenta", Icon: UserCog },
];

/**
 * La ficha del alumno reunía estado, plan, actividad, nutrición, notas,
 * documentos y cuenta en una sola columna interminable (ver sección 7.5 del
 * instructivo de reorganización del panel). Este componente no cambia NADA
 * de lo que ya funciona — cada sección sigue siendo exactamente el mismo
 * componente con los mismos datos, solo se reparte en pestañas para no
 * obligar a bajar toda la pantalla para encontrar una cosa.
 *
 * La pestaña elegida no se guarda en la URL a propósito, en esta primera
 * versión: es más simple y no rompe nada de lo que ya existe. Si hace falta
 * que sobreviva a un refresh, se puede sumar después como `?tab=`.
 */
export function FichaAlumnoTabs({ secciones }: { secciones: Record<IdPestanaFicha, ReactNode> }) {
  const [activa, setActiva] = useState<IdPestanaFicha>("resumen");

  return (
    <div className="space-y-4">
      {/* `.ficha-panel` es el mismo chip dorado que ya usan los filtros de
          Alumnos (ListaAlumnos) — antes esta tira usaba `bg-vip text-black`,
          el ámbar saturado de siempre, mientras el resto del panel ya había
          pasado al dorado más sobrio del sistema nuevo. Rescatado de una
          revisión de `agent/reorganizar-panel-admin`: la estructura de
          pestañas por tema ya estaba bien resuelta acá: lo único que le
          faltaba era este acabado. */}
      <div role="tablist" aria-label="Secciones del alumno" className="fila-fichas-panel pb-1">
        {PESTANAS.map(({ id, etiqueta, Icon }) => {
          const activo = activa === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setActiva(id)}
              className="ficha-panel"
              data-activa={activo ? "true" : undefined}
            >
              <Icon size={14} />
              {etiqueta}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="space-y-3">
        {secciones[activa]}
      </div>
    </div>
  );
}
