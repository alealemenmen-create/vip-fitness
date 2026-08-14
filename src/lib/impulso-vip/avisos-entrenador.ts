import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, vapidListo } from "@/lib/push/enviar";
import { nombreAlumnoPublicado } from "@/lib/nombre";

type Admin = ReturnType<typeof createAdminClient>;

type EjercicioSesion = {
  id: string;
  completado: boolean;
  rutina_dia_ejercicios: { orden: number; nombre: string } | { orden: number; nombre: string }[] | null;
};

function programaDe(fila: EjercicioSesion): { orden: number; nombre: string } | null {
  return Array.isArray(fila.rutina_dia_ejercicios)
    ? fila.rutina_dia_ejercicios[0] ?? null
    : fila.rutina_dia_ejercicios;
}

/**
 * Avisa a Ale cuando una propuesta queda a uno o dos ejercicios de distancia.
 * Eso produce una ventana aproximada de 10–20 minutos sin depender de un
 * temporizador del navegador. La PK de la tabla 0086 hace el envío idempotente.
 */
export async function avisarPropuestaImpulsoCercana(params: {
  sesionId: string;
  alumnoId: string;
  despuesDeEjercicioId?: string;
}): Promise<void> {
  if (!vapidListo()) return;
  const admin = createAdminClient();

  const { data: entrenadores } = await admin.from("perfiles").select("id").in("rol", ["entrenador", "admin"]);
  const entrenadorIds = (entrenadores ?? []).map((fila) => fila.id);
  if (entrenadorIds.length === 0) return;
  const { data: suscripciones } = await admin.from("push_suscripciones")
    .select("endpoint, p256dh, auth").in("alumno_id", entrenadorIds);
  if (!suscripciones?.length) return;

  const [{ data: ejerciciosData }, { data: sesion }, { data: perfil }] = await Promise.all([
    admin.from("sesion_ejercicios")
      .select("id, completado, rutina_dia_ejercicios(orden, nombre)")
      .eq("sesion_id", params.sesionId),
    admin.from("sesiones_entrenamiento")
      .select("id, estado, rutina_iniciada_en, rutina_dias(nombre)")
      .eq("id", params.sesionId).eq("alumno_id", params.alumnoId).maybeSingle(),
    admin.from("perfiles").select("nombre").eq("id", params.alumnoId).maybeSingle(),
  ]);
  if (!sesion || sesion.estado !== "en_progreso" || !sesion.rutina_iniciada_en) return;

  const ejercicios = ((ejerciciosData ?? []) as unknown as EjercicioSesion[])
    .filter((fila) => programaDe(fila))
    .sort((a, b) => programaDe(a)!.orden - programaDe(b)!.orden);
  const indiceActual = params.despuesDeEjercicioId
    ? ejercicios.findIndex((fila) => fila.id === params.despuesDeEjercicioId)
    : -1;
  const cercanos = ejercicios.slice(indiceActual + 1, indiceActual + 3).filter((fila) => !fila.completado);
  if (cercanos.length === 0) return;

  const { data: intervenciones } = await admin.from("impulso_vip_intervenciones")
    .select("id, sesion_ejercicio_id, tipo")
    .eq("alumno_id", params.alumnoId)
    .eq("estado", "preparada")
    .eq("origen", "metodo_ale")
    .in("sesion_ejercicio_id", cercanos.map((fila) => fila.id));
  if (!intervenciones?.length) return;
  const ordenIds = cercanos.map((fila) => fila.id);
  const propuesta = [...intervenciones].sort(
    (a, b) => ordenIds.indexOf(a.sesion_ejercicio_id) - ordenIds.indexOf(b.sesion_ejercicio_id)
  )[0];
  const ejercicio = cercanos.find((fila) => fila.id === propuesta.sesion_ejercicio_id);
  if (!ejercicio) return;

  const { data: aviso, error } = await admin.from("impulso_vip_avisos_entrenador").insert({
    intervencion_id: propuesta.id,
    alumno_id: params.alumnoId,
  }).select("intervencion_id").maybeSingle();
  if (error || !aviso) return; // 23505 incluido: ya se avisó desde otra petición.

  const nombre = nombreAlumnoPublicado(perfil?.nombre ?? "Alumno");
  const diaCrudo = sesion.rutina_dias as { nombre: string } | { nombre: string }[] | null;
  const dia = Array.isArray(diaCrudo) ? diaCrudo[0]?.nombre : diaCrudo?.nombre;
  const nombreEjercicio = programaDe(ejercicio)?.nombre ?? "su próximo ejercicio";
  const distancia = cercanos.findIndex((fila) => fila.id === ejercicio.id);
  const proximidad = distancia === 0 ? "Está por llegar" : "En 10–20 min llega";
  const payload = {
    title: `Impulso VIP · ${nombre}`,
    body: `${nombre} está haciendo ${dia ?? "su rutina"}. ${proximidad} a ${nombreEjercicio}. Impulso se activará solo; abre únicamente si quieres cancelarlo.`,
    tag: `impulso-propuesta-${propuesta.id}`,
    url: `/admin/alumnos?propuesta=${propuesta.id}#propuestas-impulso`,
  };
  await Promise.all(suscripciones.map((sub) => enviarPush(admin as Admin, sub, payload)));
}

/**
 * Avisa a Ale por push cuando un alumno toca "Pídele ayuda a Ale" en un
 * Momento Impulso. Antes esto solo insertaba la fila en
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
    title: `Impulso VIP · ${nombre} pide ayuda`,
    body: `${nombre} pidió ayuda ahora en ${nombreEjercicio}.`,
    tag: `impulso-asistencia-${params.sesionEjercicioId}`,
    url: `/admin/alumnos`,
  };
  await Promise.all(suscripciones.map((sub) => enviarPush(admin as Admin, sub, payload)));
}
