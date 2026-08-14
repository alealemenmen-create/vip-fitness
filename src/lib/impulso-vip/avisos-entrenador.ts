import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, vapidListo } from "@/lib/push/enviar";
import { nombreAlumnoPublicado } from "@/lib/nombre";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Avisa a Ale por push cuando un alumno toca "Llamar a Ale · le suena el teléfono"
 * en un Momento Impulso. Antes esto solo insertaba la fila en
 * `impulso_vip_solicitudes_asistencia` — el pedido solo se veía si alguien
 * tenía el panel de Alumnos abierto y el sondeo de `AsistenciaImpulsoEnVivo`
 * lo alcanzaba a mostrar, así que un llamado en vivo podía pasar
 * desapercibido minutos enteros.
 */
export async function avisarSolicitudAsistencia(params: {
  alumnoId: string;
  sesionEjercicioId: string;
}): Promise<void> {
  if (!vapidListo()) return;
  const admin = createAdminClient();

  const { data: entrenadores } = await admin.from("perfiles").select("id").in("rol", ["entrenador", "admin"]);
  const entrenadorIds = (entrenadores ?? []).map((fila) => fila.id);
  if (entrenadorIds.length === 0) return;
  const { data: suscripciones } = await admin.from("push_suscripciones")
    .select("endpoint, p256dh, auth").in("alumno_id", entrenadorIds);
  if (!suscripciones?.length) return;

  const [{ data: ejercicio }, { data: perfil }] = await Promise.all([
    admin.from("sesion_ejercicios")
      .select("rutina_dia_ejercicios(nombre)")
      .eq("id", params.sesionEjercicioId).maybeSingle(),
    admin.from("perfiles").select("nombre").eq("id", params.alumnoId).maybeSingle(),
  ]);
  const nombreEjercicioRaw = ejercicio?.rutina_dia_ejercicios as
    | { nombre: string }
    | { nombre: string }[]
    | null;
  const nombreEjercicio =
    (Array.isArray(nombreEjercicioRaw) ? nombreEjercicioRaw[0] : nombreEjercicioRaw)?.nombre ??
    "su ejercicio";
  const nombre = nombreAlumnoPublicado(perfil?.nombre ?? "Alumno");

  const payload = {
    title: `Impulso VIP · ${nombre} te llama`,
    body: `${nombre} pidió que lo guíes ahora en ${nombreEjercicio}.`,
    tag: `impulso-asistencia-${params.sesionEjercicioId}`,
    url: `/admin/alumnos`,
  };
  await Promise.all(suscripciones.map((sub) => enviarPush(admin as Admin, sub, payload)));
}
