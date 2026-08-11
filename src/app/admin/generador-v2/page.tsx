import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FlaskConical, WandSparkles } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entrevistaDesdePerfilActual } from "@/lib/generador-rutinas-v2/entrevista";
import type { PerfilActualParaV2 } from "@/lib/generador-rutinas-v2/tipos";
import type { EjercicioConstructorV2 } from "@/lib/generador-rutinas-v2/constructor-semanal";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { patronMovimiento } from "@/lib/rutinas/patrones";
import { GeneradorRutinasV2Panel, type AlumnoGeneradorV2 } from "@/components/admin/GeneradorRutinasV2Panel";

type PerfilEntrenamientoActual = {
  alumno_id: string;
  objetivo_principal: string | null;
  objetivo_secundario: string | null;
  dias_disponibles: number | null;
  minutos_sesion: number | null;
  experiencia: string | null;
  preferencia_equipo: string | null;
  actividades_adicionales: string | null;
  ejercicios_preferidos: string | null;
  ejercicios_no_deseados: string | null;
  molestias: string | null;
  lesiones_diagnosticadas: string | null;
  operaciones_previas: string | null;
  condiciones_medicas: string | null;
  medicamentos_relevantes: string | null;
  autorizacion_medica: boolean;
  categoria_competencia: string | null;
};

type MetaEjercicioV2 = {
  id: string;
  impacto: EjercicioConstructorV2["impacto"];
  requiere_salto: boolean;
  complejidad: EjercicioConstructorV2["complejidad"];
  requiere_supervision: boolean;
  posicion_sesion: EjercicioConstructorV2["posicionSesion"];
  etiquetas_precaucion: string[] | null;
};

export default async function GeneradorV2Page() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filas }, { data: perfiles }, bibliotecaBase, { data: metadatos }] = await Promise.all([
    db.from("alumno_perfil").select("user_id, fecha_nacimiento, sexo, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    db.from("perfiles_entrenamiento").select("alumno_id, objetivo_principal, objetivo_secundario, dias_disponibles, minutos_sesion, experiencia, preferencia_equipo, actividades_adicionales, ejercicios_preferidos, ejercicios_no_deseados, molestias, lesiones_diagnosticadas, operaciones_previas, condiciones_medicas, medicamentos_relevantes, autorizacion_medica, categoria_competencia"),
    obtenerBiblioteca(),
    db.from("ejercicios").select("id, impacto, requiere_salto, complejidad, requiere_supervision, posicion_sesion, etiquetas_precaucion").eq("activo", true),
  ]);

  const metaPorId = new Map(((metadatos ?? []) as MetaEjercicioV2[]).map((meta) => [meta.id, meta]));
  const catalogo: EjercicioConstructorV2[] = bibliotecaBase.map((ejercicio) => {
    const meta = metaPorId.get(ejercicio.id);
    return {
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      aliases: ejercicio.aliases,
      grupoMuscular: ejercicio.grupoMuscular,
      categoria: ejercicio.categoria,
      equipo: ejercicio.equipo,
      nivel: ejercicio.nivel,
      patron: ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular),
      impacto: meta?.impacto ?? "bajo",
      requiereSalto: meta?.requiere_salto ?? false,
      complejidad: meta?.complejidad ?? "media",
      requiereSupervision: meta?.requiere_supervision ?? false,
      posicionSesion: meta?.posicion_sesion ?? "accesorio",
      etiquetasPrecaucion: meta?.etiquetas_precaucion ?? [],
    };
  });

  const perfilPorAlumno = new Map(((perfiles ?? []) as PerfilEntrenamientoActual[]).map((perfil) => [perfil.alumno_id, perfil]));
  const alumnos: AlumnoGeneradorV2[] = (filas ?? []).map((fila) => {
    const perfil = perfilPorAlumno.get(fila.user_id);
    const relacion = fila.perfiles as unknown as { nombre: string } | null;
    const actual: PerfilActualParaV2 = {
      alumnoId: fila.user_id,
      fechaNacimiento: fila.fecha_nacimiento ?? null,
      sexo: fila.sexo ?? null,
      objetivoPrincipal: perfil?.objetivo_principal ?? null,
      objetivoSecundario: perfil?.objetivo_secundario ?? null,
      diasDisponibles: perfil?.dias_disponibles ?? null,
      minutosSesion: perfil?.minutos_sesion ?? null,
      experiencia: perfil?.experiencia ?? null,
      preferenciaEquipo: perfil?.preferencia_equipo ?? null,
      actividadesAdicionales: perfil?.actividades_adicionales ?? null,
      ejerciciosPreferidos: perfil?.ejercicios_preferidos ?? null,
      ejerciciosNoDeseados: perfil?.ejercicios_no_deseados ?? null,
      molestias: perfil?.molestias ?? null,
      lesionesDiagnosticadas: perfil?.lesiones_diagnosticadas ?? null,
      operacionesPrevias: perfil?.operaciones_previas ?? null,
      condicionesMedicas: perfil?.condiciones_medicas ?? null,
      medicamentosRelevantes: perfil?.medicamentos_relevantes ?? null,
      autorizacionMedica: perfil?.autorizacion_medica ?? false,
      categoriaCompetencia: perfil?.categoria_competencia ?? null,
    };
    return {
      id: fila.user_id,
      nombre: relacion?.nombre ?? "Alumno",
      perfilCompleto: Boolean(perfil),
      entrevistaInicial: entrevistaDesdePerfilActual(actual),
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="space-y-4 pb-8">
      <header className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-vip">Método VIP · laboratorio</p>
          <h1 className="mt-1 text-xl font-bold text-text">Generador de rutinas 2.0</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">Entiende a la persona, calcula la dosis, construye la semana y publica una versión reversible solo después de la aprobación profesional.</p>
        </div>
        <nav className="inline-flex rounded-xl border border-border bg-surface p-1" aria-label="Versiones del generador">
          <Link href="/admin/generador" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text"><WandSparkles size={16} /> Actual</Link>
          <span aria-current="page" className="flex items-center gap-2 rounded-lg bg-vip px-3 py-2 text-sm font-bold text-white"><FlaskConical size={16} /> Generador 2.0</span>
        </nav>
      </header>
      <GeneradorRutinasV2Panel alumnos={alumnos} catalogo={catalogo} />
    </div>
  );
}
