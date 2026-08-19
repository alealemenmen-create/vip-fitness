import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { hoyISO, ultimosNDiasISO } from "@/lib/date";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { adherenciaPonderada, cumplimientoMinimo, limitarPct, nivelDeCumplimiento, precisionObjetivo, promedio } from "./calculos";
import type { AlertaSeguimiento, DiaSeguimiento, PeriodoSeguimiento, SeguimientoIntegral, SesionDiaSeguimiento } from "./tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type FilaSesion = {
  id: string;
  fecha: string;
  estado: string;
  rutina_dias: { nombre: string } | null;
};
type FilaEjercicio = {
  id: string;
  sesion_id: string;
  completado: boolean;
  dificultad_percibida: string | null;
  rutina_dia_ejercicios: { nombre: string; series_programadas: number; grupo_muscular: string | null } | null;
};
type FilaSerie = { sesion_ejercicio_id: string; realizada: boolean };
type FilaComida = {
  omitida: boolean;
  alimentos_consumidos: {
    cantidad: number;
    alimentos: { kcal: number; prot: number; carb: number; grasa: number; porcion_base: number } | null;
  }[] | null;
};
type FilaRegistro = { fecha: string; comidas_registradas: FilaComida[] | null };
type FilaRutinaActiva = {
  id: string;
  created_at: string;
  rutina_dias: { tipo: string }[] | null;
};

function diasDesde(fecha: string): number {
  return Math.max(0, Math.round((new Date(`${hoyISO()}T12:00:00`).getTime() - new Date(`${fecha}T12:00:00`).getTime()) / 86_400_000));
}

export async function obtenerSeguimientoIntegral(
  supabase: SupabaseServerClient,
  alumnoId: string,
  diasPeriodo: PeriodoSeguimiento
): Promise<SeguimientoIntegral | null> {
  const fechas = ultimosNDiasISO(diasPeriodo);
  const hasta = fechas[0];
  const desde = fechas[fechas.length - 1];

  const resultadosBase = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", alumnoId).maybeSingle(),
    supabase
      .from("rutinas")
      .select("id, created_at, rutina_dias(tipo)")
      .eq("alumno_id", alumnoId)
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("planes_alimentacion")
      .select("kcal_objetivo, prot_objetivo")
      .eq("alumno_id", alumnoId)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sesiones_entrenamiento")
      .select("id, fecha, estado, rutina_dias(nombre)")
      .eq("alumno_id", alumnoId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false }),
    supabase
      .from("registros_diarios")
      .select("fecha, comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, prot, carb, grasa, porcion_base)))")
      .eq("alumno_id", alumnoId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("seguimientos_diarios")
      .select("fecha, entreno_hoy, cumplio_alimentacion, agua_litros, horas_sueno, energia, molestias, comentario")
      .eq("alumno_id", alumnoId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("pesos_corporales")
      .select("fecha, peso_kg")
      .eq("alumno_id", alumnoId)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .limit(100),
    supabase
      .from("fotos_progreso")
      .select("fecha_foto")
      .eq("alumno_id", alumnoId)
      .gte("fecha_foto", desde)
      .lte("fecha_foto", hasta),
    supabase
      .from("medidas_corporales")
      .select("fecha")
      .eq("alumno_id", alumnoId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("impulso_vip_alertas")
      .select("tipo, zona, intensidad, detalle, creado_en")
      .eq("alumno_id", alumnoId)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: false }),
    supabase
      .from("sesiones_entrenamiento")
      .select("fecha")
      .eq("alumno_id", alumnoId)
      .in("estado", ["completada", "finalizada_incompleta"])
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("seguimiento_revisiones")
      .select("id, desde, hasta, observacion, decision_siguiente_plan, creado_en, perfiles!seguimiento_revisiones_entrenador_id_fkey(nombre)")
      .eq("alumno_id", alumnoId)
      .order("creado_en", { ascending: false })
      .limit(8),
  ]);

  // `seguimiento_revisiones` es una ampliación para el panel del entrenador.
  // Si todavía no está instalada, el alumno debe conservar acceso a todo su
  // progreso base. En cambio, un fallo de cualquiera de las once fuentes
  // esenciales sí invalida el resumen: mostrar ceros sería engañoso.
  const errorBase = resultadosBase.slice(0, 11).find((resultado) => resultado.error)?.error;
  if (errorBase) throw new Error("No fue posible reconstruir el seguimiento integral.", { cause: errorBase });

  const [
    { data: perfil },
    { data: rutinaRaw },
    { data: plan },
    { data: sesionesRaw },
    { data: registroRaw },
    { data: seguimientos },
    { data: pesos },
    { data: fotos },
    { data: medidas },
    { data: alertasImpulso },
    { data: ultimaSesion },
    { data: revisionesRaw },
  ] = resultadosBase;

  if (!perfil) return null;
  const rutina = rutinaRaw as unknown as FilaRutinaActiva | null;
  const sesiones = (sesionesRaw ?? []) as unknown as FilaSesion[];
  const sesionIds = sesiones.map((sesion) => sesion.id);
  const resultadosDetalle = await Promise.all([
    sesionIds.length
      ? supabase
          .from("sesion_ejercicios")
          .select("id, sesion_id, completado, dificultad_percibida, rutina_dia_ejercicios(nombre, series_programadas, grupo_muscular)")
          .in("sesion_id", sesionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("impulso_vip_recomendaciones")
      .select("cumplimiento, created_at")
      .eq("alumno_id", alumnoId)
      .gte("created_at", `${desde}T00:00:00`)
      .lte("created_at", `${hasta}T23:59:59`),
  ]);
  const errorDetalle = resultadosDetalle.find((resultado) => resultado.error)?.error;
  if (errorDetalle) throw new Error("No fue posible leer el detalle del seguimiento.", { cause: errorDetalle });
  const [{ data: ejerciciosRaw }, { data: recomendaciones }] = resultadosDetalle;
  const ejercicios = (ejerciciosRaw ?? []) as unknown as FilaEjercicio[];
  const ejercicioIds = ejercicios.map((ejercicio) => ejercicio.id);
  const { data: seriesRaw, error: errorSeries } = ejercicioIds.length
    ? await supabase
        .from("series_realizadas")
        .select("sesion_ejercicio_id, realizada")
        .in("sesion_ejercicio_id", ejercicioIds)
    : { data: [], error: null };
  if (errorSeries) throw new Error("No fue posible leer las series del seguimiento.", { cause: errorSeries });
  const series = (seriesRaw ?? []) as FilaSerie[];

  const ejerciciosPorSesion = new Map<string, FilaEjercicio[]>();
  for (const ejercicio of ejercicios) {
    const lista = ejerciciosPorSesion.get(ejercicio.sesion_id) ?? [];
    lista.push(ejercicio);
    ejerciciosPorSesion.set(ejercicio.sesion_id, lista);
  }
  const seriesPorEjercicio = new Map<string, FilaSerie[]>();
  for (const serie of series) {
    const lista = seriesPorEjercicio.get(serie.sesion_ejercicio_id) ?? [];
    lista.push(serie);
    seriesPorEjercicio.set(serie.sesion_ejercicio_id, lista);
  }

  const sesionesDia = new Map<string, SesionDiaSeguimiento[]>();
  for (const sesion of sesiones) {
    const listaEjercicios = ejerciciosPorSesion.get(sesion.id) ?? [];
    const seriesTodas = listaEjercicios.flatMap((ejercicio) => seriesPorEjercicio.get(ejercicio.id) ?? []);
    const dificultades = listaEjercicios.map((ejercicio) => ejercicio.dificultad_percibida).filter(Boolean);
    const resumen: SesionDiaSeguimiento = {
      id: sesion.id,
      nombre: sesion.rutina_dias?.nombre ?? "Entrenamiento",
      estado: sesion.estado,
      ejerciciosCompletados: listaEjercicios.filter((ejercicio) => ejercicio.completado).length,
      ejerciciosTotales: listaEjercicios.length,
      seriesRealizadas: seriesTodas.filter((serie) => serie.realizada).length,
      seriesTotales: listaEjercicios.reduce((total, ejercicio) => total + (ejercicio.rutina_dia_ejercicios?.series_programadas ?? 0), 0),
      cardioCompletado: listaEjercicios.some((ejercicio) => ejercicio.completado && ejercicio.rutina_dia_ejercicios?.grupo_muscular === "cardio"),
      dificultad: dificultades.length ? dificultades[dificultades.length - 1] ?? null : null,
    };
    const lista = sesionesDia.get(sesion.fecha) ?? [];
    lista.push(resumen);
    sesionesDia.set(sesion.fecha, lista);
  }

  const nutricionDia = new Map<string, DiaSeguimiento["nutricion"]>();
  for (const registro of (registroRaw ?? []) as unknown as FilaRegistro[]) {
    let kcal = 0, proteina = 0, carbohidratos = 0, grasa = 0, comidas = 0, omitidas = 0;
    for (const comida of registro.comidas_registradas ?? []) {
      if (comida.omitida) { omitidas++; continue; }
      const consumidos = comida.alimentos_consumidos ?? [];
      if (consumidos.length === 0) continue;
      comidas++;
      for (const consumido of consumidos) {
        const alimento = consumido.alimentos;
        if (!alimento || alimento.porcion_base <= 0) continue;
        const factor = consumido.cantidad / alimento.porcion_base;
        kcal += alimento.kcal * factor;
        proteina += alimento.prot * factor;
        carbohidratos += alimento.carb * factor;
        grasa += alimento.grasa * factor;
      }
    }
    if (comidas === 0 && omitidas === 0) continue;
    nutricionDia.set(registro.fecha, {
      comidas,
      omitidas,
      kcal: Math.round(kcal),
      proteina: Math.round(proteina),
      carbohidratos: Math.round(carbohidratos),
      grasa: Math.round(grasa),
      kcalPct: precisionObjetivo(kcal, plan?.kcal_objetivo ?? null),
      proteinaPct: cumplimientoMinimo(proteina, plan?.prot_objetivo ?? null),
    });
  }

  // Filas antiguas podían existir completamente vacías. No deben acreditar
  // recuperación ni aparentar que el alumno hizo un check-in real.
  const seguimientosRespondidos = (seguimientos ?? []).filter((seguimiento) => [
    seguimiento.entreno_hoy,
    seguimiento.cumplio_alimentacion,
    seguimiento.agua_litros,
    seguimiento.horas_sueno,
    seguimiento.energia,
    seguimiento.molestias?.trim() || null,
    seguimiento.comentario?.trim() || null,
  ].some((valor) => valor !== null && valor !== undefined));
  const seguimientoPorFecha = new Map(seguimientosRespondidos.map((seguimiento) => [seguimiento.fecha, seguimiento]));
  const pesoPorFecha = new Map((pesos ?? []).filter((peso) => peso.fecha >= desde).map((peso) => [peso.fecha, peso.peso_kg]));
  const dias: DiaSeguimiento[] = fechas.map((fecha) => {
    const seguimiento = seguimientoPorFecha.get(fecha);
    return {
      fecha,
      sesiones: sesionesDia.get(fecha) ?? [],
      nutricion: nutricionDia.get(fecha) ?? null,
      aguaLitros: seguimiento?.agua_litros ?? null,
      suenoHoras: seguimiento?.horas_sueno ?? null,
      energia: seguimiento?.energia ?? null,
      molestias: seguimiento?.molestias ?? null,
      comentario: seguimiento?.comentario ?? null,
      declaracionEntreno: seguimiento?.entreno_hoy ?? null,
      declaracionAlimentacion: seguimiento?.cumplio_alimentacion ?? null,
      pesoKg: pesoPorFecha.get(fecha) ?? null,
    };
  });

  const diasEntrenamiento = ((rutina?.rutina_dias as unknown as { tipo: string }[] | null) ?? []).filter((dia) => dia.tipo === "entrenamiento").length;
  const inicioRutina = rutina?.created_at?.slice(0, 10) ?? desde;
  const diasConRutina = Math.max(1, Math.min(diasPeriodo, diasDesde(inicioRutina) + 1));
  const sesionesCerradas = sesiones.filter((sesion) => sesion.estado !== "en_progreso").length;
  const sesionesSegunCalendario = diasEntrenamiento > 0 ? Math.max(1, Math.round(diasEntrenamiento * diasConRutina / 7)) : 0;
  // Una rutina recién reemplazada no debe convertir sesiones abandonadas del
  // mismo período en "extras" invisibles. Toda sesión ya cerrada representa
  // una oportunidad de entrenamiento y, por tanto, cuenta en el denominador.
  const sesionesEsperadas = Math.max(sesionesSegunCalendario, sesionesCerradas);
  const sesionesRealizadas = sesiones.filter((sesion) => ["completada", "finalizada_incompleta"].includes(sesion.estado)).length;
  const frecuenciaPct = sesionesEsperadas > 0 ? limitarPct(sesionesRealizadas / sesionesEsperadas * 100) : null;
  const ejerciciosIntentados = ejercicios.filter((ejercicio) => {
    const estado = sesiones.find((sesion) => sesion.id === ejercicio.sesion_id)?.estado;
    return estado && estado !== "en_progreso";
  });
  const calidadSesionesPct = ejerciciosIntentados.length
    ? limitarPct(ejerciciosIntentados.filter((ejercicio) => ejercicio.completado).length / ejerciciosIntentados.length * 100)
    : null;
  const entrenamientoPct = frecuenciaPct === null ? null : limitarPct(frecuenciaPct * 0.7 + (calidadSesionesPct ?? frecuenciaPct) * 0.3);

  const diasNutricion = dias.filter((dia) => dia.nutricion && dia.nutricion.comidas > 0);
  const registroNutricionPct = diasNutricion.length / diasPeriodo * 100;
  const calidadNutricion = promedio(diasNutricion.flatMap((dia) => [dia.nutricion?.kcalPct, dia.nutricion?.proteinaPct]));
  const nutricionPct = plan?.kcal_objetivo
    ? limitarPct(registroNutricionPct * (0.3 + 0.7 * ((calidadNutricion ?? 0) / 100)))
    : null;
  const recuperacionPct = limitarPct(seguimientosRespondidos.length / diasPeriodo * 100);
  const adherenciaGeneral = adherenciaPonderada([
    { valor: entrenamientoPct, peso: 45 },
    { valor: nutricionPct, peso: 40 },
    { valor: recuperacionPct, peso: 15 },
  ]);

  const alertas: AlertaSeguimiento[] = [];
  for (const alerta of alertasImpulso ?? []) {
    alertas.push({
      prioridad: "alta",
      titulo: alerta.tipo === "dolor" ? "Dolor pendiente de revisión" : alerta.tipo === "caida_rendimiento" ? "Caída de rendimiento" : "Estancamiento detectado",
      detalle: [alerta.zona, alerta.intensidad ? `intensidad ${alerta.intensidad}/5` : null, alerta.detalle].filter(Boolean).join(" · ") || "Revisar antes de progresar cargas.",
    });
  }
  const abandonadas = sesiones.filter((sesion) => sesion.estado === "abandonada").length;
  if (abandonadas >= 2) alertas.push({ prioridad: "media", titulo: `${abandonadas} sesiones abandonadas`, detalle: "Conviene revisar duración, dificultad o disponibilidad antes de mantener el plan." });
  if (ultimaSesion?.fecha && diasDesde(ultimaSesion.fecha) >= 4) alertas.push({ prioridad: "media", titulo: `Hace ${diasDesde(ultimaSesion.fecha)} días que no entrena`, detalle: "Comparar con la frecuencia esperada de su rutina activa." });
  if (!ultimaSesion?.fecha && diasEntrenamiento > 0) alertas.push({ prioridad: "media", titulo: "Sin entrenamientos finalizados", detalle: "Tiene rutina activa, pero todavía no existe una sesión terminada." });
  const proteinaBaja = diasNutricion.filter((dia) => (dia.nutricion?.proteinaPct ?? 100) < 85).length;
  if (proteinaBaja >= 3) alertas.push({ prioridad: "media", titulo: "Proteína por debajo del objetivo", detalle: `${proteinaBaja} días registrados quedaron bajo el 85% de la meta.` });
  const suenoBajo = dias.filter((dia) => dia.suenoHoras !== null && dia.suenoHoras < 6).length;
  if (suenoBajo >= 3) alertas.push({ prioridad: "media", titulo: "Sueño bajo repetido", detalle: `${suenoBajo} días con menos de 6 horas registradas.` });
  const energiaBaja = dias.filter((dia) => dia.energia !== null && dia.energia <= 2).length;
  if (energiaBaja >= 3) alertas.push({ prioridad: "media", titulo: "Energía baja repetida", detalle: `${energiaBaja} seguimientos con energía 1–2 de 5.` });
  if (adherenciaGeneral !== null && adherenciaGeneral >= 90) alertas.push({ prioridad: "positiva", titulo: "Excelente constancia", detalle: `Alcanzó ${adherenciaGeneral}% de adherencia general en el período.` });

  const pesosPeriodo = (pesos ?? []).filter((peso) => peso.fecha >= desde && peso.fecha <= hasta);
  const primerPeso = pesosPeriodo[0]?.peso_kg ?? null;
  const ultimoPeso = pesosPeriodo[pesosPeriodo.length - 1]?.peso_kg ?? null;
  const evaluadas = (recomendaciones ?? []).filter((recomendacion) => recomendacion.cumplimiento !== null);
  const cumplidas = evaluadas.filter((recomendacion) => ["cumplida", "superada"].includes(recomendacion.cumplimiento!)).length;

  type RevisionRaw = { id: string; desde: string; hasta: string; observacion: string; decision_siguiente_plan: string | null; creado_en: string; perfiles: { nombre: string } | null };
  const revisiones = ((revisionesRaw ?? []) as unknown as RevisionRaw[]).map((revision) => ({
    id: revision.id,
    desde: revision.desde,
    hasta: revision.hasta,
    observacion: revision.observacion,
    decisionSiguientePlan: revision.decision_siguiente_plan,
    creadoEn: revision.creado_en,
    entrenadorNombre: nombreAlumnoPublicado(revision.perfiles?.nombre ?? "Entrenador VIP"),
  }));

  return {
    alumnoId,
    alumnoNombre: nombreAlumnoPublicado(perfil.nombre),
    diasPeriodo,
    desde,
    hasta,
    resumen: {
      adherenciaGeneral,
      nivel: nivelDeCumplimiento(adherenciaGeneral),
      entrenamientoPct,
      sesionesRealizadas,
      sesionesEsperadas,
      calidadSesionesPct,
      nutricionPct,
      diasConAlimentacion: diasNutricion.length,
      diasPeriodo,
      kcalPromedio: promedio(diasNutricion.map((dia) => dia.nutricion?.kcal)),
      kcalObjetivo: plan?.kcal_objetivo ?? null,
      proteinaPromedio: promedio(diasNutricion.map((dia) => dia.nutricion?.proteina)),
      proteinaObjetivo: plan?.prot_objetivo ?? null,
      recuperacionPct,
      aguaPromedio: promedio(dias.map((dia) => dia.aguaLitros)),
      suenoPromedio: promedio(dias.map((dia) => dia.suenoHoras)),
      energiaPromedio: promedio(dias.map((dia) => dia.energia)),
      progresionesCumplidas: cumplidas,
      progresionesEvaluadas: evaluadas.length,
    },
    evolucion: {
      pesoInicial: primerPeso,
      pesoActual: ultimoPeso,
      variacionPeso: primerPeso !== null && ultimoPeso !== null ? Math.round((ultimoPeso - primerPeso) * 10) / 10 : null,
      pesosRegistrados: pesosPeriodo.length,
      fotosPeriodo: fotos?.length ?? 0,
      ultimaFoto: fotos?.map((foto) => foto.fecha_foto).sort().at(-1) ?? null,
      medidasPeriodo: medidas?.length ?? 0,
      ultimaMedida: medidas?.map((medida) => medida.fecha).sort().at(-1) ?? null,
    },
    alertas,
    dias,
    revisiones,
  };
}
