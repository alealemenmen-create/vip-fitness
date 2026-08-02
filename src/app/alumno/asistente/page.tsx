import { AlertCircle, CalendarClock, Dumbbell } from "lucide-react";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerContextoAlumnoVip } from "@/lib/asistente/alumno";
import { AsistenteAlumnoPanel } from "@/components/student/AsistenteAlumnoPanel";
import { Card } from "@/components/ui/Card";

export default async function AsistenteAlumnoPage() {
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();
  const contexto = await obtenerContextoAlumnoVip(supabase, alumnoId);

  return (
    <div className="space-y-5 pb-8">
      <AsistenteAlumnoPanel />

      <section>
        <h2 className="text-caption mb-2 flex items-center gap-2 font-semibold text-text-tertiary">
          <CalendarClock size={16} className="text-vip" /> RECORDATORIOS DE HOY
        </h2>
        <Card className="!p-4">
          {contexto.recordatorios.length === 0 ? (
            <p className="text-secondary text-success">No tienes pendientes detectados hoy.</p>
          ) : (
            <div className="space-y-2">
              {contexto.recordatorios.map((recordatorio) => (
                <p key={recordatorio} className="text-secondary flex items-start gap-2 text-text-secondary">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-vip" /> {recordatorio}
                </p>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-caption mb-2 flex items-center gap-2 font-semibold text-text-tertiary">
          <Dumbbell size={16} className="text-vip" /> TUS ÚLTIMAS MARCAS
        </h2>
        <div className="space-y-2">
          {contexto.marcasRecientes.length === 0 ? (
            <Card className="!p-4"><p className="text-secondary text-text-secondary">Todavía no hay series finalizadas con peso o repeticiones.</p></Card>
          ) : contexto.marcasRecientes.slice(0, 8).map((marca, indice) => (
            <Card key={`${marca.ejercicio}-${marca.fecha}-${indice}`} className="flex items-center justify-between gap-3 !p-3">
              <div className="min-w-0">
                <p className="text-secondary truncate font-semibold text-text">{marca.ejercicio}</p>
                <p className="text-micro text-text-tertiary">{marca.grupo ?? "Grupo sin clasificar"} · {marca.fecha}</p>
              </div>
              <p className="shrink-0 text-caption font-semibold text-vip">
                {marca.pesoCorporal ? "Peso corporal" : marca.pesoKg === null ? "Sin peso" : `${marca.pesoKg} kg`} · {marca.repeticiones ?? "—"} reps
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
