import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO, sumarDiasISO } from "@/lib/date";
import { calcularPuntosAlimentacion, calcularPuntosEntrenamiento, calcularPuntosImpulso, PUNTOS_VIP } from "./reglas";

/** Bono de Impulso VIP al finalizar una sesión — misma clave que
 * `entrenamiento:<sesionId>` en concepto (una fila por sesión, no por
 * ejercicio) pero con su propia clave `impulso:<sesionId>` para no pisar el
 * puntaje de completar la sesión. `puntos` ya viene sumado y topeado por el
 * llamador (ver `calcularPuntosImpulso` y `PUNTOS_VIP.impulsoMaximoPorSesion`
 * en reglas.ts) — acá solo se persiste. */
export async function registrarImpulso({
  alumnoId,
  sesionId,
  fecha,
  puntos,
  detalle,
}: {
  alumnoId: string;
  sesionId: string;
  fecha: string;
  puntos: number;
  detalle: string;
}) {
  return guardarMovimiento({
    alumnoId,
    clave: `impulso:${sesionId}`,
    categoria: "progreso",
    puntos,
    titulo: "Impulso VIP",
    detalle,
    fecha,
    metadata: { sesionId },
  });
}

/**
 * Suma el bono de Impulso VIP de una sesión ya finalizada y lo registra.
 * Solo cuentan las recomendaciones `aprobada` (nunca `propuesta` sin
 * confirmar, ni `bloqueada`) de Reglas A, B o C — D (reducir) y E
 * (consultar) nunca puntúan, no son una meta lograda. El total queda topeado
 * en `PUNTOS_VIP.impulsoMaximoPorSesion` para que Impulso VIP sea un bono
 * chico, nunca compita con los 300 puntos de completar la sesión.
 *
 * Devuelve 0 en cualquier error (migración 0043 sin correr, tabla vacía,
 * etc.) en vez de lanzar: es un bono, no un requisito para poder finalizar.
 */
export async function calcularYRegistrarPuntosImpulso(
  alumnoId: string,
  sesionId: string,
  fecha: string
): Promise<number> {
  try {
    const admin = createAdminClient();
    // `impulso_vip_recomendaciones` tiene DOS foreign keys hacia
    // `sesion_ejercicios` (`sesion_ejercicio_id` y `basado_en_sesion_ejercicio_id`)
    // — sin nombrar la constraint, PostgREST no puede resolver el embed
    // ("more than one relationship was found", PGRST201) y esta consulta
    // fallaba siempre, devolviendo 0 en silencio por el catch de abajo. Se
    // detectó recién al verificar el bono con datos reales de punta a punta.
    const { data: filas } = await admin
      .from("impulso_vip_recomendaciones")
      .select("cumplimiento, sesion_ejercicios!impulso_vip_recomendaciones_sesion_ejercicio_id_fkey!inner(sesion_id)")
      .eq("sesion_ejercicios.sesion_id", sesionId)
      .eq("estado", "aprobada")
      .in("regla", ["A_subir_reps", "B_subir_peso", "C_mantener"]);

    const evaluadas = filas ?? [];
    const puntos = Math.min(
      PUNTOS_VIP.impulsoMaximoPorSesion,
      evaluadas.reduce((acc, f) => acc + calcularPuntosImpulso(f.cumplimiento), 0)
    );
    if (puntos <= 0) return 0;

    await registrarImpulso({
      alumnoId,
      sesionId,
      fecha,
      puntos,
      detalle: `${evaluadas.length} ${evaluadas.length === 1 ? "meta evaluada" : "metas evaluadas"} de Impulso VIP`,
    });
    return puntos;
  } catch {
    return 0;
  }
}

type Categoria = "entrenamiento" | "alimentacion" | "progreso" | "constancia" | "competencia" | "ajuste";

type Movimiento = {
  alumnoId: string;
  clave: string;
  categoria: Categoria;
  puntos: number;
  titulo: string;
  detalle?: string | null;
  fecha: string;
  metadata?: Record<string, unknown>;
};

function lunesDe(fechaISO: string): string {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);
  const desplazamiento = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - desplazamiento);
  return fecha.toISOString().slice(0, 10);
}

export async function guardarMovimiento(movimiento: Movimiento): Promise<number> {
  const admin = createAdminClient();
  const puntos = Math.round(movimiento.puntos);
  const { error } = await admin.from("puntos_vip_movimientos").upsert(
    {
      alumno_id: movimiento.alumnoId,
      clave: movimiento.clave,
      categoria: movimiento.categoria,
      puntos,
      titulo: movimiento.titulo,
      detalle: movimiento.detalle ?? null,
      fecha: movimiento.fecha,
      metadata: movimiento.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alumno_id,clave" }
  );
  if (error) throw new Error(`No fue posible guardar Puntos VIP: ${error.message}`);
  return puntos;
}

export async function registrarEntrenamiento({
  alumnoId,
  sesionId,
  fecha,
  completados,
  total,
}: {
  alumnoId: string;
  sesionId: string;
  fecha: string;
  completados: number;
  total: number;
}) {
  const puntos = calcularPuntosEntrenamiento(completados, total);
  return guardarMovimiento({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos,
    titulo: "Entrenamiento finalizado",
    detalle: `${completados} de ${total} ejercicios completados`,
    fecha,
    metadata: { sesionId, completados, total },
  });
}

export async function desactivarEntrenamiento(alumnoId: string, sesionId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos: 0,
    titulo: "Entrenamiento reabierto",
    detalle: "Los puntos se confirmaran al finalizar nuevamente.",
    fecha,
    metadata: { sesionId },
  });
}

/** Abandonar una sesión ya cerrada le quita los puntos que había ganado,
 * igual que reabrirla — la diferencia es que acá no vuelve a quedar "en
 * progreso", queda cerrada y marcada como abandonada (se ve en el
 * historial, no desaparece). */
export async function abandonarEntrenamiento(alumnoId: string, sesionId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos: 0,
    titulo: "Entrenamiento abandonado",
    detalle: "Sesión abandonada, no cuenta para el ranking.",
    fecha,
    metadata: { sesionId },
  });
}

/** Borra los movimientos de puntos (`entrenamiento:<id>` e `impulso:<id>`)
 * de sesiones que se eliminaron por completo, para que reiniciar una rutina
 * no deje puntos huérfanos que se sumen de nuevo cuando el alumno la vuelva
 * a completar con sesiones nuevas (ver `reiniciarRutina` en
 * `alumno/entrenar/actions.ts`). */
export async function eliminarMovimientosDeSesiones(alumnoId: string, sesionIds: string[]) {
  if (sesionIds.length === 0) return;
  const admin = createAdminClient();
  const claves = sesionIds.flatMap((id) => [`entrenamiento:${id}`, `impulso:${id}`]);
  await admin.from("puntos_vip_movimientos").delete().eq("alumno_id", alumnoId).in("clave", claves);
}

/** Penaliza descansar de más entre series. `tramosExcedidos` es cuántos
 * bloques de `PUNTOS_VIP.descansoSegundosPorTramo` pasaron desde que terminó
 * el descanso indicado — lo calcula el cliente (ver `SesionEjercicioCard`) y
 * se guarda con upsert bajo una clave fija por serie, así que llamar de
 * nuevo con un `tramosExcedidos` mayor solo actualiza el mismo movimiento en
 * vez de sumar penalizaciones nuevas. */
export async function registrarPenalizacionDescanso({
  alumnoId,
  sesionEjercicioId,
  numero,
  tramosExcedidos,
  fecha,
}: {
  alumnoId: string;
  sesionEjercicioId: string;
  numero: number;
  tramosExcedidos: number;
  fecha: string;
}) {
  const puntos = -Math.min(
    PUNTOS_VIP.descansoPenalizacionMaxima,
    tramosExcedidos * PUNTOS_VIP.descansoPenalizacionPorTramo
  );
  return guardarMovimiento({
    alumnoId,
    clave: `descanso_exceso:${sesionEjercicioId}:${numero}`,
    categoria: "ajuste",
    puntos,
    titulo: "Descanso excedido",
    detalle: `Te pasaste ${tramosExcedidos * PUNTOS_VIP.descansoSegundosPorTramo}s del descanso indicado`,
    fecha,
    metadata: { sesionEjercicioId, numero, tramosExcedidos },
  });
}

export async function recalcularAlimentacionDia(alumnoId: string, fecha: string): Promise<number> {
  const admin = createAdminClient();
  const [{ data: plan }, { data: registro }] = await Promise.all([
    admin
      .from("planes_alimentacion")
      .select("kcal_objetivo")
      .eq("alumno_id", alumnoId)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("registros_diarios")
      .select("comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, porcion_base)))")
      .eq("alumno_id", alumnoId)
      .eq("fecha", fecha)
      .maybeSingle(),
  ]);

  let kcal = 0;
  type Comida = {
    omitida: boolean;
    alimentos_consumidos: { cantidad: number; alimentos: { kcal: number; porcion_base: number } | null }[] | null;
  };
  const comidas = (registro?.comidas_registradas as unknown as Comida[] | null) ?? [];
  for (const comida of comidas) {
    if (comida.omitida) continue;
    for (const consumido of comida.alimentos_consumidos ?? []) {
      if (!consumido.alimentos || consumido.alimentos.porcion_base <= 0) continue;
      kcal += (consumido.cantidad / consumido.alimentos.porcion_base) * consumido.alimentos.kcal;
    }
  }

  const objetivo = plan?.kcal_objetivo ?? null;
  const diaCerrado = fecha < hoyISO();
  const puntosCalculados = calcularPuntosAlimentacion(kcal, objetivo, diaCerrado);
  const puntosGuardados = diaCerrado ? puntosCalculados : 0;
  const porcentaje = objetivo && objetivo > 0 ? Math.round((kcal / objetivo) * 100) : null;
  const sinRegistro = diaCerrado && kcal <= 0;
  await guardarMovimiento({
    alumnoId,
    clave: `alimentacion:${fecha}`,
    categoria: "alimentacion",
    puntos: puntosGuardados,
    titulo: sinRegistro
      ? "Dia sin alimentacion registrada"
      : diaCerrado
        ? "Alimentacion del dia cerrada"
        : "Alimentacion en curso",
    detalle: sinRegistro
      ? `No registraste alimentos: ${puntosGuardados} puntos`
      : porcentaje === null
        ? `${Math.round(kcal)} kcal registradas`
        : diaCerrado
          ? `${porcentaje}% de la meta · ${puntosGuardados >= 0 ? "+" : ""}${puntosGuardados} puntos`
          : `${porcentaje}% de la meta · ${puntosCalculados} puntos provisionales`,
    fecha,
    metadata: {
      kcal: Math.round(kcal),
      objetivo,
      porcentaje,
      estado: diaCerrado ? "cerrado" : "provisional",
      puntosProvisionales: diaCerrado ? null : puntosCalculados,
    },
  });
  return puntosCalculados;
}

/** Premia una sola vez el primer ingreso real del alumno durante el dia. */
export async function registrarIngresoDiario(alumnoId: string, fecha = hoyISO()): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("puntos_vip_movimientos")
    .upsert(
      {
        alumno_id: alumnoId,
        clave: `ingreso:${fecha}`,
        categoria: "constancia",
        puntos: PUNTOS_VIP.ingresoDiario,
        titulo: "Primera entrada del dia",
        detalle: "Ingreso diario confirmado",
        fecha,
        metadata: {},
      },
      { onConflict: "alumno_id,clave", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`No fue posible registrar el ingreso diario: ${error.message}`);
  if (!data) return 0;

  // Al comenzar un nuevo dia se cierra la alimentacion de ayer. Hasta ese
  // momento la barra era solo una estimacion y no afectaba la competencia.
  await recalcularAlimentacionDia(alumnoId, sumarDiasISO(fecha, -1));
  return PUNTOS_VIP.ingresoDiario;
}

export async function registrarPeso(alumnoId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `peso:${lunesDe(fecha)}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.pesoSemanal,
    titulo: "Peso semanal registrado",
    detalle: "Una recompensa por semana",
    fecha,
  });
}

export async function recalcularPesoSemana(alumnoId: string, fecha: string) {
  const admin = createAdminClient();
  const lunes = lunesDe(fecha);
  const domingo = sumarDiasISO(lunes, 6);
  const { data } = await admin
    .from("pesos_corporales")
    .select("id")
    .eq("alumno_id", alumnoId)
    .gte("fecha", lunes)
    .lte("fecha", domingo)
    .limit(1)
    .maybeSingle();
  return guardarMovimiento({
    alumnoId,
    clave: `peso:${lunes}`,
    categoria: "progreso",
    puntos: data ? PUNTOS_VIP.pesoSemanal : 0,
    titulo: data ? "Peso semanal registrado" : "Peso semanal eliminado",
    detalle: data ? "Una recompensa por semana" : "Registra un peso para recuperar esta recompensa",
    fecha,
  });
}

export async function registrarFoto(alumnoId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `foto:${lunesDe(fecha)}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.fotoSemanal,
    titulo: "Foto de progreso",
    detalle: "Seguimiento visual de la semana",
    fecha,
  });
}

export async function recalcularFotoSemana(alumnoId: string, fecha: string) {
  const admin = createAdminClient();
  const lunes = lunesDe(fecha);
  const domingo = sumarDiasISO(lunes, 6);
  const { data } = await admin
    .from("fotos_progreso")
    .select("id")
    .eq("alumno_id", alumnoId)
    .gte("fecha_foto", lunes)
    .lte("fecha_foto", domingo)
    .limit(1)
    .maybeSingle();
  return guardarMovimiento({
    alumnoId,
    clave: `foto:${lunes}`,
    categoria: "progreso",
    puntos: data ? PUNTOS_VIP.fotoSemanal : 0,
    titulo: data ? "Foto de progreso" : "Foto de progreso eliminada",
    detalle: data ? "Seguimiento visual de la semana" : "Sube una foto para recuperar esta recompensa",
    fecha,
  });
}
