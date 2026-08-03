import Image from "next/image";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import { GrupoMuscularIcon, ETIQUETAS_GRUPO_MUSCULAR, FONDO_FOTO_GRUPO } from "./GrupoMuscularIcon";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/**
 * La imagen que acompaña a cada ejercicio.
 *
 * Muestra la ilustración del movimiento (una persona ejecutándolo) cuando el
 * ejercicio está emparejado con la biblioteca y el dibujo existe. Mientras el
 * set de ilustraciones no esté completo, cae a la foto del grupo muscular, que
 * es lo que la app mostraba antes — así la funcionalidad puede publicarse sin
 * esperar al arte. Ver src/lib/ejercicios/ilustracion.ts.
 */
export function IlustracionEjercicio({
  ilustracionSlug,
  grupoMuscular,
  nombre,
  tamano = 48,
  className = "",
}: {
  ilustracionSlug: string | null;
  grupoMuscular: GrupoMuscular | null;
  /** Nombre del ejercicio, para el texto alternativo. */
  nombre: string;
  tamano?: number;
  className?: string;
}) {
  const { src, origen } = resolverIlustracion(ilustracionSlug, grupoMuscular);

  if (!src) {
    if (!grupoMuscular) return null;
    return <GrupoMuscularIcon grupo={grupoMuscular} alto={tamano} />;
  }

  const esIlustracion = origen === "ilustracion";

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${
        esIlustracion ? "radius-control bg-surface-2" : "rounded-full"
      } ${className}`}
      style={{
        width: tamano,
        height: tamano,
        ...(esIlustracion ? {} : { background: FONDO_FOTO_GRUPO }),
      }}
    >
      {/* La foto del modelo también va con `object-contain` — el cuerpo
          entero dentro del círculo negro, como en la tarjeta del día en
          Entrenar, no un recorte cerrado a un músculo. Ver el porqué del
          fondo negro en FONDO_FOTO_GRUPO (GrupoMuscularIcon). */}
      <Image
        src={src}
        alt={
          esIlustracion
            ? `Ilustración de ${nombre}`
            : grupoMuscular
              ? ETIQUETAS_GRUPO_MUSCULAR[grupoMuscular]
              : nombre
        }
        fill
        sizes={`${tamano}px`}
        className={`object-contain ${esIlustracion ? "p-1" : ""}`}
      />
    </div>
  );
}
