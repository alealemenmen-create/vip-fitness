import Image from "next/image";
import { ETIQUETAS_GRUPO_MUSCULAR, GrupoMuscularIcon } from "./GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import type { ConstanciaSemana, EstadoDiaResumen } from "@/app/alumno/inicio/data";

/** Puntitos de la semana real (L M X J V S D): verde el día entrenado,
 * morado el de hoy, hueco los demás. */
function PuntosSemana({ dias }: { dias: ConstanciaSemana["dias"] }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {dias.map((d) => {
        const color = d.entreno
          ? "var(--color-success)"
          : d.esHoy
            ? "var(--color-vip)"
            : "transparent";
        return (
          <div key={d.fecha} className="flex flex-1 flex-col items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: color,
                border: color === "transparent" ? "1px solid var(--color-border)" : "none",
              }}
            />
            <span
              className={`text-caption leading-none ${
                d.esHoy ? "font-semibold text-text" : "text-text-tertiary"
              }`}
            >
              {d.letra}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Versión compacta de "Tu semana de entrenamiento" para Inicio: el día de
 * hoy con su músculo y su avance, los puntitos de constancia de la semana, y
 * nada más — el detalle completo vive en Entrenar. */
export function ResumenSemanaCompacto({
  diaHoy,
  nombreDia,
  numeroDia,
  constancia,
}: {
  diaHoy: EstadoDiaResumen;
  nombreDia: string;
  numeroDia: number;
  constancia: ConstanciaSemana;
}) {
  const descanso = diaHoy.tipo === "descanso";
  const titulo = descanso
    ? "DESCANSO"
    : (diaHoy.grupo ? ETIQUETAS_GRUPO_MUSCULAR[diaHoy.grupo] : diaHoy.nombre).toUpperCase();
  const fotos = diaHoy.grupo ? FOTOS_GRUPO_MUSCULAR[diaHoy.grupo] : undefined;

  return (
    <div className="space-y-3">
      {/* El modelo entero, centrado y grande — mismo tratamiento que la
          tarjeta del día en Entrenar (object-contain, sin recortar), pero acá
          de cuerpo entero y centrado en vez de ir a un costado: es el único
          elemento de esta tarjeta compacta, así que puede ser el protagonista
          en vez de competir con el título por espacio. Ya no va en el círculo
          negro (FotoGrupoMuscular) — a este tamaño el círculo recortaba al
          modelo por los costados en vez de mostrarlo completo. */}
      {!descanso && diaHoy.grupo && (
        <div className="relative mx-auto h-48 w-full">
          {fotos ? (
            <Image
              src={fotos[0]}
              alt={ETIQUETAS_GRUPO_MUSCULAR[diaHoy.grupo]}
              fill
              sizes="400px"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <GrupoMuscularIcon grupo={diaHoy.grupo} alto={128} />
            </div>
          )}
        </div>
      )}

      <div className="min-w-0 text-center">
        <p className="text-caption text-text-tertiary">
          {nombreDia} · Día {numeroDia}
        </p>
        <h2 className="text-h3 mt-0.5 truncate text-text">{titulo}</h2>
        <p className="text-secondary text-text-secondary">
          {descanso ? "Día de recuperación" : `${diaHoy.completados} / ${diaHoy.total} ejercicios`}
        </p>
      </div>

      <div className="border-t border-border pt-3">
        <PuntosSemana dias={constancia.dias} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-h3 text-vip">{constancia.pct}%</span>
        <span className="text-caption text-text-tertiary">
          Constancia semanal · {constancia.entrenados} de {constancia.objetivo}
        </span>
      </div>
    </div>
  );
}
