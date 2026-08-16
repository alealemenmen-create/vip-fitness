import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { finQuincenaISO, hoyISO, lunesDeISO, quincenaDeISO, sumarDiasISO } from "@/lib/date";
import { calcularPuntosAlimentacion, calcularPuntosEntrenamiento, calcularPuntosImpulso, limitarTramosDescanso, PUNTOS_VIP } from "./reglas";

/** Bono de Impulso VIP al finalizar una sesión — misma clave que
 * `entrenamiento:<sesionId>` en concepto (una fila por sesión, no por
 * ejercicio) pero con su propia clave `impulso:<sesionId>` para no pisar el
 * puntaje de completar la sesión. `puntos` ya viene sumado y topeado por el
 * llamador (ver `calcularPuntosImpulso` y `PUNTOS_VIP.impulsoMaximoPorSesion`
 * en reglas.ts) — acá solo se persiste. */
/**
 * Técnica de entrenamiento (drop set, rest-pause, biserie, triserie...)
 * asignada por el entrenador y cumplida con esfuerzo real — el alumno
 * respondió "Estuvo muy difícil" a la encuesta de dificultad de ese
 * ejercicio. Una vez por ejercicio (`tecnica:<sesionEjercicioId>`, inmutable:
 * si después corrige la respuesta, los puntos ya dados no se retiran).
 */
export async function registrarTecnicaCumplida({
  alumnoId,
  sesionEjercicioId,
  fecha,
  tecnicaTipo,
}: {
  alumnoId: string;
  sesionEjercicioId: string;
  fecha: string;
  tecnicaTipo: string;
}) {
  return guardarRecompensaInmutable({
    alumnoId,
    clave: `tecnica:${sesionEjercicioId}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.tecnicaAsignadaCumplida,
    titulo: "Técnica cumplida",
    detalle: `${tecnicaTipo}: la hiciste con esfuerzo real.`,
    fecha,
    metadata: { sesionEjercicioId, tecnicaTipo },
  });
}

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
  return guardarRecompensaInmutable({
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

    return await registrarImpulso({
      alumnoId,
      sesionId,
      fecha,
      puntos,
      detalle: `${evaluadas.length} ${evaluadas.length === 1 ? "meta evaluada" : "metas evaluadas"} de Impulso VIP`,
    });
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

// `lunesDe` vivía acá con lógica propia (medianoche UTC en vez de Chile).
// Ahora es un alias de `lunesDeISO` (ver `lib/date.ts`), la misma función
// que usa la nueva galería semanal de fotos — así "qué semana es esta
// fecha" nunca puede responder distinto entre los puntos y la galería.
const lunesDe = lunesDeISO;

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

/**
 * Igual que `guardarMovimiento`, pero devuelve lo que REALMENTE cambió el
 * saldo, no lo que vale la recompensa.
 *
 * Las recompensas semanales van con clave `<tipo>:<lunes>`: la segunda foto
 * de la misma semana hace upsert sobre la misma fila y el total del alumno no
 * se mueve. `guardarMovimiento` igual devolvía los puntos completos, así que
 * la pantalla anunciaba "+X Puntos VIP" que nunca se acreditaron — reportado
 * por el entrenador como "subió dos fotos y no sumaron puntos". Devolver el
 * delta permite decir la verdad en la interfaz.
 */
async function guardarMovimientoConDelta(movimiento: Movimiento): Promise<number> {
  const admin = createAdminClient();
  const { data: existente } = await admin
    .from("puntos_vip_movimientos")
    .select("puntos")
    .eq("alumno_id", movimiento.alumnoId)
    .eq("clave", movimiento.clave)
    .maybeSingle();
  const puntos = await guardarMovimiento(movimiento);
  return puntos - (existente?.puntos ?? 0);
}

/** La primera recompensa de una sesión queda congelada. Corregir sus datos
 * después no puede restar ni volver a sumar puntos ya acreditados. */
async function guardarRecompensaInmutable(movimiento: Movimiento): Promise<number> {
  const admin = createAdminClient();
  const puntos = Math.round(movimiento.puntos);
  const { data: existente, error: errorLectura } = await admin
    .from("puntos_vip_movimientos")
    .select("id")
    .eq("alumno_id", movimiento.alumnoId)
    .eq("clave", movimiento.clave)
    .maybeSingle();
  if (errorLectura) throw new Error(`No fue posible verificar Puntos VIP: ${errorLectura.message}`);
  if (existente) return 0;
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
    { onConflict: "alumno_id,clave", ignoreDuplicates: true }
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
  descansoDesactivadoPorAlumno = false,
}: {
  alumnoId: string;
  sesionId: string;
  fecha: string;
  completados: number;
  total: number;
  // true solo cuando el ALUMNO apagó su propio temporizador de descanso — si
  // lo apagó el entrenador (ej. razón médica), nunca penaliza.
  descansoDesactivadoPorAlumno?: boolean;
}) {
  const puntos = descansoDesactivadoPorAlumno
    ? PUNTOS_VIP.entrenamientoSinDescansoPorAlumno
    : calcularPuntosEntrenamiento(completados, total);
  return guardarRecompensaInmutable({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos,
    titulo: "Entrenamiento finalizado",
    detalle: descansoDesactivadoPorAlumno
      ? "Entrenaste con tu propio temporizador de descanso apagado"
      : `${completados} de ${total} ejercicios completados`,
    fecha,
    metadata: { sesionId, completados, total, descansoDesactivadoPorAlumno },
  });
}

/** Pone en cero el bono de Impulso VIP de una sesión (clave `impulso:
 * <sesionId>`), para que reabrir/abandonar la revierta igual que el resto
 * de sus puntos — antes solo se revertía `entrenamiento:<sesionId>` y el
 * bono de Impulso quedaba cobrado aunque la sesión ya no contara como
 * completada en ningún otro lado. */
async function desactivarImpulso(alumnoId: string, sesionId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `impulso:${sesionId}`,
    categoria: "progreso",
    puntos: 0,
    titulo: "Impulso VIP revertido",
    detalle: "Se confirmará de nuevo si la sesión se vuelve a finalizar.",
    fecha,
    metadata: { sesionId },
  });
}

export async function desactivarEntrenamiento(alumnoId: string, sesionId: string, fecha: string) {
  await desactivarImpulso(alumnoId, sesionId, fecha);
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
  await desactivarImpulso(alumnoId, sesionId, fecha);
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
 * de sesiones que se eliminaron por completo: viven en `puntos_vip_movimientos`
 * indexados por clave y no por clave foránea, así que no se van solos con la
 * sesión. Sin esto quedarían huérfanos, cobrados para siempre por una sesión
 * que ya no existe. Hoy la usa `aprobarBorradoSesion` (`admin/borrados`), el
 * único camino que borra una sesión de verdad. */
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
  const tramosLimitados = limitarTramosDescanso(tramosExcedidos);
  if (tramosLimitados <= 0) return 0;
  const puntos = -Math.min(
    PUNTOS_VIP.descansoPenalizacionMaxima,
    tramosLimitados * PUNTOS_VIP.descansoPenalizacionPorTramo
  );
  return guardarMovimiento({
    alumnoId,
    clave: `descanso_exceso:${sesionEjercicioId}:${numero}`,
    categoria: "ajuste",
    puntos,
    titulo: "Descanso excedido",
    detalle: `Te pasaste ${tramosLimitados * PUNTOS_VIP.descansoSegundosPorTramo}s${tramosLimitados < tramosExcedidos ? " o más" : ""} del descanso indicado`,
    fecha,
    metadata: { sesionEjercicioId, numero, tramosExcedidos: tramosLimitados },
  });
}

export async function recalcularAlimentacionDia(alumnoId: string, fecha: string): Promise<number> {
  const admin = createAdminClient();
  const [{ data: plan }, { data: registro }] = await Promise.all([
    admin
      .from("planes_alimentacion")
      .select("kcal_objetivo, prot_objetivo")
      .eq("alumno_id", alumnoId)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("registros_diarios")
      .select(
        "comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, prot, porcion_base, aprobado)))"
      )
      .eq("alumno_id", alumnoId)
      .eq("fecha", fecha)
      .maybeSingle(),
  ]);

  let kcal = 0;
  let proteina = 0;
  type Comida = {
    omitida: boolean;
    alimentos_consumidos:
      | { cantidad: number; alimentos: { kcal: number; prot: number; porcion_base: number; aprobado: boolean } | null }[]
      | null;
  };
  const comidas = (registro?.comidas_registradas as unknown as Comida[] | null) ?? [];
  for (const comida of comidas) {
    if (comida.omitida) continue;
    for (const consumido of comida.alimentos_consumidos ?? []) {
      if (!consumido.alimentos || consumido.alimentos.porcion_base <= 0) continue;
      // Un alimento personalizado que el alumno todavía no vio aprobado por
      // el entrenador sigue registrado en su diario (no se le oculta), pero
      // no cuenta para el puntaje del día — sin esto, cualquiera podía
      // fabricar un "alimento" con las calorías exactas que necesitaba para
      // dar siempre el 100% de su meta.
      if (!consumido.alimentos.aprobado) continue;
      kcal += (consumido.cantidad / consumido.alimentos.porcion_base) * consumido.alimentos.kcal;
      proteina += (consumido.cantidad / consumido.alimentos.porcion_base) * consumido.alimentos.prot;
    }
  }

  const objetivo = plan?.kcal_objetivo ?? null;
  const diaCerrado = fecha < hoyISO();
  const objetivoProteina = plan?.prot_objetivo ?? null;
  const puntosCalculados = calcularPuntosAlimentacion(
    kcal,
    objetivo,
    diaCerrado,
    proteina,
    objetivoProteina
  );
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
      proteina: Math.round(proteina),
      objetivo,
      objetivoProteina,
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
  return guardarMovimientoConDelta({
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

/** Cada 15 días, no cada semana (pedido de Alejandro, 2026-08-16): "semanal
 * es muy pronto para ver resultados". La clave usa `quincenaDeISO`, no
 * `lunesDe` — es una unidad de 15 días, no de 7. */
export async function registrarFoto(alumnoId: string, fecha: string) {
  return guardarMovimientoConDelta({
    alumnoId,
    clave: `foto:${quincenaDeISO(fecha)}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.fotoQuincenal,
    titulo: "Foto de progreso",
    detalle: "Seguimiento visual de la quincena",
    fecha,
  });
}

/** Al borrar una foto, revisa si la quincena debe conservar su recompensa.
 *
 * Una foto vieja (fechada fuera de la ventana válida) nunca pasa por
 * `registrarFoto`, así que su quincena puede no tener movimiento — o
 * tenerlo en 0 — aunque queden fotos en `fotos_progreso` para esos días.
 * Antes esta función miraba solo "¿queda alguna foto en la quincena?" y si
 * la había, volvía a poner los 100 puntos completos sin importar si esa
 * quincena los había ganado alguna vez: borrar una foto vieja fabricaba
 * puntos retroactivos de quincenas de hace meses (bug encontrado con datos
 * reales, cuando esto era semanal). Ahora solo se CONSERVA una recompensa
 * que ya existía — nunca se CREA una nueva acá; crearla es trabajo
 * exclusivo de `registrarFoto` en el momento de subir. */
export async function recalcularFotoQuincena(alumnoId: string, fecha: string) {
  const admin = createAdminClient();
  const inicio = quincenaDeISO(fecha);
  const fin = finQuincenaISO(inicio);
  const [{ data: foto }, { data: existente }] = await Promise.all([
    admin
      .from("fotos_progreso")
      .select("id")
      .eq("alumno_id", alumnoId)
      .gte("fecha_foto", inicio)
      .lte("fecha_foto", fin)
      .limit(1)
      .maybeSingle(),
    admin
      .from("puntos_vip_movimientos")
      .select("puntos")
      .eq("alumno_id", alumnoId)
      .eq("clave", `foto:${inicio}`)
      .maybeSingle(),
  ]);
  const yaGanada = (existente?.puntos ?? 0) > 0;
  const mantener = Boolean(foto) && yaGanada;
  return guardarMovimiento({
    alumnoId,
    clave: `foto:${inicio}`,
    categoria: "progreso",
    puntos: mantener ? PUNTOS_VIP.fotoQuincenal : 0,
    titulo: mantener ? "Foto de progreso" : "Foto de progreso eliminada",
    detalle: mantener ? "Seguimiento visual de la quincena" : "Sube una foto para recuperar esta recompensa",
    fecha,
  });
}
