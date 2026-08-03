import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rangoDePuntos } from "@/lib/ranking/puntos";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { hoyISO } from "@/lib/date";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * La fila de `alumno_perfil` que el layout de /alumno/* necesita en cada
 * carga. Antes se leía tres veces por página: una para el globito de
 * noticias, otra para el anuncio importante y otra para el tema del botón.
 * Con `cache()` la fila viaja una sola vez por request.
 */
export const obtenerPerfilNoticias = cache(async (alumnoId: string) => {
  const supabase = await createClient();
  return supabase
    .from("alumno_perfil")
    .select("noticias_vistas_en, tema_boton")
    .eq("user_id", alumnoId)
    .maybeSingle();
});

export type TipoNoticia =
  | "peso"
  | "torneo"
  | "rango"
  | "asistencia"
  | "reconocimiento"
  | "bienvenida"
  | "cumpleanos";

export type Anuncio = {
  id: string;
  titulo: string;
  mensaje: string;
  importante: boolean;
  creadoEn: string;
};

export type BorradorNoticia = {
  id: string;
  titulo: string;
  mensaje: string;
  generadoConIA: boolean;
  creadoEn: string;
};

export async function obtenerBorradoresNoticias(
  supabase: SupabaseServerClient
): Promise<BorradorNoticia[]> {
  const { data, error } = await supabase
    .from("borradores_noticias")
    .select("id, titulo, mensaje, generado_con_ia, created_at")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []).map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    mensaje: fila.mensaje,
    generadoConIA: fila.generado_con_ia,
    creadoEn: fila.created_at,
  }));
}

/** Anuncios que el entrenador escribió a mano (no generados automáticamente),
 * los más nuevos primero. */
export async function obtenerAnuncios(supabase: SupabaseServerClient): Promise<Anuncio[]> {
  const { data } = await supabase
    .from("anuncios")
    .select("id, titulo, mensaje, importante, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    mensaje: a.mensaje,
    importante: a.importante,
    creadoEn: a.created_at,
  }));
}

/** El anuncio importante más nuevo que el alumno todavía no vio, si hay uno
 * — dispara la burbuja flotante (más agresiva que el punto rojo del menú). */
export async function obtenerAnuncioImportanteSinVer(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<Anuncio | null> {
  const [{ data: perfil }, { data: anuncio }] = await Promise.all([
    obtenerPerfilNoticias(alumnoId),
    supabase
      .from("anuncios")
      .select("id, titulo, mensaje, importante, created_at")
      .eq("importante", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!anuncio) return null;
  if (perfil?.noticias_vistas_en && new Date(anuncio.created_at) <= new Date(perfil.noticias_vistas_en)) {
    return null;
  }

  return {
    id: anuncio.id,
    titulo: anuncio.titulo,
    mensaje: anuncio.mensaje,
    importante: anuncio.importante,
    creadoEn: anuncio.created_at,
  };
}

/**
 * Cuántas novedades hay desde la última visita del alumno a Noticias.
 * Es el número del globito estilo WhatsApp: suma anuncios, torneos creados o
 * cerrados, reconocimientos y noticias del sistema publicados después de
 * `noticias_vistas_en`. Si nunca entró, cuenta todo lo que exista.
 */
export async function contarNoticiasSinVer(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<number> {
  const { data: perfil, error } = await obtenerPerfilNoticias(alumnoId);

  // Si no se puede leer la marca de visita, devolver "todo sin ver" dejaría el
  // globito encendido para siempre y sin manera de apagarlo. Se avisa fuerte y
  // se muestra 0, que es el error menos molesto.
  if (error) {
    console.error("[noticias] no se pudo leer noticias_vistas_en:", error.message);
    return 0;
  }

  const desde = perfil?.noticias_vistas_en ?? null;
  const soloNuevas = <T extends { gt: (col: string, val: string) => T }>(q: T, columna: string) =>
    desde ? q.gt(columna, desde) : q;

  const [anuncios, torneosCreados, torneosCerrados, reconocimientos, delSistema] = await Promise.all(
    [
      soloNuevas(
        supabase.from("anuncios").select("id", { count: "exact", head: true }),
        "created_at"
      ),
      soloNuevas(
        supabase.from("torneos").select("id", { count: "exact", head: true }),
        "created_at"
      ),
      soloNuevas(
        supabase
          .from("torneos")
          .select("id", { count: "exact", head: true })
          .not("cerrado_en", "is", null),
        "cerrado_en"
      ),
      soloNuevas(
        supabase.from("reconocimientos_semanales").select("id", { count: "exact", head: true }),
        "created_at"
      ),
      soloNuevas(
        supabase.from("noticias_sistema").select("id", { count: "exact", head: true }),
        "created_at"
      ),
    ]
  );

  return [anuncios, torneosCreados, torneosCerrados, reconocimientos, delSistema].reduce(
    (total, r) => total + (r.count ?? 0),
    0
  );
}

/**
 * Marca que el alumno ya vio Noticias hasta ahora — se llama al abrir la
 * página, apaga el globito. Devuelve false si no se pudo guardar: tragarse
 * este error en silencio fue justo lo que hizo que el globito quedara
 * encendido para siempre cuando faltaba la columna en la base.
 */
export async function marcarNoticiasVistas(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("alumno_perfil")
    .update({ noticias_vistas_en: new Date().toISOString() })
    .eq("user_id", alumnoId);

  if (error) {
    console.error("[noticias] no se pudo marcar como vistas:", error.message);
    return false;
  }
  return true;
}

export type Noticia = {
  id: string;
  tipo: TipoNoticia;
  /** "2026-07" — el mes al que pertenece la noticia. */
  mes: string;
  fecha: string;
  titular: string;
  detalle: string;
  alumnoNombre: string;
  /** Las más importantes van primero y se muestran destacadas. */
  relevancia: number;
};

/** Hacia dónde quiere ir el alumno, deducido de su objetivo escrito. */
type Direccion = "bajar" | "subir" | "desconocida";

const CLAVES_BAJAR = ["bajar", "perder", "adelgaz", "definir", "definicion", "quemar", "reducir"];
const CLAVES_SUBIR = ["subir", "ganar", "masa", "volumen", "aumentar", "hipertrofia"];

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Un cambio de peso solo es noticia si va en la dirección que el alumno
 * buscaba. Si su objetivo no dice claramente hacia dónde va (ej.
 * "recomposición corporal" o "mejorar condición física"), NO se publica nada:
 * es preferible callar antes que felicitar a alguien por engordar cuando
 * quería adelgazar.
 */
export function direccionObjetivo(objetivo: string | null): Direccion {
  if (!objetivo) return "desconocida";
  const o = normalizar(objetivo);
  const bajar = CLAVES_BAJAR.some((c) => o.includes(c));
  const subir = CLAVES_SUBIR.some((c) => o.includes(c));
  if (bajar && !subir) return "bajar";
  if (subir && !bajar) return "subir";
  return "desconocida";
}

const mesDe = (fechaISO: string) => fechaISO.slice(0, 7);

const KG_NOTICIA = 2; // cambio mínimo en el mes para que valga la pena contarlo

/**
 * Arma las noticias del gimnasio a partir de lo que ya pasó: cambios de peso
 * alineados al objetivo, torneos ganados y subidas de rango. No hay tabla de
 * noticias — se generan al vuelo, así que si un dato se corrige, la noticia se
 * corrige sola. Devuelve un mapa mes → noticias, del mes más reciente al más
 * antiguo.
 */
export async function obtenerNoticias(
  supabase: SupabaseServerClient,
  mesesHaciaAtras = 12
): Promise<Map<string, Noticia[]>> {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - mesesHaciaAtras + 1, 1);
  const desdeISO = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: perfiles },
    { data: eventosSistema },
    { data: objetivos },
    { data: pesos },
    { data: torneos },
    { data: movimientosPuntos },
    { data: reconocimientos },
  ] = await Promise.all([
      supabase.from("perfiles").select("id, nombre").eq("rol", "alumno"),
      supabase
        .from("noticias_sistema")
        .select(
          "id, tipo, alumno_id, created_at, perfiles!noticias_sistema_alumno_id_fkey(nombre)"
        )
        .gte("created_at", `${desdeISO}T00:00:00Z`)
        .order("created_at", { ascending: false }),
      supabase.from("alumno_perfil").select("user_id, objetivo"),
      supabase
        .from("pesos_corporales")
        .select("alumno_id, fecha, peso_kg")
        .gte("fecha", desdeISO)
        .order("fecha", { ascending: true }),
      supabase
        .from("torneos")
        .select(
          "id, nombre, descripcion, fecha_inicio, fecha_fin, puntos_en_juego, created_at, cerrado, cerrado_en, torneo_resultados(resultados)"
        )
        .or(`created_at.gte.${desdeISO}T00:00:00Z,fecha_fin.gte.${desdeISO}`),
      supabase
        .from("puntos_vip_movimientos")
        .select("id, alumno_id, fecha, puntos")
        .gt("puntos", 0)
        .order("fecha", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("reconocimientos_semanales")
        .select(
          "id, semana_inicio, alumno_id, categoria, titulo, mensaje, created_at, perfiles!reconocimientos_semanales_alumno_id_fkey(nombre)"
        )
        .gte("created_at", `${desdeISO}T00:00:00Z`)
        .order("created_at", { ascending: false }),
    ]);

  const nombres = new Map(
    (perfiles ?? []).map((p) => [p.id, nombreAlumnoPublicado(p.nombre)])
  );
  const direccionPorAlumno = new Map(
    (objetivos ?? []).map((o) => [o.user_id, direccionObjetivo(o.objetivo)])
  );

  const noticias: Noticia[] = [];

  // ── 1. Nuevos integrantes ──
  // Pedido explícito: Noticias queda solo con lo que publica el entrenador,
  // Arena, progreso destacado y rango destacado — la bienvenida automática de
  // "nuevo alumno" ya no se muestra acá. La fila en `noticias_sistema` (tipo
  // 'bienvenida') se sigue escribiendo igual en admin/alumnos/actions.ts y
  // admin/solicitudes/actions.ts —no se tocó esa parte—, por si se necesita
  // reactivar esta sección más adelante sin perder el historial.

  // ── 1.5. Cumpleaños detectados automáticamente ──
  for (const evento of eventosSistema ?? []) {
    if (evento.tipo !== "cumpleanos" || !evento.alumno_id) continue;
    const nombre =
      nombreAlumnoPublicado(
        (evento.perfiles as unknown as { nombre: string } | null)?.nombre ?? ""
      ) || nombres.get(evento.alumno_id);
    if (!nombre) continue;
    const fecha = evento.created_at.slice(0, 10);
    noticias.push({
      id: `cumpleanos-${evento.id}`,
      tipo: "cumpleanos",
      mes: mesDe(fecha),
      fecha,
      titular: `¡Feliz cumpleaños, ${nombre}!`,
      detalle: "Todo el equipo de VIP Fitness le desea un muy feliz cumpleaños. ¡Que este nuevo año esté lleno de logros!",
      alumnoNombre: nombre,
      relevancia: 95,
    });
  }

  // ── 2. Reconocimientos semanales seleccionados por el sistema + IA ──
  for (const reconocimiento of reconocimientos ?? []) {
    const nombre =
      nombreAlumnoPublicado(
        (reconocimiento.perfiles as unknown as { nombre: string } | null)?.nombre ?? ""
      ) ||
      nombres.get(reconocimiento.alumno_id);
    if (!nombre) continue;
    const fecha = reconocimiento.created_at.slice(0, 10);
    noticias.push({
      id: `reconocimiento-${reconocimiento.id}`,
      tipo: "reconocimiento",
      mes: mesDe(fecha),
      fecha,
      titular: `${nombre}: ${reconocimiento.titulo}`,
      detalle: reconocimiento.mensaje,
      alumnoNombre: nombre,
      relevancia: 80,
    });
  }

  // ── 3. Cambios de peso, solo si van hacia donde el alumno quería ──
  const pesosPorAlumnoMes = new Map<string, Map<string, { fecha: string; peso: number }[]>>();
  for (const p of pesos ?? []) {
    const porMes = pesosPorAlumnoMes.get(p.alumno_id) ?? new Map<string, { fecha: string; peso: number }[]>();
    const mes = mesDe(p.fecha);
    const lista = porMes.get(mes) ?? [];
    lista.push({ fecha: p.fecha, peso: p.peso_kg });
    porMes.set(mes, lista);
    pesosPorAlumnoMes.set(p.alumno_id, porMes);
  }

  for (const [alumnoId, porMes] of pesosPorAlumnoMes) {
    const direccion = direccionPorAlumno.get(alumnoId) ?? "desconocida";
    if (direccion === "desconocida") continue;

    const nombre = nombres.get(alumnoId);
    if (!nombre) continue;

    for (const [mes, registros] of porMes) {
      if (registros.length < 2) continue;

      const inicial = registros[0].peso;
      const final = registros[registros.length - 1].peso;
      const cambio = Math.round((final - inicial) * 10) / 10;

      const esLogro =
        (direccion === "bajar" && cambio <= -KG_NOTICIA) ||
        (direccion === "subir" && cambio >= KG_NOTICIA);
      if (!esLogro) continue;

      const magnitud = Math.abs(cambio);
      noticias.push({
        id: `peso-${alumnoId}-${mes}`,
        tipo: "peso",
        mes,
        fecha: registros[registros.length - 1].fecha,
        titular:
          direccion === "bajar"
            ? `${nombre} bajó ${magnitud} kg este mes`
            : `${nombre} ganó ${magnitud} kg este mes`,
        detalle:
          direccion === "bajar"
            ? `Pasó de ${inicial} a ${final} kg, cumpliendo su objetivo de bajar de peso.`
            : `Pasó de ${inicial} a ${final} kg, sumando masa como se propuso.`,
        alumnoNombre: nombre,
        relevancia: magnitud >= 5 ? 100 : 70,
      });
    }
  }

  // ── 4. Torneos creados y resultados ──
  type ResultadoTorneo = { alumnoId: string; nombre: string; valor: number; puesto: number };

  for (const torneo of torneos ?? []) {
    const fechaCreacion = torneo.created_at.slice(0, 10);
    noticias.push({
      id: `torneo-nuevo-${torneo.id}`,
      tipo: "torneo",
      mes: mesDe(fechaCreacion),
      fecha: fechaCreacion,
      titular: `Nuevo torneo: ${torneo.nombre}`,
      detalle:
        `Bolsa VIP de ${torneo.puntos_en_juego.toLocaleString("es-CL")} puntos · ` +
        `${torneo.fecha_inicio} al ${torneo.fecha_fin}` +
        (torneo.descripcion ? ` · ${torneo.descripcion}` : ""),
      alumnoNombre: "VIP Fitness",
      relevancia: 75,
    });

    if (!torneo.cerrado) continue;

    const bruto = torneo.torneo_resultados as unknown;
    const snapshot = Array.isArray(bruto) ? bruto[0] : bruto;
    const resultados = (snapshot as { resultados?: ResultadoTorneo[] } | null)?.resultados;
    if (!resultados || resultados.length === 0) continue;

    const ganador = resultados.find((r) => r.puesto === 1);
    if (!ganador) continue;

    const fechaResultado = torneo.cerrado_en?.slice(0, 10) ?? torneo.fecha_fin;
    noticias.push({
      id: `torneo-${torneo.id}`,
      tipo: "torneo",
      mes: mesDe(fechaResultado),
      fecha: fechaResultado,
      titular: `${nombreAlumnoPublicado(ganador.nombre)} ganó ${torneo.nombre}`,
      detalle:
        resultados.length > 1
          ? `Se impuso entre ${resultados.length} participantes.`
          : "Completó el desafío.",
      alumnoNombre: nombreAlumnoPublicado(ganador.nombre),
      relevancia: 90,
    });
  }

  // ── 5. Subidas de rango sobre el acumulado semana a semana ──
  const acumulado = new Map<string, number>();
  for (const movimiento of movimientosPuntos ?? []) {
    const previo = acumulado.get(movimiento.alumno_id) ?? 0;
    const nuevo = previo + movimiento.puntos;
    acumulado.set(movimiento.alumno_id, nuevo);

    const nombre = nombres.get(movimiento.alumno_id);
    if (!nombre) continue;

    const rangoPrevio = rangoDePuntos(previo);
    const rangoNuevo = rangoDePuntos(nuevo);
    if (rangoPrevio.nombre === rangoNuevo.nombre) continue;
    if (movimiento.fecha < desdeISO) continue;

    noticias.push({
      id: `rango-${movimiento.id}`,
      tipo: "rango",
      mes: mesDe(movimiento.fecha),
      fecha: movimiento.fecha,
      titular: `${nombre} alcanzó el rango ${rangoNuevo.nombre}`,
      detalle: `Subió desde ${rangoPrevio.nombre} con ${nuevo.toLocaleString("es-CL")} puntos acumulados.`,
      alumnoNombre: nombre,
      relevancia: rangoNuevo.nombre === "Olympian VIP" ? 120 : 85,
    });
  }

  // ── Agrupado por mes, lo más relevante primero ──
  const porMes = new Map<string, Noticia[]>();
  for (const noticia of noticias) {
    const lista = porMes.get(noticia.mes) ?? [];
    lista.push(noticia);
    porMes.set(noticia.mes, lista);
  }
  for (const lista of porMes.values()) {
    lista.sort((a, b) => b.relevancia - a.relevancia || b.fecha.localeCompare(a.fecha));
  }

  return new Map([...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])));
}

export type CumpleaneroHoy = { alumnoId: string; nombre: string };

/**
 * Alumnos cuyo cumpleaños (día y mes de `fecha_nacimiento`) es hoy, en el
 * huso horario del gimnasio. Cálculo en vivo, sin depender de que la noticia
 * ya se haya guardado.
 */
export async function obtenerAlumnosDeCumpleanosHoy(
  supabase: SupabaseServerClient
): Promise<CumpleaneroHoy[]> {
  const hoyMesDia = hoyISO().slice(5); // "MM-DD"

  const { data } = await supabase
    .from("alumno_perfil")
    .select("user_id, fecha_nacimiento, perfiles!alumno_perfil_user_id_fkey(nombre)")
    .not("fecha_nacimiento", "is", null);

  return (data ?? [])
    .filter((a) => a.fecha_nacimiento && a.fecha_nacimiento.slice(5) === hoyMesDia)
    .map((a) => ({
      alumnoId: a.user_id,
      nombre: nombreAlumnoPublicado(
        (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"
      ),
    }));
}

/**
 * Quiénes cumplen años hoy. Es la función que hay que usar siempre: va con
 * service role a propósito, igual que las noticias de cumpleaños.
 *
 * Con el cliente de sesión NO sirve: la política `alumno_perfil_select`
 * (migración 0001) es `user_id = auth.uid() or es_entrenador_de(user_id)`, así
 * que un alumno normal solo puede leer SU PROPIA fila. Leyendo así, el aviso
 * flotante nunca podía mostrarle el cumpleaños de un compañero — solo el
 * suyo — cuando el texto del componente ("Hoy es el cumpleaños de X") está
 * escrito justamente para el caso contrario.
 *
 * Además se cachea por día: la lectura recorre `alumno_perfil` entera, es el
 * mismo dato para todos los alumnos y solo cambia a medianoche. La fecha va en
 * la clave, así que al cambiar el día se recalcula sola.
 */
export const obtenerCumpleanerosDeHoy = unstable_cache(
  async (_fechaHoy: string): Promise<CumpleaneroHoy[]> => {
    const admin = createAdminClient();
    return obtenerAlumnosDeCumpleanosHoy(admin);
  },
  ["cumpleaneros-de-hoy"],
  { revalidate: 3600 }
);

/**
 * Deja registrado en noticias_sistema el cumpleaños de hoy de cada alumno que
 * corresponda, para que aparezca en la sección de Noticias — idempotente por
 * alumno y año (clave_origen), así que no importa cuántas veces se llame en
 * el mismo día. Usa la service role porque cualquier alumno debe ver la
 * noticia de cumpleaños de cualquier otro, no solo la propia.
 */
export async function asegurarNoticiasCumpleanosHoy(): Promise<void> {
  const cumpleaneros = await obtenerCumpleanerosDeHoy(hoyISO());
  // La mayoría de los días no cumple nadie: acá se corta sin escribir nada.
  if (cumpleaneros.length === 0) return;

  const admin = createAdminClient();

  const anio = hoyISO().slice(0, 4);
  await admin.from("noticias_sistema").upsert(
    cumpleaneros.map((c) => ({
      clave_origen: `cumpleanos:${c.alumnoId}:${anio}`,
      tipo: "cumpleanos" as const,
      alumno_id: c.alumnoId,
    })),
    { onConflict: "clave_origen", ignoreDuplicates: true }
  );
}
