import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { ZONA_HORARIA_VIP } from "@/lib/date";
import { calcularHorarioHabitual, type ConfianzaHorario } from "./horario";

const VENTANA_ACCESO_MS = 2 * 60 * 60 * 1000;
const VENTANA_EVENTO_MS = {
  alimentacion_vista: 30 * 60 * 1000,
  alimentacion_cambio: 10 * 60 * 1000,
} as const;
const VENTANA_GIMNASIO_MS = 4 * 60 * 60 * 1000;
const DIAS_VENTANA_ESTADO = 90;

export type TipoActividadAlumno =
  | "app"
  | "alimentacion_vista"
  | "alimentacion_cambio"
  | "entrenamiento_iniciado";

export async function registrarAccesoApp(alumnoId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: ultimo, error: errorUltimo } = await admin
    .from("alumno_accesos")
    .select("ingreso_en")
    .eq("alumno_id", alumnoId)
    .order("ingreso_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorUltimo) throw new Error(`No fue posible leer el último ingreso: ${errorUltimo.message}`);
  if (ultimo && Date.now() - new Date(ultimo.ingreso_en).getTime() < VENTANA_ACCESO_MS) return;
  const { error } = await admin.from("alumno_accesos").insert({ alumno_id: alumnoId });
  if (error) throw new Error(`No fue posible registrar el ingreso: ${error.message}`);
}

/** Registra contexto útil sin convertir cada clic en una fila. */
export async function registrarActividadAlumno(
  alumnoId: string,
  tipo: "alimentacion_vista" | "alimentacion_cambio",
  metadata: Record<string, string | number | boolean | null> = {}
): Promise<void> {
  const admin = createAdminClient();
  const { data: ultimo, error: errorUltimo } = await admin
    .from("actividad_alumno_eventos")
    .select("ocurrido_en")
    .eq("alumno_id", alumnoId)
    .eq("tipo", tipo)
    .order("ocurrido_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorUltimo) throw new Error(`No fue posible leer la actividad: ${errorUltimo.message}`);
  if (ultimo && Date.now() - new Date(ultimo.ocurrido_en).getTime() < VENTANA_EVENTO_MS[tipo]) return;
  const { error } = await admin.from("actividad_alumno_eventos").insert({ alumno_id: alumnoId, tipo, metadata });
  if (error) throw new Error(`No fue posible registrar la actividad: ${error.message}`);
}

export type EstadoIngresoAlumno = "en_gimnasio" | "hoy" | "esta_semana" | "inactivo" | "nunca";
export type ResumenIngresoAlumno = {
  alumnoId: string;
  nombre: string;
  totalIngresos: number;
  ultimoIngreso: string | null;
  estado: EstadoIngresoAlumno;
  horaHabitual: string | null;
  confianzaHorario: ConfianzaHorario | null;
  entrenamientosAnalizados: number;
};

export type IngresoDetalle = {
  id: string;
  alumnoId: string;
  nombre: string;
  ingresoEn: string;
  fechaLocal: string;
  tipo: TipoActividadAlumno;
};

export type RangoIngresos = "semana" | "mes";

function estadoDesdeActividad(ultimoIngreso: string | null, enGimnasio: boolean): EstadoIngresoAlumno {
  if (enGimnasio) return "en_gimnasio";
  if (!ultimoIngreso) return "nunca";
  const transcurrido = Date.now() - new Date(ultimoIngreso).getTime();
  if (transcurrido < 24 * 60 * 60 * 1000) return "hoy";
  if (transcurrido < 7 * 24 * 60 * 60 * 1000) return "esta_semana";
  return "inactivo";
}

export async function obtenerIngresos(rango: RangoIngresos): Promise<{
  resumen: ResumenIngresoAlumno[];
  detalle: IngresoDetalle[];
}> {
  const admin = createAdminClient();
  const desdeEstado = new Date(Date.now() - DIAS_VENTANA_ESTADO * 86400000).toISOString();
  const [alumnosResp, accesosResp, eventosResp, sesionesResp] = await Promise.all([
    admin.from("alumno_perfil").select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre, rol)"),
    admin.from("alumno_accesos").select("id, alumno_id, ingreso_en").gte("ingreso_en", desdeEstado).order("ingreso_en", { ascending: false }),
    admin.from("actividad_alumno_eventos").select("id, alumno_id, tipo, ocurrido_en").gte("ocurrido_en", desdeEstado).order("ocurrido_en", { ascending: false }),
    admin.from("sesiones_entrenamiento").select("id, alumno_id, rutina_iniciada_en, hora_fin, estado").not("rutina_iniciada_en", "is", null).gte("rutina_iniciada_en", desdeEstado).order("rutina_iniciada_en", { ascending: false }),
  ]);
  if (alumnosResp.error) throw new Error(`No fue posible leer los alumnos: ${alumnosResp.error.message}`);
  if (accesosResp.error) throw new Error(`No fue posible leer los ingresos: ${accesosResp.error.message}`);
  if (eventosResp.error) throw new Error(`No fue posible leer la actividad: ${eventosResp.error.message}`);
  if (sesionesResp.error) throw new Error(`No fue posible leer entrenamientos: ${sesionesResp.error.message}`);

  const nombres = new Map(
    (alumnosResp.data ?? [])
      .filter((a) => (a.perfiles as unknown as { rol: string } | null)?.rol === "alumno")
      .map((a) => [a.user_id, nombreAlumnoPublicado((a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno")])
  );
  const accesos = (accesosResp.data ?? []).filter((a) => nombres.has(a.alumno_id));
  const eventos = (eventosResp.data ?? []).filter((e) => nombres.has(e.alumno_id));
  const sesiones = (sesionesResp.data ?? []).filter((s) => nombres.has(s.alumno_id) && s.rutina_iniciada_en);
  const desdeRango = Date.now() - (rango === "semana" ? 7 : 30) * 86400000;

  const detalle: IngresoDetalle[] = [
    ...accesos.map((a) => ({ id: `app-${a.id}`, alumnoId: a.alumno_id, ingresoEn: a.ingreso_en, tipo: "app" as const })),
    ...eventos.map((e) => ({ id: `evento-${e.id}`, alumnoId: e.alumno_id, ingresoEn: e.ocurrido_en, tipo: e.tipo as "alimentacion_vista" | "alimentacion_cambio" })),
    ...sesiones.map((s) => ({ id: `sesion-${s.id}`, alumnoId: s.alumno_id, ingresoEn: s.rutina_iniciada_en!, tipo: "entrenamiento_iniciado" as const })),
  ]
    .filter((a) => new Date(a.ingresoEn).getTime() >= desdeRango)
    .sort((a, b) => new Date(b.ingresoEn).getTime() - new Date(a.ingresoEn).getTime())
    .map((a) => ({ ...a, nombre: nombres.get(a.alumnoId)!, fechaLocal: formatInTimeZone(a.ingresoEn, ZONA_HORARIA_VIP, "yyyy-MM-dd") }));

  const ingresosEnRango = new Map<string, number>();
  for (const a of accesos) if (new Date(a.ingreso_en).getTime() >= desdeRango) ingresosEnRango.set(a.alumno_id, (ingresosEnRango.get(a.alumno_id) ?? 0) + 1);
  const ultimoAcceso = new Map<string, string>();
  for (const a of accesos) if (!ultimoAcceso.has(a.alumno_id)) ultimoAcceso.set(a.alumno_id, a.ingreso_en);
  const iniciosPorAlumno = new Map<string, string[]>();
  for (const s of sesiones) iniciosPorAlumno.set(s.alumno_id, [...(iniciosPorAlumno.get(s.alumno_id) ?? []), s.rutina_iniciada_en!]);
  const gimnasioAhora = new Set(
    sesiones
      .filter((s) => s.estado === "en_progreso" && !s.hora_fin && Date.now() - new Date(s.rutina_iniciada_en!).getTime() < VENTANA_GIMNASIO_MS)
      .map((s) => s.alumno_id)
  );

  const resumen = [...nombres.entries()].map(([alumnoId, nombre]) => {
    const ultimoIngreso = ultimoAcceso.get(alumnoId) ?? null;
    const horario = calcularHorarioHabitual(iniciosPorAlumno.get(alumnoId) ?? []);
    return {
      alumnoId,
      nombre,
      totalIngresos: ingresosEnRango.get(alumnoId) ?? 0,
      ultimoIngreso,
      estado: estadoDesdeActividad(ultimoIngreso, gimnasioAhora.has(alumnoId)),
      horaHabitual: horario.hora,
      confianzaHorario: horario.confianza,
      entrenamientosAnalizados: horario.muestras,
    };
  }).sort((a, b) => (b.ultimoIngreso ? new Date(b.ultimoIngreso).getTime() : -Infinity) - (a.ultimoIngreso ? new Date(a.ultimoIngreso).getTime() : -Infinity) || a.nombre.localeCompare(b.nombre, "es"));

  return { resumen, detalle };
}
