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
import type { IdPestanaFicha } from "@/lib/alumnos/pestanas-ficha";

export type { IdPestanaFicha };

const PESTANAS: { id: IdPestanaFicha; etiqueta: string; Icon: typeof Dumbbell }[] = [
  { id: "resumen", etiqueta: "Resumen", Icon: ClipboardList },
  { id: "plan", etiqueta: "Plan y rutina", Icon: Dumbbell },
  { id: "actividad", etiqueta: "Actividad", Icon: CalendarClock },
  { id: "nutricion", etiqueta: "Nutrición", Icon: Salad },
  { id: "comunicacion", etiqueta: "Comunicación", Icon: MessageCircle },
  { id: "documentos", etiqueta: "Documentos", Icon: BookOpen },
  { id: "cuenta", etiqueta: "Cuenta", Icon: UserCog },
];

// `IDS_PESTANA_FICHA` (mismos 7 ids que `PESTANAS` de arriba, para validar
// `?tab=` desde un Server Component) vive en lib/alumnos/pestanas-ficha.ts —
// ver el comentario ahí de por qué no puede declararse ni re-exportarse
// desde este archivo "use client".

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
 *
 * Control VIP V2 (docs/PROYECTO_CONTROL_VIP_V2.md, Fase 2) sí lo necesita:
 * `pestanaInicial` (validada por el Server Component contra `?tab=`) y
 * `sincronizarUrl` activan ese comportamiento sin useSearchParams/Suspense —
 * alcanza con leer el searchParam en el servidor y, en cada clic, reescribir
 * la URL con `history.replaceState`. Por defecto ambos quedan apagados, así
 * que `/admin/alumnos/[id]` sigue exactamente igual que antes.
 */
export function FichaAlumnoTabs({
  secciones,
  pestanaInicial,
  sincronizarUrl = false,
}: {
  secciones: Record<IdPestanaFicha, ReactNode>;
  pestanaInicial?: IdPestanaFicha;
  sincronizarUrl?: boolean;
}) {
  const [activa, setActiva] = useState<IdPestanaFicha>(pestanaInicial ?? "resumen");
  // Un link como "Indicación" navega a la misma ruta con otro `?tab=`
  // (mismo alumno): Next.js reutiliza esta instancia del componente en vez
  // de remontarla, así que el valor inicial de `useState` no vuelve a
  // leerse. Patrón oficial de React para "ajustar estado cuando cambia un
  // prop" (no un efecto, para no disparar renders en cascada): comparar
  // contra el último `pestanaInicial` visto y resetear durante el render.
  const [pestanaPrevia, setPestanaPrevia] = useState(pestanaInicial);
  if (pestanaInicial !== pestanaPrevia) {
    setPestanaPrevia(pestanaInicial);
    setActiva(pestanaInicial ?? "resumen");
  }

  function elegir(id: IdPestanaFicha) {
    setActiva(id);
    if (sincronizarUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url);
    }
  }

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
              onClick={() => elegir(id)}
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
