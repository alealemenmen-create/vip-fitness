import Image from "next/image";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import { GrupoMuscularIcon, ETIQUETAS_GRUPO_MUSCULAR } from "./GrupoMuscularIcon";
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

  // La ilustración es un dibujo con fondo transparente: se muestra entera
  // (`contain`) y sin recorte. La foto de grupo muscular sí se recorta, para
  // que la miniatura cuadrada no deforme a la persona.
  const esIlustracion = origen === "ilustracion";

  return (
    <div
      className={`radius-control relative shrink-0 overflow-hidden ${
        esIlustracion ? "bg-surface-2" : ""
      } ${className}`}
      style={{ width: tamano, height: tamano }}
    >
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
        className={esIlustracion ? "object-contain p-1" : "object-cover object-top"}
      />
    </div>
  );
}
