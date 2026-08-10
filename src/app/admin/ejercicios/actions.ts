"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { TAG_BIBLIOTECA_EJERCICIOS } from "@/lib/ejercicios/data";
import { TAG_TECNICAS_ENTRENAMIENTO } from "@/lib/generador-rutinas/data";
import { idDeYoutube } from "@/lib/ejercicios/video";
import {
  bufferAImagenBlob,
  procesarImagen,
  TAMANO_MAXIMO_FOTO as TAMANO_MAXIMO,
  TIPOS_IMAGEN,
} from "@/lib/ejercicios/procesarFoto";
import type { CategoriaEjercicio, EquipoEjercicio, NivelEjercicio } from "@/lib/ejercicios/tipos";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import {
  consultarVideoCloudflare,
  eliminarVideoCloudflare,
  solicitarSubidaDirecta,
} from "@/lib/cloudflare/stream";

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
    const valor = Number(formData.get(nombre));
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
    .select("foto_miniatura_url, foto_completa_url")
    .eq("id", ejercicioId)
    .maybeSingle();

  let urlMini = "";
  let urlCompleta = "";
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

  let { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({ foto_miniatura_url: urlMini, foto_completa_url: urlCompleta, ...encuadre })
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
  // ejercicio, se borran los archivos viejos — best-effort: si esto falla
  // (permisos, ya no existían), la foto nueva ya quedó bien de todos modos,
  // no tiene sentido devolver error por un archivo huérfano.
  const rutaMiniNueva = urlMini.split("/ejercicios-fotos/")[1];
  const rutaCompletaNueva = urlCompleta.split("/ejercicios-fotos/")[1];
  const rutasViejas = [fotoAnterior?.foto_miniatura_url, fotoAnterior?.foto_completa_url]
    .filter((url): url is string => !!url)
    .map((url) => url.split("/ejercicios-fotos/")[1])
    .filter((ruta): ruta is string => !!ruta && ruta !== rutaMiniNueva && ruta !== rutaCompletaNueva);
  if (reemplazoFoto && rutasViejas.length > 0) {
    await supabase.storage.from("ejercicios-fotos").remove(rutasViejas);
  }

  // Reemplazar la referencia corrige el problema de raíz para todos los
  // alumnos; todos los reportes pendientes de este ejercicio quedan resueltos
  // en el mismo paso. Best-effort para poder desplegar código antes de 0048.
  if (reemplazoFoto) {
    await supabase
      .from("reportes_fotos_ejercicios")
      .update({ estado: "resuelto", resuelto_en: new Date().toISOString(), resuelto_por: entrenador.userId })
      .eq("ejercicio_id", ejercicioId)
      .eq("estado", "pendiente");
  }

  avisarCambios();
  return { error: null, ok: true };
}

/** Cierra manualmente un aviso falso o uno que no pudo vincularse a una fila
 * de la biblioteca. Reemplazar una foto lo resuelve automáticamente. */
export async function resolverReporteFoto(formData: FormData): Promise<void> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const reporteId = String(formData.get("reporte_id") || "");
  if (!reporteId) return;
  const supabase = await createClient();
  await supabase
    .from("reportes_fotos_ejercicios")
    .update({ estado: "resuelto", resuelto_en: new Date().toISOString(), resuelto_por: entrenador.userId })
    .eq("id", reporteId);
  revalidatePath("/admin/ejercicios");
}

export type CrearEjercicioState = { error: string | null; ok: boolean };

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
  const grupoMuscular = String(formData.get("grupo_muscular") || "") as GrupoMuscular;
  const categoria = String(formData.get("categoria") || "") as CategoriaEjercicio;
  const equipo = String(formData.get("equipo") || "") as EquipoEjercicio;
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
  if (!grupoMuscular) return { error: "Elegí el grupo muscular.", ok: false };
  if (!categoria) return { error: "Elegí la categoría.", ok: false };
  if (!equipo) return { error: "Elegí el equipo.", ok: false };

  let slug = generarSlug(nombre);
  if (!slug) return { error: "Ese nombre no sirve para generar un identificador único.", ok: false };

  // Si ya existe ese slug (dos ejercicios con nombre parecido), se le suma un
  // sufijo numérico en vez de fallar por la restricción unique.
  const { count } = await supabase
    .from("ejercicios")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  if (count && count > 0) slug = `${slug}-${count + 1}`;

  const { data: nuevo, error: errorInsert } = await supabase
    .from("ejercicios")
    .insert({
      slug,
      nombre,
      aliases,
      grupo_muscular: grupoMuscular,
      categoria,
      equipo,
      nivel: "intermedio" as NivelEjercicio,
    })
    .select("id")
    .single();

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
    }
    const resultadoFoto = await subirFotoEjercicio({ error: null, ok: false }, datosFoto);
    if (resultadoFoto.error) {
      // El ejercicio ya quedó creado — no se pierde el alta por un problema
      // con la foto, se avisa aparte para que la suba de nuevo desde la
      // galería.
      return { error: `Ejercicio creado, pero la foto falló: ${resultadoFoto.error}`, ok: true };
    }
  }

  avisarCambios();
  return { error: null, ok: true };
}

export type ActualizarNombreState = { error: string | null; ok: boolean };

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
    .select("video_cloudflare_uid")
    .eq("id", ejercicioId)
    .maybeSingle();
  const { error } = await supabase
    .from("ejercicios")
    .update({
      video_url: null,
      video_cloudflare_uid: resultado.uid,
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
  if (anterior?.video_cloudflare_uid && anterior.video_cloudflare_uid !== resultado.uid) {
    await eliminarVideoCloudflare(anterior.video_cloudflare_uid);
  }
  avisarCambios();
  return { ok: true, endpoint: resultado.endpoint };
}

export async function confirmarSubidaVideoCloudflare(ejercicioId: string): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return;
  await (await createClient())
    .from("ejercicios")
    .update({ video_cloudflare_estado: "procesando" })
    .eq("id", ejercicioId)
    .eq("video_cloudflare_estado", "subiendo");
  avisarCambios();
}

export async function sincronizarVideoCloudflare(
  ejercicioId: string
): Promise<"procesando" | "listo" | "error" | null> {
  await requireRol(["entrenador", "admin"]);
  if (!ejercicioId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ejercicios")
    .select("video_cloudflare_uid")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (!data?.video_cloudflare_uid) return null;

  const estado = await consultarVideoCloudflare(data.video_cloudflare_uid);
  if (!estado) return null;
  await supabase
    .from("ejercicios")
    .update({
      video_cloudflare_estado: estado.estado,
      video_cloudflare_duracion_seg: estado.duracion,
      video_cloudflare_miniatura_url: estado.miniaturaUrl,
      video_cloudflare_error: estado.error,
    })
    .eq("id", ejercicioId)
    .eq("video_cloudflare_uid", data.video_cloudflare_uid);
  avisarCambios();
  return estado.estado;
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
