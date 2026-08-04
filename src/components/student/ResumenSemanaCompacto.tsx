import { Moon } from "lucide-react";
import { ETIQUETAS_GRUPO_MUSCULAR, FotoDiaEntrenamiento } from "./GrupoMuscularIcon";
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

  return (
    <div className="space-y-3">
      {/* Mismo tratamiento "de referencia" que la tarjeta del día en Entrenar
          (rayos de luz + foto real + insignia con resplandor): antes acá iba
          un recorte chico y plano, que quedaba gris y sin vida al lado de esa
          otra pantalla. */}
      <div className="relative -mx-5 -mt-2.5 flex min-h-[152px] flex-col justify-end overflow-hidden px-5 pb-3 pt-3">
        {descanso ? (
          <div className="pointer-events-none absolute right-4 top-3 opacity-30">
            <Moon size={64} className="text-text-tertiary" />
          </div>
        ) : (
          diaHoy.grupo && <FotoDiaEntrenamiento grupos={[diaHoy.grupo]} />
        )}

        <div className="relative min-w-0">
          <p className="text-secondary text-text-tertiary">
            {nombreDia} · Día {numeroDia}
          </p>
          <h2 className="text-h2 mt-0.5 truncate text-text">{titulo}</h2>
          <p className="text-body text-text-secondary">
            {descanso ? "Día de recuperación" : `${diaHoy.completados} / ${diaHoy.total} ejercicios`}
          </p>
        </div>
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
