import Link from "next/link";
import { ArrowLeft, ChevronRight, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { obtenerRutinasHistorial } from "../data";
import { formatFechaDiaSemana } from "@/lib/date";

/** Portada del Historial: una tarjeta por rutina que el alumno haya
 * entrenado alguna vez, con un resumen rápido — abrirla lleva al reporte
 * completo de esa rutina (todas sus sesiones, ver historial/rutina/[id]). */
export default async function HistorialPage() {
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();

  const rutinas = await obtenerRutinasHistorial(supabase, alumnoId);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/entrenar" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        {/* No es <h1>: el título de la pantalla ahora lo pone el encabezado
            ("Entrenamiento VIP"), y dos h1 en la misma página confunden a los
            lectores de pantalla. Esto funciona como migaja de vuelta. */}
        <span className="text-h3 text-text">Historial de entrenamiento</span>
      </Link>

      {rutinas.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Todavía no tienes entrenamientos finalizados.</p>
        </Card>
      )}

      {rutinas.map((r) => (
        <Link key={r.id} href={`/alumno/entrenar/historial/rutina/${r.id}`}>
          <Card className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-vip">
                <Dumbbell size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-body font-semibold text-text">{r.nombre}</p>
                  {r.activa && <Pill tone="vip">Activa</Pill>}
                </div>
                <p className="text-caption text-text-tertiary">
                  {formatFechaDiaSemana(r.primeraFecha)} — {formatFechaDiaSemana(r.ultimaFecha)} ·{" "}
                  {r.cantidadSesiones} {r.cantidadSesiones === 1 ? "sesión" : "sesiones"}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
