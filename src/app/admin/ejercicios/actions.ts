"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { TAG_BIBLIOTECA_EJERCICIOS } from "@/lib/ejercicios/data";
import { TAG_TECNICAS_ENTRENAMIENTO } from "@/lib/generador-rutinas/data";
import { idDeYoutube } from "@/lib/ejercicios/video";
import {
  bufferAImagenBlob,
  hashearImagen,
  procesarImagen,
  TAMANO_MAXIMO_FOTO as TAMANO_MAXIMO,
  TIPOS_IMAGEN,
} from "@/lib/ejercicios/procesarFoto";
import type {
  CategoriaEjercicio,
  EquipoEjercicio,
  NivelEjercicio,
  IntensidadImpulsoEjercicio,
  TecnicaImpulsoEjercicio,
} from "@/lib/ejercicios/tipos";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import { PATRONES_MOVIMIENTO_VALIDOS } from "@/lib/rutinas/patrones";
import {
  consultarVideoCloudflare,
  eliminarVideoCloudflare,
  solicitarSubidaDirecta,
} from "@/lib/cloudflare/stream";
import { normalizar } from "@/lib/alimentos/emparejar";
import { archivarVideoReemplazado, registrarFotoPrincipal } from "./multimediaActions";

/** Bloquea que el link pegado apunte a la red interna del servidor (SSRF) —
 * localhost, IPs privadas, o el endpoint de metadata de la nube. El link lo
 * pega un entrenador/admin ya autenticado, no un desconocido, pero igual no
 * cuesta nada chequearlo antes de que el servidor le haga un fetch (imagen o
 * video, se usa para las dos cosas). */
function esUrlExternaSegura(valor: string): URL | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const patronesBloqueados = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // incluye el endpoint de metadata de la nube (169.254.169.254)
    /^\[?::1\]?$/,
  ];
  if (patronesBloqueados.some((p) => p.test(host))) return null;

  return url;
}

/** Descarga una imagen desde un link pegado a mano, como alternativa a subir
 * un archivo — pensado para cuando el selector de archivos del celular da
 * problemas (ver ModalSubirFoto): si ya tenés la foto en otro lado (Drive,
 * una nota, otra app), pegar el link la evita por completo. */
async function descargarImagenDeUrl(valor: string): Promise<{ bytes: Buffer } | { error: string }> {
  const url = esUrlExternaSegura(valor);
  if (!url) return { error: "Ese link no es válido." };

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return { error: "No se pudo descargar esa imagen — revisá el link." };
  }
  if (!respuesta.ok) return { error: "No se pudo descargar esa imagen — revisá el link." };

  const contentType = respuesta.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return { error: "Ese link no apunta a una imagen." };

  const arrayBuffer = await respuesta.arrayBuffer();
  if (arrayBuffer.byteLength === 0) return { error: "Ese link no apunta a una imagen." };
  if (arrayBuffer.byteLength > TAMANO_MAXIMO) return { error: "La imagen pesa demasiado (máx. 15 MB)." };

  return { bytes: Buffer.from(arrayBuffer) };
}

/** Refresco manual de la biblioteca y las técnicas.
 *
 * La biblioteca se cachea 1 hora (ver `obtenerBiblioteca`), y ese caché solo
 * se invalida cuando el cambio pasa por una Server Action. Cuando el
 * entrenador edita la tabla directo en Supabase —cargar máquinas nuevas,
 * desactivar las que el gimnasio no tiene, agregar una técnica— nada avisa, y
 * el generador sigue armando rutinas con el catálogo viejo hasta una hora
 * después. Este botón cierra ese hueco. */
export async function refrescarCatalogo(): Promise<{ ok: boolean }> {
  await requireRol(["entrenador", "admin"]);
  revalidateTag(TAG_BIBLIOTECA_EJERCICIOS, { expire: 0 });
  revalidateTag(TAG_TECNICAS_ENTRENAMIENTO, { expire: 0 });
  revalidatePath("/admin/generador");
  revalidatePath("/admin/armar-rutina");
  revalidatePath("/admin/ejercicios");
  revalidatePath("/alumno/entrenar");
  return { ok: true };
}

function avisarCambios() {
  // Mismo aviso que usa cualquier edición de la biblioteca (ver
  // src/lib/ejercicios/data.ts): sin esto el cambio tarda hasta 1h en
  // aparecer para los alumnos, por el cacheo de `obtenerBiblioteca`.
  revalidateTag(TAG_BIBLIOTECA_EJERCICIOS, { expire: 0 });
  revalidatePath("/admin/ejercicios");
  revalidatePath("/admin/armar-rutina");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/entrenar/[id]", "page");
}

export type SubirFotoState = { error: string | null; ok: boolean };

/**
 * Vincula (o reemplaza) la foto de un ejercicio ya existente en la
 * biblioteca. Tres orígenes posibles para la foto, en este orden de
 * prioridad:
 *   1. `foto_miniatura_url_subida`/`foto_completa_url_subida` — ya subida
 *      directamente por el navegador a Supabase Storage (camino normal).
 *   2. `foto` — un archivo mandado directo (respaldo, por si el paso 1
 *      fallara del lado del cliente).
 *   3. `foto_url` — un link pegado a mano, para descargar server-side.
 */
export async function subirFotoEjercicio(
  _prevState: SubirFotoState,
  formData: FormData
): Promise<SubirFotoState> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const archivo = formData.get("foto") as File | null;
  const fotoUrl = String(formData.get("foto_url") || "").trim();
  const miniaturaUrlSubida = String(formData.get("foto_miniatura_url_subida") || "").trim();
  const completaUrlSubida = String(formData.get("foto_completa_url_subida") || "").trim();
  const numeroEncuadre = (nombre: string) => {
    // Carga masiva y "Ejercicio nuevo" nunca mandan estos campos: sin este
    // chequeo, `Number(null)` da 0 (finito), así que el fallback a 50 nunca
    // se activaba y toda foto subida por esos caminos quedaba encuadrada en
    // la esquina superior izquierda para todos los alumnos.
    const crudo = formData.get(nombre);
    if (crudo === null || crudo === "") return 50;
    const valor = Number(crudo);
    return Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : 50;
  };
  const encuadre = {
    foto_panorama_x: numeroEncuadre("foto_panorama_x"),
    foto_panorama_y: numeroEncuadre("foto_panorama_y"),
    foto_cuadrada_x: numeroEncuadre("foto_cuadrada_x"),
    foto_cuadrada_y: numeroEncuadre("foto_cuadrada_y"),
  };

  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  // Se guardan las rutas viejas ANTES de tocar nada, para poder borrarlas al
  // final si esto resulta ser un reemplazo (no la primera foto). Sin esto,
  // cada reemplazo deja el archivo anterior huérfano en Storage para
  // siempre — el nombre/carpeta siempre es nuevo, así que nunca se pisa solo.
  const { data: fotoAnterior } = await supabase
    .from("ejercicios")
    .select("foto_miniatura_url, foto_completa_url, foto_panorama_x, foto_panorama_y, foto_cuadrada_x, foto_cuadrada_y")
    .eq("id", ejercicioId)
    .maybeSingle();

  let urlMini = "";
  let urlCompleta = "";
  // El camino normal (subida directa navegador → Storage) calcula su propio
  // hash del lado del cliente, porque ahí nunca pasa por procesarImagen acá
  // — sin esto, "duplicado exacto" (ver Calidad) solo detectaría el camino
  // de respaldo (archivo/link), que casi nunca se usa en la práctica.
  let fotoHash: string | null = String(formData.get("foto_hash_cliente") || "").trim() || null;
  const reemplazoFoto = !!(
    (miniaturaUrlSubida && completaUrlSubida) ||
    (archivo && archivo.size > 0) ||
    fotoUrl
  );

  if (miniaturaUrlSubida && completaUrlSubida) {
    urlMini = miniaturaUrlSubida;
    urlCompleta = completaUrlSubida;
  } else {
    let bytes: Buffer;
    if (archivo && archivo.size > 0) {
      if (archivo.size > TAMANO_MAXIMO) return { error: "La foto pesa demasiado (máx. 15 MB).", ok: false };
      if (archivo.type && !TIPOS_IMAGEN.has(archivo.type)) {
        return { error: "Formato no soportado — subí una foto JPG, PNG o HEIC.", ok: false };
      }
      bytes = Buffer.from(await archivo.arrayBuffer());
    } else if (fotoUrl) {
      const resultado = await descargarImagenDeUrl(fotoUrl);
      if ("error" in resultado) return { error: resultado.error, ok: false };
      bytes = resultado.bytes;
    } else if (fotoAnterior?.foto_miniatura_url && fotoAnterior.foto_completa_url) {
      urlMini = fotoAnterior.foto_miniatura_url;
      urlCompleta = fotoAnterior.foto_completa_url;
      bytes = Buffer.alloc(0);
    } else {
      return { error: "Elegí una foto o pegá un link.", ok: false };
    }

    if (reemplazoFoto) {
      const procesada = await procesarImagen(bytes);
      if ("error" in procesada) return { error: procesada.error, ok: false };
      fotoHash = hashearImagen(procesada.miniatura);

    // Timestamp en el nombre: fuerza a que sea una URL nueva cada vez que se
    // reemplaza la foto, así el navegador del alumno no sigue mostrando la
    // vieja desde caché con la URL de siempre.
      const sello = Date.now();
      const rutaMini = `${ejercicioId}/miniatura-${sello}.webp`;
      const rutaCompleta = `${ejercicioId}/completa-${sello}.webp`;

      const [subeMini, subeCompleta] = await Promise.all([
        supabase.storage
          .from("ejercicios-fotos")
          .upload(rutaMini, bufferAImagenBlob(procesada.miniatura), { contentType: "image/webp" }),
        supabase.storage
          .from("ejercicios-fotos")
          .upload(rutaCompleta, bufferAImagenBlob(procesada.completa), { contentType: "image/webp" }),
      ]);
      if (subeMini.error || subeCompleta.error) {
        return { error: "No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.", ok: false };
      }

      urlMini = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaMini).data.publicUrl;
      urlCompleta = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaCompleta).data.publicUrl;
    }
  }

  // foto_hash solo se toca cuando de verdad hay una foto nueva — omitirlo en
  // el resto de los casos (p. ej. un resave que solo ajusta el encuadre)
  // evita pisar con `null` el hash de una foto que no cambió.
  const datosHash = reemplazoFoto && fotoHash ? { foto_hash: fotoHash } : {};

  let { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({ foto_miniatura_url: urlMini, foto_completa_url: urlCompleta, ...encuadre, ...datosHash })
    .eq("id", ejercicioId);

  // Un preview puede desplegarse unos minutos antes que la migraciÃ³n 0048.
  // En ese intervalo, reemplazar una foto debe seguir funcionando como antes;
  // solamente el nuevo encuadre espera a que existan sus columnas.
  if (errorUpdate?.code === "42703" && reemplazoFoto) {
    const respaldo = await supabase
      .from("ejercicios")
      .update({ foto_miniatura_url: urlMini, foto_completa_url: urlCompleta })
      .eq("id", ejercicioId);
    errorUpdate = respaldo.error;
  }

  if (errorUpdate) {
    return { error: "La foto se subió pero no se pudo guardar en el ejercicio.", ok: false };
  }

  // Recién ahora, con la foto nueva ya guardada y confirmada en la fila del
  // ejercicio, se resuelve qué pasa con los archivos viejos — best-effort: si
  // algo de esto falla (permisos, ya no existían), la foto nueva ya quedó
  // bien de todos modos, no tiene sentido devolver error por un archivo
  // huérfano.
  const rutaMiniNueva = urlMini.split("/ejercicios-fotos/")[1];
  const rutaCompletaNueva = urlCompleta.split("/ejercicios-fotos/")[1];
  const rutasViejas = [fotoAnterior?.foto_miniatura_url, fotoAnterior?.foto_completa_url]
    .filter((url): url is string => !!url)
    .map((url) => url.split("/ejercicios-fotos/")[1])
    .filter((ruta): ruta is string => !!ruta && ruta !== rutaMiniNueva && ruta !== rutaCompletaNueva);

  // En vez de borrar la foto vieja de una, se guarda como "versión anterior"
  // restaurable (ver ejercicio_foto_version_anterior, migración 0094) — solo
  // una por ejercicio, no un historial completo. Best-effort: si la migración
  // todavía no corrió contra esta base, se cae al comportamiento de siempre
  // (borrar directo) para no dejar archivos huérfanos acumulándose sin fin.
  let versionGuardada = false;
  if (reemplazoFoto && fotoAnterior?.foto_miniatura_url && fotoAnterior.foto_completa_url) {
    const { data: versionExistente } = await supabase
      .from("ejercicio_foto_version_anterior")
      .select("foto_miniatura_url, foto_completa_url")
      .eq("ejercicio_id", ejercicioId)
      .maybeSingle();
    const { error: errorVersion } = await supabase.from("ejercicio_foto_version_anterior").upsert({
      ejercicio_id: ejercicioId,
      foto_miniatura_url: fotoAnterior.foto_miniatura_url,
      foto_completa_url: fotoAnterior.foto_completa_url,
      foto_panorama_x: fotoAnterior.foto_panorama_x ?? 50,
      foto_panorama_y: fotoAnterior.foto_panorama_y ?? 50,
      foto_cuadrada_x: fotoAnterior.foto_cuadrada_x ?? 50,
      foto_cuadrada_y: fotoAnterior.foto_cuadrada_y ?? 50,
      reemplazada_por: entrenador.userId,
    });
    if (!errorVersion) {
      versionGuardada = true;
      // Solo se guarda UNA versión anterior: si ya había una guardada de un
      // reemplazo previo, ese archivo queda huérfano ahora (la fila se acaba
      // de pisar con la nueva) y hay que borrarlo — si no, cada reemplazo
      // sucesivo dejaría un archivo suelto en Storage para siempre.
      if (versionExistente) {
        const rutasHuerfanas = [versionExistente.foto_miniatura_url, versionExistente.foto_completa_url]
          .map((url) => url.split("/ejercicios-fotos/")[1])
          .filter((ruta): ruta is string => !!ruta);
        if (rutasHuerfanas.length > 0) await supabase.storage.from("ejercicios-fotos").remove(rutasHuerfanas);
      }
    } else {
      console.error("[ejercicios] no se pudo guardar la versión anterior de la foto:", errorVersion.message);
    }
  }

  if (!versionGuardada && reemplazoFoto && rutasViejas.length > 0) {
    await supabase.storage.from("ejercicios-fotos").remove(rutasViejas);
  }

  // Reemplazar la referencia corrige el problema de raíz para todos los
  // alumnos; todos los reportes pendientes de este ejercicio quedan resueltos
  // en el mismo paso. Best-effort para poder desplegar código antes de 0048.
  if (reemplazoFoto) {
    await cerrarReportesFotoDeEjercicio(supabase, entrenador.userId, ejercicioId);
    // Historial de portadas (Fase 3, §8.3) — aditivo, nunca hace fallar el
    // guardado de la foto en sí si algo sale mal acá.
    await registrarFotoPrincipal(ejercicioId, {
      urlMiniatura: urlMini,
      urlCompleta: urlCompleta,
      hash: fotoHash,
      creadoPor: entrenador.userId,
    });
  }

  avisarCambios();
  return { error: null, ok: true };
}

/**
 * Cierra los reportes de foto pendientes de un ejercicio — los que ya
 * apuntan a su `ejercicio_id` y los huérfanos (reporte guardado antes de que
 * el ejercicio existiera, sin `ejercicio_id`, comparado por nombre/alias).
 *
 * Compartido entre `subirFotoEjercicio` y `confirmarSubidaVideoCloudflare`:
 * un alumno que pidió "la foto" de un ejercicio queda igual de resuelto si
 * lo que se termina cargando es un clip — el reporte es sobre no tener
 * ningún medio, no específicamente sobre una foto (instructivo §3.2, "todo
 * reporte relacionado se cierra solo cuando el medio definitivo quedó
 * vinculado correctamente"). Best-effort: nunca hace fallar a quien la llama.
 */
async function cerrarReportesFotoDeEjercicio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entrenadorId: string,
  ejercicioId: string
): Promise<void> {
  await supabase
    .from("reportes_fotos_ejercicios")
    .update({ estado: "resuelto", resuelto_en: new Date().toISOString(), resuelto_por: entrenadorId })
    .eq("ejercicio_id", ejercicioId)
    .eq("estado", "pendiente");

  const { data: ejercicio } = await supabase
    .from("ejercicios")
    .select("nombre, aliases")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (!ejercicio) return;

  const conocidos = new Set([ejercicio.nombre, ...(ejercicio.aliases ?? [])].map((n: string) => normalizar(n)));
  const { data: huerfanos } = await supabase
    .from("reportes_fotos_ejercicios")
    .select("id, nombre_ejercicio")
    .is("ejercicio_id", null)
    .eq("estado", "pendiente");
  const ids = (huerfanos ?? [])
    .filter((r: { nombre_ejercicio: string }) => conocidos.has(normalizar(r.nombre_ejercicio)))
    .map((r: { id: string }) => r.id);
  if (ids.length > 0) {
    await supabase
      .from("reportes_fotos_ejercicios")
      .update({ estado: "resuelto", resuelto_en: new Date().toISOString(), resuelto_por: entrenadorId })
      .in("id", ids);
  }
}

/** Cierra manualmente un aviso falso o uno que no pudo vincularse a una fila
 * de la biblioteca. Reemplazar una foto lo resuelve automáticamente. */
export async function resolverReporteFoto(formData: FormData): Promise<void> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const reporteIds = formData.getAll("reporte_id").map(String).filter(Boolean).slice(0, 200);
  if (reporteIds.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("reportes_fotos_ejercicios")
    .update({ estado: "resuelto", resuelto_en: new Date().toISOString(), resuelto_por: entrenador.userId })
    .in("id", reporteIds)
    .eq("estado", "pendiente");
  revalidatePath("/admin/ejercicios");
}

export type CrearEjercicioState = { error: string | null; ok: boolean; id?: string };

function generarSlug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Alta rápida de un ejercicio que todavía no está en la biblioteca — para
 * cuando el entrenador saca una foto nueva en el gimnasio de algo que no
 * estaba registrado. La foto es opcional acá: se puede crear el ejercicio
 * pelado y subirle la foto después desde la galería, o las dos cosas juntas.
 */
export async function crearEjercicioNuevo(
  _prevState: CrearEjercicioState,
  formData: FormData
): Promise<CrearEjercicioState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const nombresTexto = String(formData.get("nombre") || "").trim();
  const grupoMuscularTexto = String(formData.get("grupo_muscular") || "").trim();
  const categoriaTexto = String(formData.get("categoria") || "").trim();
  const equipoTexto = String(formData.get("equipo") || "").trim();
  const patronMovimiento = String(formData.get("patron_movimiento") || "").trim();
  const nivel = String(formData.get("nivel") || "intermedio") as NivelEjercicio;
  const descripcionCorta = String(formData.get("descripcion_corta") || "").trim() || null;
  const tecnica = String(formData.get("tecnica") || "").trim() || null;
  const erroresComunes = String(formData.get("errores_comunes") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const consejos = String(formData.get("consejos") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const videoUrl = String(formData.get("video_url") || "").trim();
  const archivo = formData.get("foto") as File | null;
  const fotoUrl = String(formData.get("foto_url") || "").trim();
  const miniaturaUrlSubida = String(formData.get("foto_miniatura_url_subida") || "").trim();
  const completaUrlSubida = String(formData.get("foto_completa_url_subida") || "").trim();

  // Mismo formato que el editor de nombre de un ejercicio existente: variantes
  // separadas por "/", la primera es el nombre que se ve, el resto quedan
  // como alias para que `emparejarEjercicio` las reconozca en rutinas futuras.
  const [nombre, ...aliases] = nombresTexto
    .split("/")
    .map((n) => n.trim())
    .filter(Boolean);

  if (!nombre) return { error: "Ponele un nombre al ejercicio.", ok: false };
  // Instructivo §7.1: el nombre es el único dato imprescindible en el alta
  // rápida. Grupo/categoría/equipo pueden quedar sin cargar y completarse
  // después desde "Completar ficha" (migración 0099, calidad_ficha) — pero
  // si el entrenador cargó alguno, se le pide terminar los tres: una
  // clasificación a medias (grupo sin equipo) es peor que ninguna, porque
  // `emparejarEjercicio` la usaría igual para vetos de zona/equipo.
  const clasificacionCompleta = !!(grupoMuscularTexto && categoriaTexto && equipoTexto);
  if ((grupoMuscularTexto || categoriaTexto || equipoTexto) && !clasificacionCompleta) {
    return { error: "Completá grupo, categoría y equipo los tres, o dejalos vacíos para clasificar después.", ok: false };
  }
  if (!["principiante", "intermedio", "avanzado"].includes(nivel)) return { error: "Elegí un nivel válido.", ok: false };
  if (patronMovimiento && !PATRONES_MOVIMIENTO_VALIDOS.includes(patronMovimiento as (typeof PATRONES_MOVIMIENTO_VALIDOS)[number])) {
    return { error: "Ese tipo de movimiento no es válido.", ok: false };
  }

  let slug = generarSlug(nombre);
  if (!slug) return { error: "Ese nombre no sirve para generar un identificador único.", ok: false };

  // Si ya existe ese slug (dos ejercicios con nombre parecido), se le suma un
  // sufijo numérico en vez de fallar por la restricción unique.
  const { count } = await supabase
    .from("ejercicios")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  if (count && count > 0) slug = `${slug}-${count + 1}`;

  const datosEjercicio = {
    slug,
    nombre,
    aliases,
    grupo_muscular: clasificacionCompleta ? (grupoMuscularTexto as GrupoMuscular) : null,
    categoria: clasificacionCompleta ? (categoriaTexto as CategoriaEjercicio) : null,
    equipo: clasificacionCompleta ? (equipoTexto as EquipoEjercicio) : null,
    patron_movimiento: patronMovimiento || null,
    nivel,
    descripcion_corta: descripcionCorta,
    tecnica,
    errores_comunes: erroresComunes,
    consejos,
  };

  let respuestaInsert = await supabase
    .from("ejercicios")
    .insert({ ...datosEjercicio, calidad_ficha: clasificacionCompleta ? "completa" : "requiere_clasificacion" })
    .select("id")
    .single();

  // La migración 0099 (calidad_ficha + columnas de clasificación nullable)
  // puede no haber corrido todavía contra esta base. "42703" es columna
  // inexistente (calidad_ficha); "23502" es la violación NOT NULL de
  // siempre en grupo_muscular/categoria/equipo si esa parte de la migración
  // no llegó a aplicarse.
  if (respuestaInsert.error && (respuestaInsert.error.code === "42703" || respuestaInsert.error.code === "23502")) {
    if (!clasificacionCompleta) {
      return {
        error: "Esta base todavía no tiene la actualización para crear ejercicios sin clasificar — completá grupo, categoría y equipo por ahora.",
        ok: false,
      };
    }
    // Clasificación completa: el insert de siempre funciona igual sin la
    // columna calidad_ficha, así que se reintenta sin ella.
    respuestaInsert = await supabase.from("ejercicios").insert(datosEjercicio).select("id").single();
  }

  const { data: nuevo, error: errorInsert } = respuestaInsert;

  if (errorInsert || !nuevo) {
    return { error: "No se pudo crear el ejercicio. Probá de nuevo.", ok: false };
  }

  if ((archivo && archivo.size > 0) || fotoUrl || (miniaturaUrlSubida && completaUrlSubida)) {
    const datosFoto = new FormData();
    datosFoto.set("ejercicio_id", nuevo.id);
    if (archivo && archivo.size > 0) datosFoto.set("foto", archivo);
    if (fotoUrl) datosFoto.set("foto_url", fotoUrl);
    if (miniaturaUrlSubida && completaUrlSubida) {
      datosFoto.set("foto_miniatura_url_subida", miniaturaUrlSubida);
      datosFoto.set("foto_completa_url_subida", completaUrlSubida);
      const hashCliente = String(formData.get("foto_hash_cliente") || "").trim();
      if (hashCliente) datosFoto.set("foto_hash_cliente", hashCliente);
    }
    const resultadoFoto = await subirFotoEjercicio({ error: null, ok: false }, datosFoto);
    if (resultadoFoto.error) {
      // El ejercicio ya quedó creado — no se pierde el alta por un problema
      // con la foto, se avisa aparte para que la suba de nuevo desde la
      // galería.
      return { error: `Ejercicio creado, pero la foto falló: ${resultadoFoto.error}`, ok: true, id: nuevo.id };
    }
  }

  if (videoUrl) {
    const datosVideo = new FormData();
    datosVideo.set("ejercicio_id", nuevo.id);
    datosVideo.set("video_url", videoUrl);
    const resultadoVideo = await guardarVideoEjercicio({ error: null, ok: false }, datosVideo);
    if (resultadoVideo.error) {
      return { error: `Ejercicio creado, pero el video falló: ${resultadoVideo.error}`, ok: true, id: nuevo.id };
    }
  }

  avisarCambios();
  // El id viaja siempre que ok:true — el alta rápida lo necesita para poder
  // subir un clip de Cloudflare después de crear la ficha (instructivo §7.5):
  // ese camino recién puede vincular un video a un ejercicio que ya existe.
  return { error: null, ok: true, id: nuevo.id };
}

export type ActualizarNombreState = { error: string | null; ok: boolean };
export type ActualizarDetallesState = { error: string | null; ok: boolean };

export type AgregarAliasState = { error: string | null; ok: boolean; mensaje?: string };

/**
 * Suma un nombre suelto como alias sin tocar los demás — el atajo para el
 * caso de todos los días: "esto también se llama así". A diferencia de
 * `actualizarNombreEjercicio`, que reescribe la lista entera separada por
 * "/", acá solo hace falta escribir el nombre nuevo; no hay que copiar ni
 * repetir los alias que ya estaban.
 */
export async function agregarAliasEjercicio(
  _prevState: AgregarAliasState,
  formData: FormData,
): Promise<AgregarAliasState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const alias = String(formData.get("alias") || "").trim();
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!alias) return { error: "Escribí un nombre.", ok: false };

  const supabase = await createClient();
  const { data: ejercicio, error: errorLectura } = await supabase
    .from("ejercicios")
    .select("id,nombre,aliases")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (errorLectura || !ejercicio) return { error: "No se encontró ese ejercicio.", ok: false };

  if (normalizar(alias) === normalizar(ejercicio.nombre)) {
    return { error: `"${alias}" ya es el nombre principal de ${ejercicio.nombre}.`, ok: false };
  }
  if ((ejercicio.aliases ?? []).some((item: string) => normalizar(item) === normalizar(alias))) {
    return { error: `"${alias}" ya estaba en la lista de ${ejercicio.nombre}.`, ok: false };
  }

  const aliases = [...(ejercicio.aliases ?? []), alias];
  const { error } = await supabase.from("ejercicios").update({ aliases }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo guardar. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true, mensaje: `"${alias}" agregado a ${ejercicio.nombre}.` };
}

export async function actualizarDetallesEjercicio(
  _prevState: ActualizarDetallesState,
  formData: FormData,
): Promise<ActualizarDetallesState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const nivel = String(formData.get("nivel") || "intermedio") as NivelEjercicio;
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!["principiante", "intermedio", "avanzado"].includes(nivel)) return { error: "El nivel no es válido.", ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("ejercicios").update({
    nivel,
    descripcion_corta: String(formData.get("descripcion_corta") || "").trim() || null,
    tecnica: String(formData.get("tecnica") || "").trim() || null,
    errores_comunes: String(formData.get("errores_comunes") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    consejos: String(formData.get("consejos") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
  }).eq("id", ejercicioId);
  if (error) return { error: "No se pudieron guardar los detalles.", ok: false };
  avisarCambios();
  return { error: null, ok: true };
}

export type ActualizarClasificacionState = { error: string | null; ok: boolean };

/**
 * Grupo muscular, categoría y equipo — antes solo se elegían al crear el
 * ejercicio (`crearEjercicioNuevo`); un ejercicio ya cargado no tenía forma
 * de reclasificarse desde la galería (instructivo del panel §8.8, "un
 * ejercicio ya cargado no se puede reclasificar" era el hueco real).
 *
 * Misma validación liviana que ya usa `crearEjercicioNuevo` para estos tres
 * campos: solo se chequea que no vengan vacíos — el `<select>` de la
 * interfaz ya limita las opciones, y la columna de Postgres es la que
 * realmente exige un valor de la lista.
 *
 * A propósito NO toca `patron_movimiento` (tiene su propio editor,
 * `actualizarPatronMovimiento`) ni `nivel` (vive en `actualizarDetallesEjercicio`)
 * — reclasificar grupo/categoría/equipo es un cambio más profundo (puede
 * mover al ejercicio de familia de zona en `emparejarEjercicio`) y merece su
 * propio guardado, sin arrastrar el resto del formulario de detalles.
 */
export async function actualizarClasificacionEjercicio(
  _prevState: ActualizarClasificacionState,
  formData: FormData
): Promise<ActualizarClasificacionState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const grupoMuscular = String(formData.get("grupo_muscular") || "") as GrupoMuscular;
  const categoria = String(formData.get("categoria") || "") as CategoriaEjercicio;
  const equipo = String(formData.get("equipo") || "") as EquipoEjercicio;

  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!grupoMuscular) return { error: "Elegí el grupo muscular.", ok: false };
  if (!categoria) return { error: "Elegí la categoría.", ok: false };
  if (!equipo) return { error: "Elegí el equipo.", ok: false };

  const supabase = await createClient();
  // calidad_ficha pasa a 'completa' siempre que se guarda acá: si el
  // ejercicio venía del alta rápida sin clasificar (migración 0099), cargar
  // los tres campos es exactamente lo que lo saca de la cola "Completar
  // ficha" y lo hace entrar a obtenerBiblioteca(). Para un ejercicio que ya
  // estaba completo, es un no-op.
  let { error } = await supabase
    .from("ejercicios")
    .update({ grupo_muscular: grupoMuscular, categoria, equipo, calidad_ficha: "completa" })
    .eq("id", ejercicioId);
  if (error?.code === "42703") {
    ({ error } = await supabase
      .from("ejercicios")
      .update({ grupo_muscular: grupoMuscular, categoria, equipo })
      .eq("id", ejercicioId));
  }
  if (error) return { error: "No se pudo guardar la clasificación.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}

/**
 * Edita el nombre "principal" de un ejercicio y sus alias — todas las formas
 * en que un entrenador podría escribir el mismo movimiento en una rutina
 * ("Press de pecho / Bench press / Press banca"), separadas por "/". La
 * primera queda como `nombre` (lo que se ve en la galería); el resto se
 * guarda en `aliases` para que `emparejarEjercicio` (lib/ejercicios/emparejar.ts)
 * las reconozca como el mismo ejercicio.
 *
 * No alcanza con esto para que una rutina YA CREADA con un nombre no
 * reconocido muestre la foto al instante — eso lo resuelve el respaldo de
 * reemparejamiento en `obtenerSesionCompleta` (alumno/entrenar/data.ts), que
 * usa estos alias actualizados como fallback cuando el ejercicio de la
 * sesión no tiene foto propia vinculada.
 */
export async function actualizarNombreEjercicio(
  _prevState: ActualizarNombreState,
  formData: FormData
): Promise<ActualizarNombreState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const nombres = String(formData.get("nombres") || "")
    .split("/")
    .map((n) => n.trim())
    .filter(Boolean);

  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (nombres.length === 0) return { error: "Escribí al menos un nombre.", ok: false };

  const [nombre, ...aliasesConDuplicados] = nombres;
  const aliases = Array.from(new Set(aliasesConDuplicados)).filter(
    (a) => a.toLowerCase() !== nombre.toLowerCase()
  );

  const { error } = await supabase.from("ejercicios").update({ nombre, aliases }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo guardar el nombre. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}

export type ActualizarPatronMovimientoState = { error: string | null; ok: boolean };

/**
 * Carga el patrón biomecánico estructurado (columna `patron_movimiento`,
 * migración 0051) de un ejercicio. Mientras esta columna esté vacía, el
 * generador sigue clasificando por nombre (`patronMovimiento()` en
 * lib/rutinas/patrones.ts) — cargarla acá no cambia ese comportamiento por sí
 * sola, es el primer paso para ir reemplazando la heurística por dato real.
 */
export async function actualizarPatronMovimiento(
  _prevState: ActualizarPatronMovimientoState,
  formData: FormData
): Promise<ActualizarPatronMovimientoState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const valorCrudo = String(formData.get("patron_movimiento") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  // Vacío = "sin clasificar todavía", vuelve a depender de la heurística por
  // nombre en vez de forzar un valor.
  const patronMovimiento = valorCrudo === "" ? null : valorCrudo;
  if (patronMovimiento !== null && !PATRONES_MOVIMIENTO_VALIDOS.includes(patronMovimiento as never)) {
    return { error: "Ese patrón de movimiento no es válido.", ok: false };
  }

  const { error } = await supabase
    .from("ejercicios")
    .update({ patron_movimiento: patronMovimiento })
    .eq("id", ejercicioId);
  if (error) return { error: "No se pudo guardar el patrón. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}

export type DesactivarEjercicioState = { error: string | null; ok: boolean };

/**
 * "Elimina" un ejercicio de la galería sin borrar la fila de verdad: pone
 * `activo` en false, el mismo campo que ya filtra `obtenerBiblioteca` (así
 * que deja de listarse en la galería y de ofrecerse para emparejar rutinas
 * nuevas). Las rutinas que YA lo tienen vinculado
 * (`rutina_dia_ejercicios.ejercicio_id`) lo siguen mostrando igual — ese join
 * es un lookup directo por id, no pasa por `obtenerBiblioteca` ni filtra por
 * `activo` — así que nada se rompe retroactivamente para un alumno a mitad
 * de su rutina.
 */
export async function desactivarEjercicio(
  _prevState: DesactivarEjercicioState,
  formData: FormData
): Promise<DesactivarEjercicioState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  const { error } = await supabase.from("ejercicios").update({ activo: false }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo eliminar. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}

const EXTENSIONES_VIDEO_DIRECTO = /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i;

export type GuardarVideoState = { error: string | null; ok: boolean };

/**
 * Guarda el video de referencia de un ejercicio — a diferencia de la foto,
 * SOLO por link, nunca subiendo el archivo: un video pesa mucho más que
 * cualquier foto, y decodificarlo del lado del celular (como se intentó al
 * principio con las fotos) es exactamente lo que no hay que hacer — por eso
 * las apps de video de verdad tampoco lo hacen, mandan el archivo pesado
 * directo a un servidor especializado sin tocarlo en el navegador.
 *
 * Acepta dos formatos:
 *   - Un link de YouTube: se guarda el link tal cual y, si el ejercicio
 *     todavía no tiene foto propia, se usa la miniatura de YouTube como foto
 *     (mismo pipeline de `subirFotoEjercicio` con `foto_url`) — así aparece
 *     en la galería sin pedir un paso aparte.
 *   - Un link directo a un archivo de video (mp4, mov, webm, avi, m4v): se
 *     guarda tal cual, sin miniatura (no hay forma de generarla sin bajar el
 *     archivo entero, que es justo lo que se quiere evitar acá).
 */
export async function guardarVideoEjercicio(
  _prevState: GuardarVideoState,
  formData: FormData
): Promise<GuardarVideoState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const videoUrlTexto = String(formData.get("video_url") || "").trim();

  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!videoUrlTexto) return { error: "Pegá un link de video.", ok: false };

  const url = esUrlExternaSegura(videoUrlTexto);
  if (!url) return { error: "Ese link no es válido.", ok: false };

  const idYoutube = idDeYoutube(videoUrlTexto);
  if (!idYoutube && !EXTENSIONES_VIDEO_DIRECTO.test(url.pathname)) {
    return {
      error: "Pegá un link de YouTube o un link directo a un archivo de video (mp4, mov, webm).",
      ok: false,
    };
  }

  const { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({ video_url: videoUrlTexto })
    .eq("id", ejercicioId);
  if (errorUpdate) return { error: "No se pudo guardar el video. Probá de nuevo.", ok: false };

  if (idYoutube) {
    const { data: actual } = await supabase
      .from("ejercicios")
      .select("foto_miniatura_url")
      .eq("id", ejercicioId)
      .maybeSingle();

    if (!actual?.foto_miniatura_url) {
      const datosFoto = new FormData();
      datosFoto.set("ejercicio_id", ejercicioId);
      datosFoto.set("foto_url", `https://img.youtube.com/vi/${idYoutube}/hqdefault.jpg`);
      // Best-effort: si la miniatura falla, el video ya quedó guardado igual
      // (línea de arriba) — no tiene sentido devolver error por esto.
      await subirFotoEjercicio({ error: null, ok: false }, datosFoto);
    }
  }

  avisarCambios();
  return { error: null, ok: true };
}

export type QuitarVideoState = { error: string | null; ok: boolean };

export async function quitarVideoEjercicio(
  _prevState: QuitarVideoState,
  formData: FormData
): Promise<QuitarVideoState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  const { error } = await supabase.from("ejercicios").update({ video_url: null }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo quitar el video. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}

const TAMANO_MAXIMO_VIDEO_CLOUDFLARE = 100 * 1024 * 1024;
const TIPOS_VIDEO_CLOUDFLARE = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type IniciarSubidaCloudflareResultado =
  | { ok: true; endpoint: string }
  | { ok: false; error: string };

/** Reserva una subida privada; el archivo viaja del navegador a Cloudflare. */
export async function iniciarSubidaVideoCloudflare(
  ejercicioId: string,
  tamanoBytes: number,
  tipoMime: string
): Promise<IniciarSubidaCloudflareResultado> {
  await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return { ok: false, error: "Falta el ejercicio." };
  if (!Number.isFinite(tamanoBytes) || tamanoBytes <= 0 || tamanoBytes > TAMANO_MAXIMO_VIDEO_CLOUDFLARE) {
    return { ok: false, error: "El video debe pesar menos de 100 MB." };
  }
  if (tipoMime && !TIPOS_VIDEO_CLOUDFLARE.has(tipoMime)) {
    return { ok: false, error: "Sube un archivo MP4, MOV o WebM." };
  }

  const resultado = await solicitarSubidaDirecta({ maxDurationSeconds: 30, creator: ejercicioId });
  if ("error" in resultado) return { ok: false, error: resultado.error };

  const supabase = await createClient();
  const { data: anterior } = await supabase
    .from("ejercicios")
    .select("video_cloudflare_uid, video_cloudflare_uid_anterior")
    .eq("id", ejercicioId)
    .maybeSingle();
  // El UID anterior NO se borra acá — recién no se subió ni un byte del
  // nuevo clip todavía. Se guarda en `video_cloudflare_uid_anterior` y se
  // elimina de Cloudflare solo cuando `sincronizarVideoCloudflare` confirma
  // que el reemplazo terminó de procesar (instructivo §11.4). Si ya había un
  // "anterior" pendiente de limpieza de un reemplazo previo sin confirmar, se
  // pierde: no hay forma de restaurar dos versiones atrás, solo la última.
  const { error } = await supabase
    .from("ejercicios")
    .update({
      video_url: null,
      video_cloudflare_uid: resultado.uid,
      video_cloudflare_uid_anterior: anterior?.video_cloudflare_uid ?? null,
      video_cloudflare_estado: "subiendo",
      video_cloudflare_duracion_seg: null,
      video_cloudflare_miniatura_url: null,
      video_cloudflare_error: null,
    })
    .eq("id", ejercicioId);
  if (error) {
    await eliminarVideoCloudflare(resultado.uid);
    return { ok: false, error: "No se pudo vincular el video al ejercicio." };
  }
  avisarCambios();
  return { ok: true, endpoint: resultado.endpoint };
}

export async function confirmarSubidaVideoCloudflare(ejercicioId: string): Promise<void> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return;
  const supabase = await createClient();
  await supabase
    .from("ejercicios")
    .update({ video_cloudflare_estado: "procesando" })
    .eq("id", ejercicioId)
    .eq("video_cloudflare_estado", "subiendo");
  // El clip ya está en Cloudflare (procesando o no, ya quedó vinculado y no
  // se va a perder) — mismo criterio que una foto: el reporte se cierra
  // apenas el medio queda definitivamente asociado, sin esperar a que
  // Cloudflare termine de procesar.
  await cerrarReportesFotoDeEjercicio(supabase, entrenador.userId, ejercicioId);
  avisarCambios();
}

export async function sincronizarVideoCloudflare(
  ejercicioId: string
): Promise<"procesando" | "listo" | "error" | null> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ejercicios")
    .select("video_cloudflare_uid, video_cloudflare_uid_anterior")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (!data?.video_cloudflare_uid) return null;

  const estado = await consultarVideoCloudflare(data.video_cloudflare_uid);
  if (!estado) return null;

  // Reemplazo confirmado: recién ahora es seguro dejar de considerar
  // "activo" al clip anterior (instructivo §11.4) — si el nuevo hubiera
  // fallado antes de llegar acá, seguía intacto y recuperable. Desde Fase 3
  // ya no se borra de Cloudflare: se archiva en ejercicio_multimedia y
  // queda restaurable (§18, "limpieza con período de gracia" — el borrado
  // físico real es un proceso aparte, todavía no construido).
  if (estado.estado === "listo" && data.video_cloudflare_uid_anterior) {
    await archivarVideoReemplazado(ejercicioId, data.video_cloudflare_uid_anterior, {
      duracionSeg: null,
      creadoPor: entrenador.userId,
    });
  }
  // El reemplazo falló: se restaura el anterior como video activo en vez de
  // dejar al ejercicio con un clip roto pudiendo haber uno bueno guardado.
  const restaurarAnterior = estado.estado === "error" && data.video_cloudflare_uid_anterior;

  await supabase
    .from("ejercicios")
    .update(
      restaurarAnterior
        ? {
            video_cloudflare_uid: data.video_cloudflare_uid_anterior,
            video_cloudflare_estado: "listo",
            video_cloudflare_error: null,
            video_cloudflare_uid_anterior: null,
          }
        : {
            video_cloudflare_estado: estado.estado,
            video_cloudflare_duracion_seg: estado.duracion,
            video_cloudflare_miniatura_url: estado.miniaturaUrl,
            video_cloudflare_error: estado.error,
            video_cloudflare_uid_anterior: null,
          }
    )
    .eq("id", ejercicioId)
    .eq("video_cloudflare_uid", data.video_cloudflare_uid);
  if (restaurarAnterior) await eliminarVideoCloudflare(data.video_cloudflare_uid);
  avisarCambios();
  // Si se restauró el anterior, el estado final que quedó guardado es
  // "listo" (el clip bueno volvió a quedar activo) — devolver eso, no
  // "error", para que quien llame no muestre un error sobre un video que en
  // los hechos está andando.
  return restaurarAnterior ? "listo" : estado.estado;
}

export type QuitarVideoCloudflareState = { error: string | null; ok: boolean };

export async function quitarVideoCloudflare(
  _prevState: QuitarVideoCloudflareState,
  formData: FormData
): Promise<QuitarVideoCloudflareState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  const supabase = await createClient();
  const { data } = await supabase
    .from("ejercicios")
    .select("video_cloudflare_uid")
    .eq("id", ejercicioId)
    .maybeSingle();
  const { error } = await supabase
    .from("ejercicios")
    .update({
      video_cloudflare_uid: null,
      video_cloudflare_estado: null,
      video_cloudflare_duracion_seg: null,
      video_cloudflare_miniatura_url: null,
      video_cloudflare_error: null,
    })
    .eq("id", ejercicioId);
  if (error) return { error: "No se pudo quitar el video.", ok: false };
  if (data?.video_cloudflare_uid) await eliminarVideoCloudflare(data.video_cloudflare_uid);
  avisarCambios();
  return { error: null, ok: true };
}

export type UsoRutina = { nombre: string; cantidad: number };

export type VincularNombreRutinaState = { error: string | null; ok: boolean; mensaje?: string };
export type CombinarDuplicadosState = { error: string | null; ok: boolean; mensaje?: string };

/** Fusiona dos entradas de la biblioteca sin perder historial. La entrada con
 * foto propia manda como original; si ambas (o ninguna) tienen foto, se
 * conserva la sugerida por la galería. El nombre descartado queda como alias, todas las
 * rutinas pasan a apuntar al original y el duplicado solo se desactiva. */
export async function combinarEjerciciosDuplicados(
  _prevState: CombinarDuplicadosState,
  formData: FormData,
): Promise<CombinarDuplicadosState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const idA = String(formData.get("original_id") || "");
  const idB = String(formData.get("duplicado_id") || "");
  if (!idA || !idB || idA === idB) return { error: "Elige dos ejercicios distintos.", ok: false };

  const supabase = await createClient();
  const { data, error: errorLectura } = await supabase
    .from("ejercicios")
    .select("id,nombre,aliases,activo,foto_miniatura_url,foto_completa_url,ilustracion_slug,video_url")
    .in("id", [idA, idB]);
  if (errorLectura || !data || data.length !== 2) return { error: "No se pudieron leer ambos ejercicios.", ok: false };

  const conFoto = (item: (typeof data)[number]) => Boolean(item.foto_miniatura_url || item.foto_completa_url);
  const sugerido = data.find((item) => item.id === idA)!;
  const otro = data.find((item) => item.id === idB)!;
  // Cuál sobrevive puede venir decidido explícitamente por quien lo ejecuta.
  // Sin eso, se elige por foto — una heurística razonable para la lista de
  // duplicados, pero imposible de anticipar mirando un botón: en la Mesa el
  // entrenador tiene que poder leer de antemano cuál desaparece, porque el que
  // desaparece se lleva sus usos en las rutinas de todos los alumnos.
  const forzadoId = String(formData.get("original_forzado") || "");
  const forzado = forzadoId ? data.find((item) => item.id === forzadoId) : undefined;
  const original = forzado ?? (conFoto(otro) && !conFoto(sugerido) ? otro : sugerido);
  const duplicado = original.id === sugerido.id ? otro : sugerido;
  if (!original.activo || !duplicado.activo) return { error: "Uno de los ejercicios ya no está activo.", ok: false };

  const aliasesAntes = original.aliases ?? [];
  const aliases = [...new Set([...aliasesAntes, duplicado.nombre, ...(duplicado.aliases ?? [])])]
    .filter((alias) => normalizar(alias) !== normalizar(original.nombre));
  const { error: errorOriginal } = await supabase.from("ejercicios").update({
    aliases,
    foto_miniatura_url: original.foto_miniatura_url ?? duplicado.foto_miniatura_url,
    foto_completa_url: original.foto_completa_url ?? duplicado.foto_completa_url,
    ilustracion_slug: original.ilustracion_slug ?? duplicado.ilustracion_slug,
    video_url: original.video_url ?? duplicado.video_url,
  }).eq("id", original.id);
  if (errorOriginal) return { error: "No se pudo preparar el ejercicio original.", ok: false };

  // Se leen los IDs exactos ANTES de reasignar — es lo único que permite
  // deshacer con precisión después (ver ejercicio_fusiones, migración 0093):
  // sin esta lista, "restaurar" no podría distinguir las filas que eran del
  // duplicado de las que ya apuntaban al original por otro motivo.
  const { data: filasAfectadas } = await supabase
    .from("rutina_dia_ejercicios")
    .select("id")
    .eq("ejercicio_id", duplicado.id);
  const idsFilasAfectadas = (filasAfectadas ?? []).map((fila) => fila.id);

  const { error: errorRutinas } = await supabase.from("rutina_dia_ejercicios").update({ ejercicio_id: original.id }).eq("ejercicio_id", duplicado.id);
  if (errorRutinas) return { error: "No se pudieron trasladar las rutinas al ejercicio original.", ok: false };

  // Los reportes de foto pendientes del duplicado tienen que seguir el mismo
  // camino que sus rutinas: si no se trasladan, la tarjeta de "Solicitudes de
  // fotos" no encuentra el ejercicio (quedó desactivado) y el botón termina
  // ofreciendo crear un ejercicio nuevo con el mismo nombre — deshaciendo la
  // fusión que se acaba de hacer.
  const { error: errorReportes } = await supabase
    .from("reportes_fotos_ejercicios")
    .update({ ejercicio_id: original.id })
    .eq("ejercicio_id", duplicado.id)
    .eq("estado", "pendiente");
  if (errorReportes) console.error("[ejercicios] no se pudieron trasladar los reportes del duplicado:", errorReportes.message);

  const { error: errorDesactivar } = await supabase.from("ejercicios").update({ activo: false }).eq("id", duplicado.id);
  if (errorDesactivar) return { error: "Las rutinas quedaron asociadas, pero no se pudo ocultar el duplicado.", ok: false };

  // Best-effort: si la migración 0093 todavía no corrió contra esta base, la
  // tabla no existe y esto falla en silencio — la fusión en sí ya se hizo
  // bien, el historial es una red de seguridad extra, no algo que deba
  // tumbar la operación principal.
  const { error: errorHistorial } = await supabase.from("ejercicio_fusiones").insert({
    original_id: original.id,
    original_nombre: original.nombre,
    duplicado_id: duplicado.id,
    duplicado_nombre: duplicado.nombre,
    aliases_antes: aliasesAntes,
    rutina_dia_ejercicios_ids: idsFilasAfectadas,
    fusionado_por: sesion.userId,
  });
  if (errorHistorial) console.error("[ejercicios] no se pudo registrar el historial de fusión:", errorHistorial.message);

  avisarCambios();
  return {
    error: null,
    ok: true,
    mensaje: `${duplicado.nombre} quedó combinado con ${original.nombre}${idsFilasAfectadas.length > 0 ? ` (${idsFilasAfectadas.length} uso${idsFilasAfectadas.length === 1 ? "" : "s"} en rutinas trasladados)` : ""}.`,
  };
}

export type DeshacerFusionState = { error: string | null; ok: boolean; mensaje?: string };

/** Restaura una fusión: reactiva el duplicado, le devuelve exactamente las
 * filas de rutina que se le habían trasladado, y quita del original solo los
 * alias que esta fusión había agregado (nunca los que ya tenía antes). Solo
 * deshace fusiones propias — no reescribe el historial de otro entrenador. */
export async function deshacerFusionEjercicios(
  _prevState: DeshacerFusionState,
  formData: FormData,
): Promise<DeshacerFusionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const fusionId = String(formData.get("fusion_id") || "");
  if (!fusionId) return { error: "Falta el identificador de la fusión.", ok: false };

  const supabase = await createClient();
  const { data: fusion, error: errorLectura } = await supabase
    .from("ejercicio_fusiones")
    .select("id,original_id,duplicado_id,duplicado_nombre,aliases_antes,rutina_dia_ejercicios_ids,deshecho_en")
    .eq("id", fusionId)
    .maybeSingle();
  if (errorLectura || !fusion) return { error: "No se encontró esa fusión en el historial.", ok: false };
  if (fusion.deshecho_en) return { error: "Esta fusión ya se había restaurado antes.", ok: false };
  if (!fusion.duplicado_id) return { error: "El ejercicio combinado ya no existe, no se puede restaurar.", ok: false };

  if (fusion.rutina_dia_ejercicios_ids.length > 0) {
    const { error: errorRestituir } = await supabase
      .from("rutina_dia_ejercicios")
      .update({ ejercicio_id: fusion.duplicado_id })
      .in("id", fusion.rutina_dia_ejercicios_ids);
    if (errorRestituir) return { error: "No se pudieron devolver las rutinas al ejercicio original.", ok: false };
  }

  const { error: errorReactivar } = await supabase.from("ejercicios").update({ activo: true }).eq("id", fusion.duplicado_id);
  if (errorReactivar) return { error: "Las rutinas volvieron, pero no se pudo reactivar el ejercicio.", ok: false };

  const { error: errorAliases } = await supabase.from("ejercicios").update({ aliases: fusion.aliases_antes }).eq("id", fusion.original_id);
  if (errorAliases) console.error("[ejercicios] no se pudieron restaurar los alias originales:", errorAliases.message);

  const { error: errorMarcar } = await supabase
    .from("ejercicio_fusiones")
    .update({ deshecho_en: new Date().toISOString(), deshecho_por: sesion.userId })
    .eq("id", fusionId);
  if (errorMarcar) console.error("[ejercicios] no se pudo marcar la fusión como deshecha:", errorMarcar.message);

  avisarCambios();
  return { error: null, ok: true, mensaje: `${fusion.duplicado_nombre} quedó restaurado.` };
}

export type RestaurarFotoAnteriorState = { error: string | null; ok: boolean; mensaje?: string };

/** Restaura la última versión anterior guardada de la foto de un ejercicio
 * (ver ejercicio_foto_version_anterior, migración 0094). Es un paso único, no
 * un intercambio: la foto que estaba puesta justo antes de restaurar no
 * queda guardada en ningún lado — si el entrenador se arrepiente de nuevo,
 * tiene que volver a subirla a mano. */
export async function restaurarFotoAnteriorEjercicio(
  _prevState: RestaurarFotoAnteriorState,
  formData: FormData,
): Promise<RestaurarFotoAnteriorState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  const supabase = await createClient();
  const { data: version, error: errorLectura } = await supabase
    .from("ejercicio_foto_version_anterior")
    .select("foto_miniatura_url, foto_completa_url, foto_panorama_x, foto_panorama_y, foto_cuadrada_x, foto_cuadrada_y")
    .eq("ejercicio_id", ejercicioId)
    .maybeSingle();
  if (errorLectura || !version) return { error: "No hay una versión anterior guardada para restaurar.", ok: false };

  const { data: actual } = await supabase
    .from("ejercicios")
    .select("nombre, foto_miniatura_url, foto_completa_url")
    .eq("id", ejercicioId)
    .maybeSingle();

  const { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({
      foto_miniatura_url: version.foto_miniatura_url,
      foto_completa_url: version.foto_completa_url,
      foto_panorama_x: version.foto_panorama_x,
      foto_panorama_y: version.foto_panorama_y,
      foto_cuadrada_x: version.foto_cuadrada_x,
      foto_cuadrada_y: version.foto_cuadrada_y,
    })
    .eq("id", ejercicioId);
  if (errorUpdate) return { error: "No se pudo restaurar la foto anterior.", ok: false };

  const { error: errorBorrarVersion } = await supabase
    .from("ejercicio_foto_version_anterior")
    .delete()
    .eq("ejercicio_id", ejercicioId);
  if (errorBorrarVersion) console.error("[ejercicios] no se pudo limpiar la versión anterior tras restaurar:", errorBorrarVersion.message);

  // La foto que estaba puesta justo antes de este restore queda huérfana en
  // Storage — se borra best-effort, salvo que resulte ser exactamente la
  // misma URL que se acaba de restaurar (no debería pasar, pero por las
  // dudas no se borra algo que sigue en uso).
  if (actual?.foto_miniatura_url && actual.foto_miniatura_url !== version.foto_miniatura_url) {
    const rutas = [actual.foto_miniatura_url, actual.foto_completa_url]
      .filter((url): url is string => !!url)
      .map((url) => url.split("/ejercicios-fotos/")[1])
      .filter((ruta): ruta is string => !!ruta);
    if (rutas.length > 0) await supabase.storage.from("ejercicios-fotos").remove(rutas);
  }

  avisarCambios();
  return { error: null, ok: true, mensaje: `Se restauró la foto anterior de ${actual?.nombre ?? "el ejercicio"}.` };
}

export type QuitarFotoState = { error: string | null; ok: boolean };

/**
 * Deja al ejercicio sin foto propia, conservando todo lo demás.
 *
 * Hasta ahora solo se podía REEMPLAZAR una foto, nunca sacarla: si a "Fondos
 * en paralelas" le quedaba pegada la foto de un fondo de tríceps, la única
 * salida era conseguir otra foto o desactivar el ejercicio entero. Al quitarla,
 * el ejercicio vuelve a mostrar su ilustración de referencia —que es genérica
 * pero correcta— en lugar de una foto de otro movimiento.
 *
 * Borra también los archivos de Storage, porque ya no los apunta nadie.
 */
export async function quitarFotoEjercicio(
  _prevState: QuitarFotoState,
  formData: FormData,
): Promise<QuitarFotoState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };

  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("ejercicios")
    .select("foto_miniatura_url, foto_completa_url")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (!actual?.foto_miniatura_url && !actual?.foto_completa_url) {
    return { error: "Este ejercicio ya no tiene foto propia.", ok: false };
  }

  const { error } = await supabase
    .from("ejercicios")
    .update({
      foto_miniatura_url: null,
      foto_completa_url: null,
      foto_panorama_x: 50,
      foto_panorama_y: 50,
      foto_cuadrada_x: 50,
      foto_cuadrada_y: 50,
    })
    .eq("id", ejercicioId);
  if (error) return { error: "No se pudo quitar la foto. Probá de nuevo.", ok: false };

  // Best-effort, igual que en el reemplazo: si el borrado del archivo falla, la
  // foto ya dejó de mostrarse, que es lo que importa.
  const rutas = [actual.foto_miniatura_url, actual.foto_completa_url]
    .filter((url): url is string => !!url)
    .map((url) => url.split("/ejercicios-fotos/")[1])
    .filter((ruta): ruta is string => !!ruta);
  if (rutas.length > 0) await supabase.storage.from("ejercicios-fotos").remove(rutas);

  avisarCambios();
  return { error: null, ok: true };
}

export type ResolverAliasState = { error: string | null; ok: boolean; mensaje?: string };

/**
 * Le quita un alias a un ejercicio para terminar con una colisión: dos
 * entradas distintas que reclamaban el mismo nombre alternativo.
 *
 * Mientras la colisión existe, ese texto es indecidible y
 * `emparejarEjercicio` se niega a elegir (devuelve null), así que las rutinas
 * que lo usen quedan sin foto. El caso que lo motivó: "extensión unilateral"
 * estaba registrado a la vez en cuádriceps y en tríceps, y el alumno terminaba
 * viendo la pierna en un ejercicio de brazo.
 *
 * Es deliberadamente lo contrario de `combinarEjerciciosDuplicados`: acá los
 * dos ejercicios son legítimos y se conservan enteros — lo único que se toca
 * es a quién le pertenece la palabra. No mueve rutinas ni desactiva nada.
 */
export async function resolverAliasEnDisputa(
  _prevState: ResolverAliasState,
  formData: FormData,
): Promise<ResolverAliasState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const alias = String(formData.get("alias") || "").trim();
  if (!ejercicioId || !alias) return { error: "Falta el ejercicio o el alias.", ok: false };

  const supabase = await createClient();
  const { data: ejercicio, error: errorLectura } = await supabase
    .from("ejercicios")
    .select("id,nombre,aliases")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (errorLectura || !ejercicio) return { error: "No se encontró ese ejercicio.", ok: false };

  const objetivo = normalizar(alias);
  const restantes = (ejercicio.aliases ?? []).filter((item: string) => normalizar(item) !== objetivo);
  if (restantes.length === (ejercicio.aliases ?? []).length) {
    return { error: `"${alias}" ya no figura como alias de ${ejercicio.nombre}.`, ok: false };
  }

  const { error } = await supabase.from("ejercicios").update({ aliases: restantes }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo quitar el alias. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true, mensaje: `"${alias}" dejó de ser alias de ${ejercicio.nombre}.` };
}

export type ActualizarPerfilImpulsoState = { error: string | null; ok: boolean };

const INTENSIDADES_IMPULSO: IntensidadImpulsoEjercicio[] = ["ninguna", "baja", "media", "alta"];
const TECNICAS_IMPULSO: TecnicaImpulsoEjercicio[] = [
  "tempo_controlado",
  "pausa_isometrica",
  "serie_descarga",
  "drop_set",
  "rest_pause",
  "fallo_controlado",
];

/** Perfil explícito: Impulso nunca habilita una técnica por coincidencias en
 * el nombre del ejercicio. Alejandro define aquí el techo real de seguridad. */
export async function actualizarPerfilImpulsoEjercicio(
  _prevState: ActualizarPerfilImpulsoState,
  formData: FormData,
): Promise<ActualizarPerfilImpulsoState> {
  await requireRol(["entrenador", "admin"]);
  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const intensidad = String(formData.get("impulso_intensidad_maxima") || "ninguna") as IntensidadImpulsoEjercicio;
  const solicitadas = formData.getAll("impulso_tecnicas_permitidas").map(String);
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!INTENSIDADES_IMPULSO.includes(intensidad)) return { error: "La intensidad no es válida.", ok: false };
  if (solicitadas.some((tecnica) => !TECNICAS_IMPULSO.includes(tecnica as TecnicaImpulsoEjercicio))) {
    return { error: "Hay una técnica no válida.", ok: false };
  }
  const tecnicas = intensidad === "ninguna" ? [] : Array.from(new Set(solicitadas)) as TecnicaImpulsoEjercicio[];
  const supabase = await createClient();
  const { error } = await supabase.from("ejercicios").update({
    impulso_intensidad_maxima: intensidad,
    impulso_tecnicas_permitidas: tecnicas,
    impulso_requiere_supervision: formData.get("impulso_requiere_supervision") === "on",
    impulso_perfil_revisado: true,
  }).eq("id", ejercicioId);
  if (error) return { error: "No se pudo guardar el perfil de Impulso. Verifica que la migración 0082 esté aplicada.", ok: false };
  avisarCambios();
  return { error: null, ok: true };
}

/** Une un nombre libre de rutinas con una entrada oficial de la biblioteca.
 * Vincula todas sus apariciones todavía sueltas y guarda el texto como alias:
 * así se corrige lo histórico y las próximas importaciones lo reconocen sin
 * volver a pedir trabajo manual. El nombre original no se borra: queda como
 * alias y permite auditar cómo venía escrito. */
export async function vincularNombreRutinaSinEjercicio(
  _prevState: VincularNombreRutinaState,
  formData: FormData,
): Promise<VincularNombreRutinaState> {
  await requireRol(["entrenador", "admin"]);
  const nombreRutina = String(formData.get("nombre_rutina") || "").trim();
  const ejercicioId = String(formData.get("ejercicio_id") || "").trim();
  if (!nombreRutina || !ejercicioId) return { error: "Elige el ejercicio base.", ok: false };

  const supabase = await createClient();
  const { data: ejercicio, error: errorEjercicio } = await supabase
    .from("ejercicios")
    .select("id,nombre,aliases")
    .eq("id", ejercicioId)
    .eq("activo", true)
    .maybeSingle();
  if (errorEjercicio || !ejercicio) return { error: "Ese ejercicio base ya no está disponible.", ok: false };

  const existentes = ejercicio.aliases ?? [];
  const yaReconocido = [ejercicio.nombre, ...existentes].some((nombre) => normalizar(nombre) === normalizar(nombreRutina));
  if (!yaReconocido) {
    const { error: errorAlias } = await supabase.from("ejercicios").update({ aliases: [...existentes, nombreRutina] }).eq("id", ejercicioId);
    if (errorAlias) return { error: "No se pudo guardar la variante como alias.", ok: false };
  }

  const { data: vinculadas, error: errorVincular } = await supabase
    .from("rutina_dia_ejercicios")
    .update({ ejercicio_id: ejercicioId })
    .is("ejercicio_id", null)
    .eq("nombre", nombreRutina)
    .select("id");
  if (errorVincular) return { error: "El alias quedó guardado, pero no se pudieron vincular las rutinas. Intenta otra vez.", ok: false };

  avisarCambios();
  const cantidad = vinculadas?.length ?? 0;
  return {
    error: null,
    ok: true,
    mensaje: cantidad
      ? `${cantidad} ${cantidad === 1 ? "aparición vinculada" : "apariciones vinculadas"} a ${ejercicio.nombre}.`
      : `La variante quedó guardada como alias de ${ejercicio.nombre}.`,
  };
}

/**
 * Para el modal de un ejercicio en la galería: todas las variantes de texto
 * (tal como las escribió el entrenador o las extrajo el import del PDF) que
 * HOY apuntan a este ejercicio de la biblioteca, agrupadas y contadas —
 * cuántas filas de `rutina_dia_ejercicios` (de cualquier alumno) lo usan.
 *
 * Sirve para notar de un vistazo si algo quedó mal vinculado ("Press de
 * hombro" apareciendo bajo "Press de banca", por ejemplo) sin depender de
 * toparse con el error a mitad de la sesión de un alumno.
 */
export async function obtenerUsosRutina(ejercicioId: string): Promise<UsoRutina[]> {
  await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("rutina_dia_ejercicios").select("nombre").eq("ejercicio_id", ejercicioId);

  const conteos = new Map<string, number>();
  for (const fila of data ?? []) {
    conteos.set(fila.nombre, (conteos.get(fila.nombre) ?? 0) + 1);
  }
  return Array.from(conteos.entries())
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export type ReasignarState = { error: string | null; ok: boolean };

/**
 * Corrige un enlace mal hecho SIN tocar la foto de ningún ejercicio: mueve
 * TODAS las entradas de rutina (de cualquier alumno) que dicen literalmente
 * `nombre_exacto` y hoy apuntan a `ejercicio_id_actual`, para que apunten a
 * `ejercicio_id_nuevo` en su lugar — o las desvincula (`null`, sin foto por
 * ahora) si el ejercicio correcto todavía no existe en la biblioteca.
 *
 * Es a propósito "por nombre exacto + ejercicio actual", no "por una fila
 * puntual de un alumno": el mismo error de vinculación se repite en todos
 * los alumnos que comparten esa rutina (viene del mismo import de PDF), así
 * que corregirlo de a un alumno dejaría el resto con la misma falla.
 */
export async function reasignarEntradaRutina(
  _prevState: ReasignarState,
  formData: FormData
): Promise<ReasignarState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioIdActual = String(formData.get("ejercicio_id_actual") || "");
  const nombreExacto = String(formData.get("nombre_exacto") || "");
  const ejercicioIdNuevo = String(formData.get("ejercicio_id_nuevo") || "") || null;

  if (!ejercicioIdActual || !nombreExacto) return { error: "Faltan datos.", ok: false };
  if (ejercicioIdNuevo === ejercicioIdActual) {
    return { error: "Elegí un ejercicio distinto al actual.", ok: false };
  }

  const { error } = await supabase
    .from("rutina_dia_ejercicios")
    .update({ ejercicio_id: ejercicioIdNuevo })
    .eq("ejercicio_id", ejercicioIdActual)
    .eq("nombre", nombreExacto);

  if (error) return { error: "No se pudo reasignar. Probá de nuevo.", ok: false };

  avisarCambios();
  return { error: null, ok: true };
}
