import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AbandonarSesionBoton } from "@/components/student/AbandonarSesionBoton";
import { obtenerHistorialSesiones } from "../data";

const ESTADO_LABEL: Record<string, { texto: string; tone: "success" | "error" | "neutral" }> = {
  completada: { texto: "Completada", tone: "success" },
  finalizada_incompleta: { texto: "Incompleta", tone: "error" },
  abandonada: { texto: "Abandonada", tone: "neutral" },
};

export default async function HistorialPage() {
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();

  const sesiones = await obtenerHistorialSesiones(supabase, alumnoId);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/entrenar" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        {/* No es <h1>: el título de la pantalla ahora lo pone el encabezado
            ("Entrenamiento VIP"), y dos h1 en la misma página confunden a los
            lectores de pantalla. Esto funciona como migaja de vuelta. */}
        <span className="text-h3 text-text">Historial de entrenamiento</span>
      </Link>

      {sesiones.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Todavía no tienes entrenamientos finalizados.</p>
        </Card>
      )}

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
              {/* Abandonar es para sesiones cerradas que todavía no lo están:
                  una ya "abandonada" no tiene nada más que hacerle acá. */}
              {s.estado !== "abandonada" && <AbandonarSesionBoton sesionId={s.id} />}
              <Link href={`/alumno/entrenar/sesion/${s.id}`}>
                <ChevronRight size={18} className="text-text-tertiary" />
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
