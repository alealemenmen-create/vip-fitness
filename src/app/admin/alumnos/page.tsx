import { AlertTriangle, Star, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { CrearAlumnoForm } from "@/components/admin/CrearAlumnoForm";
import { InvitarEntrenadorForm } from "@/components/admin/InvitarEntrenadorForm";
import { ListaAlumnos } from "@/components/admin/ListaAlumnos";
import { ListaEntrenadores } from "@/components/admin/ListaEntrenadores";
import { AvisosNotasIA } from "@/components/admin/AvisosNotasIA";
import { obtenerReportes, obtenerAvisosNotasIA, type EstadoAlumno } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function AlumnosPage() {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  // Cualquier entrenador ve a todos los alumnos (equipo de confianza, sin
  // asignación exclusiva) — ver migración 0005_entrenador_acceso_total.sql.
  const { data: alumnosData } = await supabase
    .from("alumno_perfil")
    .select("user_id, objetivo, perfiles!alumno_perfil_user_id_fkey(nombre, rol)");

  // Se incluye al propio entrenador si activó su perfil de alumno dual —
  // necesita poder entrar a su propia ficha para subirse rutina/alimentación.
  const alumnos = (alumnosData ?? [])
    .filter((a) => {
      const rol = (a.perfiles as unknown as { rol: string } | null)?.rol;
      return rol === "alumno" || a.user_id === sesion.userId;
    })
    .map((a) => ({
      id: a.user_id,
      nombre: nombreAlumnoPublicado(
        (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"
      ),
      objetivo: a.objetivo,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  // La lista de entrenadores no depende de los reportes: iba suelta después
  // del Promise.all y sumaba una espera de red entera a cada carga del panel.
  const [reportes, avisosNotasIA, { data: entrenadoresData }] = await Promise.all([
    obtenerReportes(supabase, alumnos),
    obtenerAvisosNotasIA(supabase),
    supabase
      .from("perfiles")
      .select("id, nombre")
      .eq("rol", "entrenador")
      .order("nombre", { ascending: true }),
  ]);
  const entrenadores = entrenadoresData ?? [];

  // Los que necesitan atención primero: es lo que el entrenador tiene que ver
  // al entrar, sin buscar entre toda la lista.
  const ORDEN: Record<EstadoAlumno, number> = { atencion: 0, normal: 1, destacado: 2 };
  reportes.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);

  const aRevisar = reportes.filter((r) => r.estado === "atencion").length;
  const destacados = reportes.filter((r) => r.estado === "destacado").length;

  return (
    <div className="space-y-4">
      <h1 className="text-h2 text-text">Alumnos</h1>

      {reportes.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Resumen
              icono={<Users size={16} />}
              valor={reportes.length}
              etiqueta="en total"
              color="var(--color-text)"
            />
            <Resumen
              icono={<AlertTriangle size={16} />}
              valor={aRevisar}
              etiqueta="para revisar"
              color={aRevisar > 0 ? "var(--color-error)" : "var(--color-text-tertiary)"}
            />
            <Resumen
              icono={<Star size={16} />}
              valor={destacados}
              etiqueta="para felicitar"
              color={destacados > 0 ? "var(--color-vip)" : "var(--color-text-tertiary)"}
            />
          </div>
        </Card>
      )}

      <CrearAlumnoForm />

      <AvisosNotasIA avisos={avisosNotasIA} />

      <ListaAlumnos reportes={reportes} sesionUserId={sesion.userId} />

      <div className="pt-2 space-y-4">
        <ListaEntrenadores entrenadores={entrenadores} sesionUserId={sesion.userId} />
        <InvitarEntrenadorForm />
      </div>
    </div>
  );
}

function Resumen({
  icono,
  valor,
  etiqueta,
  color,
}: {
  icono: React.ReactNode;
  valor: number;
  etiqueta: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5" style={{ color }}>
        {icono}
        <span className="text-h3">{valor}</span>
      </div>
      <p className="text-caption mt-0.5 text-text-tertiary">{etiqueta}</p>
    </div>
  );
}
