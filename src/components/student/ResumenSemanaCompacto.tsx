import { Moon } from "lucide-react";
import { ETIQUETAS_GRUPO_MUSCULAR, FotoDiaEntrenamiento } from "./GrupoMuscularIcon";
import type { ConstanciaSemana, EstadoDiaResumen } from "@/app/alumno/inicio/data";

/** Puntitos de la semana real (L M X J V S D): verde el día entrenado,
 * morado el de hoy, hueco los demás. */
function PuntosSemana({ dias }: { dias: ConstanciaSemana["dias"] }) {
  return (
    <div className="flex items-center justify-between gap-0.5">
      {dias.map((d) => {
        const color = d.entreno
          ? "var(--color-success)"
          : d.esHoy
            ? "var(--color-vip)"
            : "transparent";
        return (
          <div key={d.fecha} className="flex flex-1 flex-col items-center gap-0.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: color,
                border: color === "transparent" ? "1px solid var(--color-border)" : "none",
              }}
            />
            <span
              className={`text-[8px] leading-none ${
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
    <div>
      {/* Mismo tratamiento "de referencia" que la tarjeta del día en Entrenar
          (rayos de luz + foto real + insignia con resplandor): antes acá iba
          un recorte chico y plano, que quedaba gris y sin vida al lado de esa
          otra pantalla. */}
      <div className="relative -mx-4 -mt-2 flex min-h-[106px] flex-col justify-end overflow-hidden px-4 pb-2 pt-2">
        {descanso ? (
          <div className="pointer-events-none absolute right-4 top-3 opacity-30">
            <Moon size={64} className="text-text-tertiary" />
          </div>
        ) : (
          diaHoy.grupo && <FotoDiaEntrenamiento grupos={[diaHoy.grupo]} />
        )}

        <div className="relative min-w-0">
          <p className="pl-8 text-[11px] text-text-tertiary">
            {nombreDia} · Día {numeroDia}
          </p>
          <h2 className="mt-0.5 truncate text-[22px] font-bold leading-none text-text">{titulo}</h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {descanso ? "Día de recuperación" : `${diaHoy.completados} / ${diaHoy.total} ejercicios`}
          </p>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2 border-t border-border pt-1.5">
        <div className="min-w-0 flex-1">
          <PuntosSemana dias={constancia.dias} />
        </div>
        <div className="shrink-0 border-l border-border pl-2 text-right leading-none">
          <span className="block text-[16px] font-bold text-vip">{constancia.pct}%</span>
          <span className="mt-1 block text-[7px] text-text-tertiary">
            {constancia.entrenados} de {constancia.objetivo} semanal
          </span>
        </div>
      </div>
    </div>
  );
}
