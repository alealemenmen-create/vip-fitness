import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const VENTANA_DEDUP_HORAS = 2;
const VENTANA_DEDUP_MS = VENTANA_DEDUP_HORAS * 60 * 60 * 1000;
/** Bajo este umbral se considera que el alumno está en el gimnasio ahora
 * mismo (mismo criterio que la deduplicación: dentro de esa ventana, todo
 * uso de la app es "la misma visita"). */
const ACTIVO_AHORA_MS = VENTANA_DEDUP_MS;

/**
 * Deja constancia de que el alumno usó la app — pero no una fila por cada
 * carga de pantalla: si ya hay un ingreso registrado hace menos de 2 horas,
 * no inserta nada. Así, un alumno entrenando en el gimnasio (que abre la app
 * a cada rato) deja UNA sola huella por visita, y recién cuenta como
 * "volvió a entrar" si pasaron 2+ horas desde la última vez.
 *
 * El fallo nunca debe interrumpir el uso de la app: quien llama a esto
 * (el layout de /alumno) atrapa cualquier error.
 */
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

  if (ultimo) {
    const transcurrido = Date.now() - new Date(ultimo.ingreso_en).getTime();
    if (transcurrido < VENTANA_DEDUP_MS) return;
  }

  const { error } = await admin.from("alumno_accesos").insert({ alumno_id: alumnoId });
  if (error) throw new Error(`No fue posible registrar el ingreso: ${error.message}`);
}

export type EstadoIngresoAlumno = "activo_ahora" | "hoy" | "esta_semana" | "inactivo" | "nunca";

export type ResumenIngresoAlumno = {
  alumnoId: string;
  nombre: string;
  totalIngresos: number;
  ultimoIngreso: string | null;
  estado: EstadoIngresoAlumno;
};

export type IngresoDetalle = {
  id: string;
  alumnoId: string;
  nombre: string;
  ingresoEn: string;
};

export type RangoIngresos = "semana" | "mes";

function calcularEstado(ultimoIngreso: string | null): EstadoIngresoAlumno {
  if (!ultimoIngreso) return "nunca";
  const transcurridoMs = Date.now() - new Date(ultimoIngreso).getTime();
  if (transcurridoMs < ACTIVO_AHORA_MS) return "activo_ahora";
  if (transcurridoMs < 24 * 60 * 60 * 1000) return "hoy";
  if (transcurridoMs < 7 * 24 * 60 * 60 * 1000) return "esta_semana";
  return "inactivo";
}

/**
 * Ingresos a la app para el panel del entrenador: un resumen por alumno
 * (cuántas veces entró en el rango, cuándo fue la última, y si está activo
 * ahora mismo) más el detalle crudo del rango para la lista cronológica.
 *
 * Se calcula sobre TODOS los alumnos (incluso los que no entraron nunca en
 * el rango, con totalIngresos 0) para que "quién no está usando la app" sea
 * tan visible como "quién sí".
 */
/** Ventana fija para "último ingreso" / estado: más ancha que semana o mes
 * para que un alumno que no entra hace 6 semanas siga marcado "inactivo" en
 * vez de "nunca" solo porque el rango elegido es más chico. */
const DIAS_VENTANA_ESTADO = 90;

export async function obtenerIngresos(rango: RangoIngresos): Promise<{
  resumen: ResumenIngresoAlumno[];
  detalle: IngresoDetalle[];
}> {
  const admin = createAdminClient();
  const desdeEstado = new Date(Date.now() - DIAS_VENTANA_ESTADO * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: alumnosData, error: errorAlumnos }, { data: accesosData, error: errorAccesos }] =
    await Promise.all([
      admin
        .from("alumno_perfil")
        .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre, rol)"),
      admin
        .from("alumno_accesos")
        .select("id, alumno_id, ingreso_en")
        .gte("ingreso_en", desdeEstado)
        .order("ingreso_en", { ascending: false }),
    ]);
  if (errorAlumnos) throw new Error(`No fue posible leer los alumnos: ${errorAlumnos.message}`);
  if (errorAccesos) throw new Error(`No fue posible leer los ingresos: ${errorAccesos.message}`);

  const nombrePorAlumno = new Map(
    (alumnosData ?? [])
      .filter((a) => (a.perfiles as unknown as { rol: string } | null)?.rol === "alumno")
      .map((a) => [
        a.user_id,
        nombreAlumnoPublicado((a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"),
      ])
  );

  const accesos = (accesosData ?? []).filter((a) => nombrePorAlumno.has(a.alumno_id));

  const dias = rango === "semana" ? 7 : 30;
  const desdeRango = Date.now() - dias * 24 * 60 * 60 * 1000;
  const detalle: IngresoDetalle[] = accesos
    .filter((a) => new Date(a.ingreso_en).getTime() >= desdeRango)
    .map((a) => ({
      id: a.id,
      alumnoId: a.alumno_id,
      nombre: nombrePorAlumno.get(a.alumno_id)!,
      ingresoEn: a.ingreso_en,
    }));

  const totalPorAlumno = new Map<string, number>();
  for (const a of detalle) {
    totalPorAlumno.set(a.alumnoId, (totalPorAlumno.get(a.alumnoId) ?? 0) + 1);
  }

  // `accesos` (ventana de 90 días) ya viene ordenado de más reciente a más
  // antiguo: el primero que aparece por alumno es su último ingreso real,
  // sin importar si cae dentro del rango semana/mes elegido para el conteo.
  const ultimoPorAlumno = new Map<string, string>();
  for (const a of accesos) {
    if (!ultimoPorAlumno.has(a.alumno_id)) ultimoPorAlumno.set(a.alumno_id, a.ingreso_en);
  }

  const resumen: ResumenIngresoAlumno[] = [...nombrePorAlumno.entries()]
    .map(([alumnoId, nombre]) => {
      const ultimoIngreso = ultimoPorAlumno.get(alumnoId) ?? null;
      return {
        alumnoId,
        nombre,
        totalIngresos: totalPorAlumno.get(alumnoId) ?? 0,
        ultimoIngreso,
        estado: calcularEstado(ultimoIngreso),
      };
    })
    .sort((a, b) => {
      const fechaA = a.ultimoIngreso ? new Date(a.ultimoIngreso).getTime() : -Infinity;
      const fechaB = b.ultimoIngreso ? new Date(b.ultimoIngreso).getTime() : -Infinity;
      return fechaB - fechaA;
    });

  return { resumen, detalle };
}
