import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ultimosNDiasISO } from "@/lib/date";
import { obtenerDocumentos } from "@/app/alumno/documentos/data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const COMIDAS_SLOTS = [
  "Comida 1",
  "Comida 2",
  "Comida 3",
  "Comida 4",
  "Comida 5",
  "Comida 6",
  "Comida adicional",
] as const;

export type EstadoDia = "vacio" | "parcial" | "completo";

export type ComidaPlan = {
  nombre: string;
  hora: string | null;
  kcal: number | null;
  descripcion: string | null;
};

export type PlanAlimentacion = {
  kcalObjetivo: number | null;
  protObjetivo: number | null;
  carbObjetivo: number | null;
  grasaObjetivo: number | null;
  comidas: ComidaPlan[];
} | null;

/** La meta calórica activa del alumno, extraída del PDF de alimentación por
 * el entrenador (Tarea 5). Null si todavía no le publicaron ninguna. */
export async function obtenerPlanAlimentacion(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<PlanAlimentacion> {
  const { data: plan } = await supabase
    .from("planes_alimentacion")
    .select("id, kcal_objetivo, prot_objetivo, carb_objetivo, grasa_objetivo")
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;

  const { data: comidas } = await supabase
    .from("plan_comidas")
    .select("nombre, hora, kcal, descripcion")
    .eq("plan_id", plan.id)
    .order("orden");

  return {
    kcalObjetivo: plan.kcal_objetivo,
    protObjetivo: plan.prot_objetivo,
    carbObjetivo: plan.carb_objetivo,
    grasaObjetivo: plan.grasa_objetivo,
    comidas: (comidas ?? []).map((c) => ({
      nombre: c.nombre,
      // Postgres devuelve "08:00:00"; al alumno le mostramos "08:00".
      hora: c.hora ? String(c.hora).slice(0, 5) : null,
      kcal: c.kcal,
      descripcion: c.descripcion,
    })),
  };
}

export type DocumentoDieta = { nombreArchivo: string; url: string } | null;

/**
 * El PDF de alimentación vigente del alumno, para poder abrirlo desde Comer
 * sin tener que ir a Documentos. Es el mismo archivo que sube el entrenador:
 * cuando la guía viene completa (rutina + dieta en un PDF), `subirGuiaCompleta`
 * la registra también con tipo 'alimentacion', así que acá aparece igual.
 */
export async function obtenerDocumentoDieta(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<DocumentoDieta> {
  // Se reusa la lectura de la pestaña Documentos, que ya resuelve las
  // asignaciones de la migración 0027 y su respaldo al esquema viejo. Evita
  // tener dos consultas distintas que puedan quedar desincronizadas.
  const documentos = await obtenerDocumentos(supabase, alumnoId);
  const dieta = documentos.find((d) => d.tipo === "alimentacion" && d.url);

  if (!dieta?.url) return null;

  return { nombreArchivo: dieta.nombreArchivo, url: dieta.url };
}

export async function obtenerCalendarioMes(
  supabase: SupabaseServerClient,
  alumnoId: string,
  anioMes: string // "YYYY-MM"
): Promise<Record<string, EstadoDia>> {
  const inicio = `${anioMes}-01`;
  const [anio, mes] = anioMes.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anioMes}-${String(ultimoDia).padStart(2, "0")}`;

  // Antes eran 3 consultas encadenadas (registros -> comidas -> alimentos):
  // un round-trip a Supabase de ~95ms cada una. El anidado las junta en una
  // sola ida y vuelta.
  const { data: registros } = await supabase
    .from("registros_diarios")
    .select("id, fecha, comidas_registradas(id, omitida, alimentos_consumidos(comida_id))")
    .eq("alumno_id", alumnoId)
    .gte("fecha", inicio)
    .lte("fecha", fin);

  const resultado: Record<string, EstadoDia> = {};
  for (const r of registros ?? []) {
    const comidas =
      (r.comidas_registradas as unknown as
        | { id: string; omitida: boolean; alimentos_consumidos: { comida_id: string }[] | null }[]
        | null) ?? [];
    const conteo = comidas.filter(
      (c) => c.omitida || (c.alimentos_consumidos && c.alimentos_consumidos.length > 0)
    ).length;
    resultado[r.fecha] = conteo === 0 ? "vacio" : conteo < 3 ? "parcial" : "completo";
  }
  return resultado;
}

export type AlimentoCatalogo = {
  id: string;
  nombre: string;
  categoria: string | null;
  porcionBase: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  /** Medida práctica del alimento ("cucharada", "unidad", "vaso (200 ml)"),
   * null si se mide directamente en su unidad base. */
  medidaNombre: string | null;
  /** Cuántas unidades base equivale 1 medida casera (1 cucharada = 14 g). */
  medidaGramos: number | null;
};

/** Pocos resultados a la vista: en el celular entran sin scroll interno y se
 * eligen de un toque. */
export const LIMITE_BUSQUEDA_ALIMENTOS = 7;

const COLUMNAS_ALIMENTO =
  "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa, medida_nombre, medida_gramos";

// Sin las columnas de la migración 0013, por si todavía no se corrió en la
// base (ya pasó con 0009 y 0010: el código iba adelantado al esquema).
const COLUMNAS_ALIMENTO_BASICAS =
  "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa";

type FilaAlimento = {
  id: string;
  nombre: string;
  categoria: string | null;
  porcion_base: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  medida_nombre?: string | null;
  medida_gramos?: number | null;
};

function aCatalogo(a: FilaAlimento): AlimentoCatalogo {
  return {
    id: a.id,
    nombre: a.nombre,
    categoria: a.categoria,
    porcionBase: a.porcion_base,
    unidad: a.unidad,
    kcal: a.kcal,
    prot: a.prot,
    carb: a.carb,
    grasa: a.grasa,
    medidaNombre: a.medida_nombre ?? null,
    medidaGramos: a.medida_gramos ?? null,
  };
}

/**
 * Busca alimentos por nombre en la base. Con un catálogo de miles de items ya
 * no se puede mandar entero al teléfono ni filtrar en el cliente (Supabase
 * además corta en 1000 filas por consulta), así que la búsqueda vive acá.
 */
export async function buscarAlimentos(
  supabase: SupabaseServerClient,
  texto: string,
  limite = LIMITE_BUSQUEDA_ALIMENTOS
): Promise<AlimentoCatalogo[]> {
  const q = texto.trim();
  if (q.length < 2) return [];

  // El % de PostgREST necesita escape de los comodines que traiga el usuario.
  const escapado = q.replace(/[%_]/g, (c) => `\\${c}`);

  /**
   * Se busca en dos pasadas para que lo que EMPIEZA con lo escrito salga
   * primero. Ordenando solo por nombre, buscar "papa" devolvía "Carne al horno
   * con papas" y "Charquicán de papas" antes que la papa misma, porque la C va
   * antes que la P. Con una sola consulta no alcanza: el alimento buscado puede
   * quedar fuera del límite.
   */
  const consultar = (columnas: string, patron: string, tope: number) =>
    supabase
      .from("alimentos")
      .select(columnas)
      .eq("activo", true)
      .ilike("nombre", patron)
      .order("nombre")
      .limit(tope);

  const buscarCon = async (patron: string, tope: number) => {
    const intento = await consultar(COLUMNAS_ALIMENTO, patron, tope);
    const { data } = intento.error
      ? await consultar(COLUMNAS_ALIMENTO_BASICAS, patron, tope)
      : intento;
    return (data ?? []) as unknown as FilaAlimento[];
  };

  const empiezan = await buscarCon(`${escapado}%`, limite);
  if (empiezan.length >= limite) return empiezan.map(aCatalogo);

  // Se completa con los que lo mencionan en cualquier parte del nombre.
  const contienen = await buscarCon(`%${escapado}%`, limite);
  const yaEstan = new Set(empiezan.map((a) => a.id));

  return [...empiezan, ...contienen.filter((a) => !yaEstan.has(a.id))]
    .slice(0, limite)
    .map(aCatalogo);
}

/** Solo para procesos del servidor que necesitan el catálogo completo (el
 * emparejado del PDF de alimentación). Nunca mandarlo al cliente. */
export async function obtenerCatalogoAlimentos(
  supabase: SupabaseServerClient
): Promise<AlimentoCatalogo[]> {
  const PAGINA = 1000; // tope por consulta de PostgREST
  const filas: FilaAlimento[] = [];

  async function consultarPagina(desde: number, columnas: string) {
    return supabase
      .from("alimentos")
      .select(columnas)
      .eq("activo", true)
      .order("nombre")
      .range(desde, desde + PAGINA - 1);
  }

  let columnas = COLUMNAS_ALIMENTO;
  for (let desde = 0; ; desde += PAGINA) {
    const intento = await consultarPagina(desde, columnas);
    let resultado = intento;
    if (intento.error && columnas === COLUMNAS_ALIMENTO) {
      columnas = COLUMNAS_ALIMENTO_BASICAS;
      resultado = await consultarPagina(desde, columnas);
    }
    const pagina = (resultado.data ?? []) as unknown as FilaAlimento[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }

  return filas.map(aCatalogo);
}

export type AlimentoEnComida = {
  id: string;
  alimentoId: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
};

export type ComidaDia = {
  tipoComida: string;
  comidaId: string | null;
  omitida: boolean;
  observacion: string | null;
  alimentos: AlimentoEnComida[];
  totales: { kcal: number; prot: number; carb: number; grasa: number };
};

export type RegistroDia = {
  comidas: ComidaDia[];
  totalesDia: { kcal: number; prot: number; carb: number; grasa: number };
};

export async function obtenerRegistroDia(
  supabase: SupabaseServerClient,
  alumnoId: string,
  fecha: string
): Promise<RegistroDia> {
  const vacio = (tipo: string): ComidaDia => ({
    tipoComida: tipo,
    comidaId: null,
    omitida: false,
    observacion: null,
    alimentos: [],
    totales: { kcal: 0, prot: 0, carb: 0, grasa: 0 },
  });

  const { data: registro } = await supabase
    .from("registros_diarios")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (!registro) {
    return {
      comidas: COMIDAS_SLOTS.map((s) => vacio(s)),
      totalesDia: { kcal: 0, prot: 0, carb: 0, grasa: 0 },
    };
  }

  const { data: comidasDb } = await supabase
    .from("comidas_registradas")
    .select("id, tipo_comida, omitida, observacion")
    .eq("registro_diario_id", registro.id);

  const comidaIds = (comidasDb ?? []).map((c) => c.id);
  const { data: consumidos } = comidaIds.length
    ? await supabase
        .from("alimentos_consumidos")
        .select("id, comida_id, alimento_id, cantidad, unidad, alimentos(nombre, kcal, prot, carb, grasa, porcion_base)")
        .in("comida_id", comidaIds)
    : { data: [] };

  const alimentosPorComida = new Map<string, AlimentoEnComida[]>();
  for (const c of consumidos ?? []) {
    const a = c.alimentos as unknown as {
      nombre: string;
      kcal: number;
      prot: number;
      carb: number;
      grasa: number;
      porcion_base: number;
    } | null;
    if (!a) continue;
    const factor = c.cantidad / a.porcion_base;
    const arr = alimentosPorComida.get(c.comida_id) ?? [];
    arr.push({
      id: c.id,
      alimentoId: c.alimento_id,
      nombre: a.nombre,
      cantidad: c.cantidad,
      unidad: c.unidad,
      kcal: a.kcal * factor,
      prot: a.prot * factor,
      carb: a.carb * factor,
      grasa: a.grasa * factor,
    });
    alimentosPorComida.set(c.comida_id, arr);
  }

  const comidaPorTipo = new Map((comidasDb ?? []).map((c) => [c.tipo_comida, c]));

  const comidas: ComidaDia[] = COMIDAS_SLOTS.map((tipo) => {
    const c = comidaPorTipo.get(tipo);
    if (!c) return vacio(tipo);
    const alimentos = alimentosPorComida.get(c.id) ?? [];
    const totales = alimentos.reduce(
      (acc, a) => ({
        kcal: acc.kcal + a.kcal,
        prot: acc.prot + a.prot,
        carb: acc.carb + a.carb,
        grasa: acc.grasa + a.grasa,
      }),
      { kcal: 0, prot: 0, carb: 0, grasa: 0 }
    );
    return {
      tipoComida: tipo,
      comidaId: c.id,
      omitida: c.omitida,
      observacion: c.observacion,
      alimentos,
      totales,
    };
  });

  const totalesDia = comidas.reduce(
    (acc, c) => ({
      kcal: acc.kcal + c.totales.kcal,
      prot: acc.prot + c.totales.prot,
      carb: acc.carb + c.totales.carb,
      grasa: acc.grasa + c.totales.grasa,
    }),
    { kcal: 0, prot: 0, carb: 0, grasa: 0 }
  );

  return { comidas, totalesDia };
}

export type ResumenDiaComidas = {
  fecha: string;
  estado: EstadoDia;
  kcal: number;
};

/** Resumen de los últimos `dias` días (incluye los sin registro) para que el
 * entrenador vea kcal consumidas y detecte huecos, sin repetir el detalle
 * completo de cada comida. */
export async function obtenerResumenComidas(
  supabase: SupabaseServerClient,
  alumnoId: string,
  dias = 14
): Promise<ResumenDiaComidas[]> {
  const fechas = ultimosNDiasISO(dias);
  const desde = fechas[fechas.length - 1];
  const hasta = fechas[0];

  // Igual que en obtenerCalendarioMes: un solo select anidado en vez de 3
  // consultas encadenadas (registros -> comidas -> alimentos).
  const { data: registros } = await supabase
    .from("registros_diarios")
    .select(
      "fecha, comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, porcion_base)))"
    )
    .eq("alumno_id", alumnoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const porFecha = new Map<string, { kcal: number; atendidas: number }>();
  for (const r of registros ?? []) {
    const comidas =
      (r.comidas_registradas as unknown as
        | {
            omitida: boolean;
            alimentos_consumidos:
              | { cantidad: number; alimentos: { kcal: number; porcion_base: number } | null }[]
              | null;
          }[]
        | null) ?? [];

    let kcal = 0;
    for (const c of comidas) {
      if (c.omitida) continue;
      for (const a of c.alimentos_consumidos ?? []) {
        if (!a.alimentos) continue;
        kcal += (a.cantidad / a.alimentos.porcion_base) * a.alimentos.kcal;
      }
    }
    porFecha.set(r.fecha, { kcal, atendidas: comidas.length });
  }

  return fechas.map((fecha) => {
    const acc = porFecha.get(fecha) ?? { kcal: 0, atendidas: 0 };
    const estado: EstadoDia = acc.atendidas === 0 ? "vacio" : acc.atendidas < 3 ? "parcial" : "completo";
    return { fecha, estado, kcal: Math.round(acc.kcal) };
  });
}
