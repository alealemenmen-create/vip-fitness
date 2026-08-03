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
    <div className="space-y-1.5">
      {/* Vuelta al layout anterior: texto a la izquierda, modelo a la
          derecha — la versión centrada y grande (mx-auto, h-48) se probó y no
          convenció. Sigue sin el círculo negro (FotoGrupoMuscular): acá va el
          recorte crudo, flotando directo sobre la tarjeta oscura, con
          object-contain para no recortar al modelo por los costados.
          `-ml-3` lo corre un poco hacia la izquierda, más cerca del texto:
          con `justify-between` y dos elementos, mover el margen IZQUIERDO
          del segundo achica el hueco entre ambos y lo arrastra hacia el
          texto — un margen derecho negativo haría lo contrario, lo empujaría
          más hacia afuera. */}
      <div className="flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-secondary text-text-tertiary">
            {nombreDia} · Día {numeroDia}
          </p>
          <h2 className="text-h2 mt-0.5 truncate text-text">{titulo}</h2>
          <p className="text-body text-text-secondary">
            {descanso ? "Día de recuperación" : `${diaHoy.completados} / ${diaHoy.total} ejercicios`}
          </p>
        </div>
        {!descanso && diaHoy.grupo && (
          fotos ? (
            <div className="relative -ml-4 h-28 w-24 shrink-0">
              <Image
                src={fotos[0]}
                alt={ETIQUETAS_GRUPO_MUSCULAR[diaHoy.grupo]}
                fill
                sizes="96px"
                className="object-contain"
              />
            </div>
          ) : (
            <GrupoMuscularIcon grupo={diaHoy.grupo} alto={96} />
          )
        )}
      </div>

      <div className="border-t border-border pt-1.5">
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
