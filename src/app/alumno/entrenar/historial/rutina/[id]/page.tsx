import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AbandonarSesionBoton } from "@/components/student/AbandonarSesionBoton";
import { ReiniciarRutinaBoton } from "@/components/student/ReiniciarRutinaBoton";
import { obtenerHistorialSesiones, obtenerRutinasHistorial } from "../../../data";
import { formatFechaDiaSemana } from "@/lib/date";

const ESTADO_LABEL: Record<string, { texto: string; tone: "success" | "error" | "neutral" }> = {
  completada: { texto: "Completada", tone: "success" },
  finalizada_incompleta: { texto: "Incompleta", tone: "error" },
  abandonada: { texto: "Abandonada", tone: "neutral" },
};

/** Reporte completo de una rutina: todas las sesiones que el alumno haya
 * cerrado bajo ella, de más reciente a más antigua, más un resumen arriba
 * (rango de fechas, cuántas, Puntos VIP ganados) y la opción de reiniciarla
 * de cero — ver ReiniciarRutinaBoton. */
export default async function HistorialRutinaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rutinaId } = await params;
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [rutinas, sesiones] = await Promise.all([
    obtenerRutinasHistorial(supabase, alumnoId),
    obtenerHistorialSesiones(supabase, alumnoId, 500, rutinaId),
  ]);
  const rutina = rutinas.find((r) => r.id === rutinaId);

  if (!rutina) {
    return (
      <div className="space-y-4 pb-8">
        <Link href="/alumno/entrenar/historial" className="flex items-center gap-2">
          <ArrowLeft size={20} className="text-text-secondary" />
          <span className="text-h3 text-text">Historial</span>
        </Link>
        <Card>
          <p className="text-body text-text-secondary">No se encontró esta rutina.</p>
        </Card>
      </div>
    );
  }

  const totalEjercicios = sesiones.reduce((acc, s) => acc + s.total, 0);
  const totalCompletados = sesiones.reduce((acc, s) => acc + s.completados, 0);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/entrenar/historial" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <span className="text-h3 min-w-0 truncate text-text">{rutina.nombre}</span>
        {rutina.activa && <Pill tone="vip">Activa</Pill>}
      </Link>

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-h3 text-text">{rutina.cantidadSesiones}</p>
          <p className="text-caption text-text-tertiary">Sesiones</p>
        </div>
        <div>
          <p className="text-h3 text-text">
            {totalCompletados}/{totalEjercicios}
          </p>
          <p className="text-caption text-text-tertiary">Ejercicios</p>
        </div>
        <div>
          <p className={`text-h3 ${rutina.puntos < 0 ? "text-error" : "text-vip"}`}>
            {rutina.puntos > 0 ? "+" : ""}
            {rutina.puntos}
          </p>
          <p className="text-caption text-text-tertiary">Puntos VIP</p>
        </div>
      </Card>

      <p className="text-caption text-text-tertiary">
        {formatFechaDiaSemana(rutina.primeraFecha)} — {formatFechaDiaSemana(rutina.ultimaFecha)}
      </p>

      <div className="space-y-2">
        {sesiones.map((s) => {
          const estado = ESTADO_LABEL[s.estado];
          return (
            <Card key={s.id} className="flex items-center justify-between gap-2">
              <Link href={`/alumno/entrenar/sesion/${s.id}`} className="min-w-0 flex-1">
                <p className="text-body text-text">
                  {s.numeroCalendario ? `#${s.numeroCalendario} · ` : ""}
                  {s.diaNombre}
                </p>
                <p className="text-caption text-text-tertiary">
                  {s.fecha} · {s.total === 0 ? "Descanso" : `${s.completados}/${s.total} ejercicios`}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <Pill tone={estado.tone}>{estado.texto}</Pill>
                {s.estado !== "abandonada" && <AbandonarSesionBoton sesionId={s.id} />}
                <Link href={`/alumno/entrenar/sesion/${s.id}`}>
                  <ChevronRight size={18} className="text-text-tertiary" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {!soloLectura && (
        <div className="pt-2">
          <ReiniciarRutinaBoton rutinaId={rutina.id} cantidadSesiones={rutina.cantidadSesiones} />
        </div>
      )}
    </div>
  );
}
