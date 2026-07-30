import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { hoyISO } from "@/lib/date";
import { obtenerCalendarioMes, obtenerPlanAlimentacion, type EstadoDia } from "./data";
import { obtenerResumenAlimentacionHoy } from "@/app/alumno/inicio/data";
import { MetaCaloricaDetalle } from "@/components/student/MetaCalorica";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

function sumarMeses(anioMes: string, delta: number): string {
  const [anio, mes] = anioMes.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function nombreMes(anioMes: string): string {
  const [anio, mes] = anioMes.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, 1);
  const texto = fecha.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const COLOR_ESTADO: Record<EstadoDia, string> = {
  vacio: "transparent",
  parcial: "var(--color-vip)",
  completo: "var(--color-text-secondary)",
};

export default async function ComerPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const hoy = hoyISO();
  const anioMes = mes || hoy.slice(0, 7);

  const { alumnoId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [estados, plan, resumenHoy] = await Promise.all([
    obtenerCalendarioMes(supabase, alumnoId, anioMes),
    obtenerPlanAlimentacion(supabase, alumnoId),
    obtenerResumenAlimentacionHoy(supabase, alumnoId),
  ]);
  // El nombre ya viene de requireAlumno(); no hace falta volver a `perfiles`.
  const frase = fraseDelDia("comer", nombreAlumnoPublicado(nombre).split(" ")[0] ?? "");

  const [anio, mesNum] = anioMes.split("-").map(Number);
  const diasEnMes = new Date(anio, mesNum, 0).getDate();
  const primerDiaSemana = (new Date(anio, mesNum - 1, 1).getDay() + 6) % 7; // 0 = lunes

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-h2 text-text">Alimentación <span className="text-vip">VIP</span></h1>

      <MensajeMotivacional frase={frase} />

      {plan && (
        <Card className="efecto-3d">
          <p className="text-caption mb-3 text-text-tertiary">TU META DE HOY</p>
          <MetaCaloricaDetalle plan={plan} kcalConsumidas={resumenHoy.kcal} />
        </Card>
      )}

      <Card className="border border-border p-4 shadow-[0_18px_45px_-36px_rgba(0,0,0,0.8)]">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href={`/alumno/comer?mes=${sumarMeses(anioMes, -1)}`}
            aria-label="Mes anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:text-text"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="text-center">
            <p className="text-caption flex items-center justify-center gap-1.5 text-text-tertiary">
              <CalendarDays size={13} /> CALENDARIO
            </p>
            <p className="text-body mt-0.5 font-semibold text-text">{nombreMes(anioMes)}</p>
          </div>
          <Link
            href={`/alumno/comer?mes=${sumarMeses(anioMes, 1)}`}
            aria-label="Mes siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors hover:text-text"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <p key={i} className="pb-1 text-[10px] font-semibold text-text-tertiary">
              {d}
            </p>
          ))}
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={i} className="aspect-square" />;
            const fecha = `${anioMes}-${String(dia).padStart(2, "0")}`;
            const estado = estados[fecha] ?? "vacio";
            const esHoy = fecha === hoy;
            return (
              <Link
                key={i}
                href={`/alumno/comer/${fecha}`}
                aria-label={`${dia} de ${nombreMes(anioMes)}${esHoy ? ", hoy" : ""}`}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-colors"
                style={{
                  background: esHoy
                    ? "color-mix(in srgb, var(--color-vip) 8%, var(--color-surface-2))"
                    : estado !== "vacio"
                      ? "color-mix(in srgb, var(--color-text) 3%, transparent)"
                      : "transparent",
                  borderColor: esHoy
                    ? "color-mix(in srgb, var(--color-vip) 28%, var(--color-border))"
                    : "transparent",
                }}
              >
                <span
                  className={`text-secondary leading-none ${
                    esHoy ? "font-semibold text-text" : "text-text-secondary"
                  }`}
                >
                  {dia}
                </span>
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{
                    background: COLOR_ESTADO[estado],
                  }}
                />
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-5 border-t border-border pt-3">
          <span className="text-[10px] flex items-center gap-1.5 text-text-tertiary">
            <span className="h-0.5 w-3 rounded-full bg-vip" /> Parcial
          </span>
          <span className="text-[10px] flex items-center gap-1.5 text-text-tertiary">
            <span className="h-0.5 w-3 rounded-full bg-text-secondary" /> Completo
          </span>
        </div>
      </Card>

      <Link
        href={`/alumno/comer/${hoy}`}
        className="btn-accion radius-control flex h-16 w-full items-center justify-center text-body font-semibold"
      >
        {soloLectura ? "Ver comidas de hoy" : "Registrar comidas de hoy"}
      </Link>
    </div>
  );
}
