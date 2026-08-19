"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import convertirHeic from "heic-convert";
import sharp from "sharp";
import {
  fechaEnQuincenaActualValida,
  fechaEnVentanaValida,
  finQuincenaISO,
  hoyISO,
  quincenaDeISO,
} from "@/lib/date";
import {
  recalcularFotoQuincena,
  recalcularPesoSemana,
  registrarFoto,
  registrarPeso,
} from "@/lib/ranking/movimientos";

export type FormState = { error: string | null; ok: boolean; puntos?: number; aviso?: string };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

/** Lo que se devuelve cuando el entrenador está mirando la cuenta de un
 * alumno: ahí no se puede escribir.
 *
 * Antes esto era `auth.getUser().id` a secas (mismo bug que ya se había
 * diagnosticado y arreglado en `comer/actions.ts`): con el entrenador en
 * "ver como alumno", el usuario autenticado sigue siendo el entrenador, así
 * que el peso/foto se guardaba en su propia cuenta y no en la del alumno que
 * estaba mirando. `requireAlumno()` es la única fuente de verdad sobre de
 * quién es la pantalla, y además dice si la vista es de solo lectura. */
const ERROR_SOLO_LECTURA =
  "Estás viendo la cuenta de un alumno en modo lectura. Sal de esa vista para registrar progreso.";

async function alumnoDeProgreso(): Promise<
  { ok: true; alumnoId: string } | { ok: false; error: string }
> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: ERROR_SOLO_LECTURA };
  return { ok: true, alumnoId };
}

export async function agregarPeso(_prevState: FormState, formData: FormData): Promise<FormState> {
  const quien = await alumnoDeProgreso();
  if (!quien.ok) return fail(quien.error);
  const alumnoId = quien.alumnoId;
  const supabase = await createClient();

  const pesoKg = Number(formData.get("peso_kg"));
  const fecha = String(formData.get("fecha") || "");
  const observacion = String(formData.get("observacion") || "").trim();

  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    return fail("Ingresa un peso válido (mayor a cero).");
  }
  if (!fecha) return fail("Selecciona una fecha.");
  if (!fechaEnVentanaValida(fecha)) {
    return fail("Solo puedes registrar el peso de hoy o de ayer.");
  }

  const { data: registroDelDia, error: errorLectura } = await supabase
    .from("pesos_corporales")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("fecha", fecha)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorLectura) return fail("No fue posible comprobar el peso de hoy. Revisa tu conexión e intenta nuevamente.");

  const escritura = registroDelDia
    ? supabase.from("pesos_corporales").update({
        peso_kg: pesoKg,
        observacion: observacion || null,
      }).eq("id", registroDelDia.id)
    : supabase.from("pesos_corporales").insert({
        alumno_id: alumnoId,
        peso_kg: pesoKg,
        fecha,
        registrado_por: alumnoId,
        observacion: observacion || null,
      });

  const { error } = await escritura;

  if (error) return fail("No fue posible guardar el peso. Revisa tu conexión e intenta nuevamente.");

  const puntos = await registrarPeso(alumnoId, fecha);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/progreso");
  revalidatePath("/portal-v2/progreso");
  revalidatePath("/alumno/inicio");
  // `registrarPeso` devuelve el delta real (ver `guardarMovimientoConDelta`):
  // el segundo peso de la misma semana no acredita nada y hay que decirlo.
  if (!puntos) {
    return {
      ...okState,
      aviso: registroDelDia
        ? "Peso de hoy actualizado. La recompensa semanal ya estaba registrada."
        : "Peso guardado. Ya tenías la recompensa de peso de esta semana.",
    };
  }
  return { ...okState, puntos };
}

export async function eliminarPeso(pesoId: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;
  const supabase = await createClient();
  const { data: peso } = await supabase
    .from("pesos_corporales")
    .select("fecha")
    .eq("id", pesoId)
    .maybeSingle();
  await supabase.from("pesos_corporales").delete().eq("id", pesoId);
  if (peso?.fecha) await recalcularPesoSemana(alumnoId, peso.fecha);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/progreso");
  revalidatePath("/portal-v2/progreso");
  revalidatePath("/alumno/inicio");
}

const TAMANO_MAXIMO_FOTO = 12 * 1024 * 1024; // 12 MB
const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const EXTENSIONES_PERMITIDAS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

export async function subirFotoProgreso(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const quien = await alumnoDeProgreso();
  if (!quien.ok) return fail(quien.error);
  const alumnoId = quien.alumnoId;
  const supabase = await createClient();

  const archivo = formData.get("archivo") as File | null;
  const fechaFoto = String(formData.get("fecha_foto") || "") || hoyISO();

  if (!archivo || archivo.size === 0) return fail("Selecciona una foto.");
  // Galería quincenal (pedido de Alejandro, 2026-08-16: "semanal es muy
  // pronto para ver resultados"): una foto cada 15 días, y solo se puede
  // subir/reemplazar la de la quincena EN CURSO. Antes se aceptaba
  // cualquier fecha pasada razonable ("fotos de antes" desde la galería del
  // teléfono, hasta 10 años atrás) — eso ya no aplica: una quincena cerrada
  // queda cerrada, no se puede rellenar después. Las fotos que ya existían
  // con esa fecha vieja no se tocan ni se pierden, siguen viéndose en la
  // quincena que les corresponde.
  if (!fechaEnQuincenaActualValida(fechaFoto)) {
    return fail("Solo puedes subir la foto de esta quincena. Elige una fecha dentro de los últimos 15 días.");
  }

  const extensionArchivo = archivo.name.split(".").pop()?.toLowerCase() || "";
  const tipoValido =
    TIPOS_PERMITIDOS.includes(archivo.type) || EXTENSIONES_PERMITIDAS.includes(extensionArchivo);
  if (!tipoValido) {
    return fail("Formato no soportado. Usa JPG, PNG, WEBP o HEIC.");
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO) {
    return fail("La foto supera el tamaño máximo permitido (12 MB).");
  }

  const CONTENT_TYPE_POR_EXTENSION: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };

  let contentType = archivo.type || CONTENT_TYPE_POR_EXTENSION[extensionArchivo] || "application/octet-stream";
  let extensionFinal = extensionArchivo || "jpg";
  let bytes: Buffer | ArrayBuffer = await archivo.arrayBuffer();

  // Los navegadores de escritorio no saben mostrar HEIC/HEIF en una etiqueta
  // <img>. Se convierte a JPEG aquí para que la foto siempre sea visible en
  // la galería. La mayoría de navegadores tampoco pueden decodificar HEIC
  // para comprimirlo en el cliente (comprimirImagen.ts falla y sube el HEIC
  // original sin tocar), así que el redimensionado real ocurre aquí con
  // sharp — si no, llegaría a Storage a resolución completa de cámara.
  const esHeic = extensionArchivo === "heic" || extensionArchivo === "heif" || contentType === "image/heic" || contentType === "image/heif";
  if (esHeic) {
    try {
      const jpegSinRedimensionar = await convertirHeic({
        buffer: Buffer.from(bytes),
        format: "JPEG",
        quality: 0.9,
      });
      bytes = await sharp(Buffer.from(jpegSinRedimensionar))
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      contentType = "image/jpeg";
      extensionFinal = "jpg";
    } catch {
      return fail(
        "No fue posible procesar esta foto HEIC. Prueba convertirla a JPG antes de subirla, o tómala en formato 'Más compatible' desde los ajustes de la cámara de tu iPhone."
      );
    }
  }

  // Reemplaza, no acumula: si ya había una foto para esta quincena (el
  // alumno la sube de nuevo sin pasar por "Eliminar" primero, o dos
  // pestañas abiertas a la vez), la vieja se borra de Storage y de la tabla
  // antes de guardar la nueva. Defensivo — el flujo normal ya borra a mano
  // primero, esto solo evita que dos fotos convivan en la misma quincena
  // por una carrera de clics.
  const inicioQuincena = quincenaDeISO(fechaFoto);
  const { data: existente } = await supabase
    .from("fotos_progreso")
    .select("id, storage_path")
    .eq("alumno_id", alumnoId)
    .gte("fecha_foto", inicioQuincena)
    .lte("fecha_foto", finQuincenaISO(inicioQuincena))
    .maybeSingle();
  if (existente) {
    await supabase.storage.from("fotos-progreso").remove([existente.storage_path]);
    await supabase.from("fotos_progreso").delete().eq("id", existente.id);
  }

  const storagePath = `${alumnoId}/${Date.now()}.${extensionFinal}`;

  const { error: errorSubida } = await supabase.storage
    .from("fotos-progreso")
    .upload(storagePath, bytes, { contentType });

  if (errorSubida) return fail("No fue posible subir la foto. Revisa tu conexión e intenta nuevamente.");

  const { error: errorInsert } = await supabase.from("fotos_progreso").insert({
    alumno_id: alumnoId,
    storage_path: storagePath,
    fecha_foto: fechaFoto,
  });

  if (errorInsert) return fail("La foto se subió, pero no fue posible registrarla.");

  // Toda foto aceptada acá ya cayó dentro de la quincena en curso (se
  // validó arriba), así que siempre corresponde la recompensa. `registrarFoto`
  // sigue devolviendo 0 si esta quincena ya había ganado la recompensa (por
  // ejemplo, reemplazando la foto sin ganar puntos dos veces).
  const puntos = await registrarFoto(alumnoId, fechaFoto);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/progreso");
  revalidatePath("/portal-v2/progreso");
  revalidatePath("/alumno/inicio");
  if (!puntos) {
    return { ...okState, aviso: "Foto guardada. Ya tenías la recompensa de foto de esta quincena." };
  }
  return { ...okState, puntos };
}

export async function eliminarFotoProgreso(fotoId: string, storagePath: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;
  const supabase = await createClient();
  const { data: foto } = await supabase
    .from("fotos_progreso")
    .select("fecha_foto")
    .eq("id", fotoId)
    .maybeSingle();
  if (!foto) return;
  // Solo la foto de la quincena EN CURSO se puede borrar: "la puede borrar,
  // puede hacer lo que quiera, pero dentro de la quincena" — una quincena
  // ya cerrada queda fija para siempre, con o sin foto. La interfaz ya no
  // ofrece el botón de borrar fuera de la quincena actual; este chequeo es
  // la versión que no se puede saltar desde el cliente.
  if (!fechaEnQuincenaActualValida(foto.fecha_foto)) return;
  await supabase.storage.from("fotos-progreso").remove([storagePath]);
  await supabase.from("fotos_progreso").delete().eq("id", fotoId);
  await recalcularFotoQuincena(alumnoId, foto.fecha_foto);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/progreso");
  revalidatePath("/portal-v2/progreso");
  revalidatePath("/alumno/inicio");
}
