import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
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
          <Link key={s.id} href={`/alumno/entrenar/sesion/${s.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-body text-text">
                  {s.numeroCalendario ? `#${s.numeroCalendario} · ` : ""}
                  {s.diaNombre}
                </p>
                <p className="text-caption text-text-tertiary">
                  {s.fecha} · {s.total === 0 ? "Descanso" : `${s.completados}/${s.total} ejercicios`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={estado.tone}>{estado.texto}</Pill>
                <ChevronRight size={18} className="text-text-tertiary" />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
