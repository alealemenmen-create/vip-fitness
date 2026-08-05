"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_RE, OBJETIVOS, SEXOS, TELEFONO_RE } from "@/lib/solicitudes/campos";
import type { Sexo } from "@/lib/supabase/types";

export type SolicitudState = {
  error: string | null;
  ok: boolean;
  /** Id de la solicitud recién creada. El paso del comprobante lo necesita
   * para saber a qué inscripción pegarle el archivo — es la única credencial
   * que tiene quien se está inscribiendo, que todavía no es usuario de la
   * app. Va bien como tal por ser un uuid v4: no se adivina. */
  solicitudId?: string;
};

const fail = (mensaje: string): SolicitudState => ({ error: mensaje, ok: false });


/**
 * Anti-spam del link público. Es a propósito una ventana en memoria y no una
 * tabla: el link se comparte por WhatsApp de a uno, el volumen real es de unas
 * pocas solicitudes por día, y una consulta extra a la base por cada visita no
 * se justifica. Si el proceso se reinicia se pierde la cuenta — el peor caso
 * es que un bot logre unas solicitudes más, que el entrenador rechaza de a
 * una. El índice único por correo pendiente (migración 0032) cubre el caso
 * mucho más común: la persona toca "Enviar" dos veces.
 */
const VENTANA_MS = 60 * 60 * 1000;
const MAX_POR_VENTANA = 5;
const intentosPorIp = new Map<string, number[]>();

function demasiadosIntentos(ip: string): boolean {
  const ahora = Date.now();
  const previos = (intentosPorIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  intentosPorIp.set(ip, previos);

  // Limpieza oportunista: sin esto el Map crece con cada IP que pasó una vez.
  if (intentosPorIp.size > 500) {
    for (const [clave, marcas] of intentosPorIp) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) intentosPorIp.delete(clave);
    }
  }

  return previos.length > MAX_POR_VENTANA;
}

async function ipDelVisitante(): Promise<string> {
  const cabeceras = await headers();
  const reenviada = cabeceras.get("x-forwarded-for");
  return reenviada?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || "desconocida";
}

/** Convierte un campo numérico del formulario, validando el rango. Devuelve
 * `undefined` si el valor es inválido para que el llamador corte con error. */
function numeroOpcional(valor: string, min: number, max: number): number | null | undefined {
  if (!valor.trim()) return null;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

/**
 * Alta pública: la persona llega por el link que le mandaron por WhatsApp y
 * deja sus datos. NO se crea cuenta de Auth acá (ver el encabezado de la
 * migración 0032); la solicitud queda pendiente hasta que el entrenador la
 * acepta desde su panel.
 *
 * Escribe con el cliente admin porque la tabla no tiene política de insert:
 * es la única puerta de entrada, y así toda validación pasa por este archivo.
 */
export async function enviarSolicitudRegistro(
  _prevState: SolicitudState,
  formData: FormData
): Promise<SolicitudState> {
  // Campo trampa: invisible para una persona, irresistible para un bot que
  // rellena todos los inputs del formulario. Si viene con algo, se descarta en
  // silencio (responder "ok" evita que el bot pruebe otra variante).
  if (String(formData.get("sitio_web") || "")) return { error: null, ok: true };

  if (demasiadosIntentos(await ipDelVisitante())) {
    return fail("Recibimos varias solicitudes desde aquí. Intenta de nuevo en un rato.");
  }

  const texto = (campo: string) => String(formData.get(campo) || "").trim();

  const nombre = texto("nombre");
  const email = texto("email").toLowerCase();
  const telefono = texto("telefono");
  const fechaNacimiento = texto("fecha_nacimiento");
  const sexo = texto("sexo");
  const objetivo = texto("objetivo");

  if (nombre.length < 2) return fail("Ingresa tu nombre completo.");
  if (!EMAIL_RE.test(email)) return fail("Ingresa un correo válido.");
  if (!TELEFONO_RE.test(telefono)) return fail("Ingresa un teléfono válido para WhatsApp.");

  const estaturaCm = numeroOpcional(texto("estatura_cm"), 80, 260);
  if (estaturaCm === undefined) return fail("Ingresa una estatura válida en centímetros.");

  const pesoKg = numeroOpcional(texto("peso_kg"), 20, 500);
  if (pesoKg === undefined) return fail("Ingresa un peso válido en kilos.");

  if (fechaNacimiento && Number.isNaN(Date.parse(fechaNacimiento))) {
    return fail("Ingresa una fecha de nacimiento válida.");
  }
  // Listas cerradas: cualquier otro valor viene de un formulario manipulado, y
  // el check de la base lo rechazaría igual con un error mucho menos claro.
  if (sexo && !SEXOS.some((s) => s.valor === sexo)) return fail("Elige una opción válida.");
  if (objetivo && !OBJETIVOS.includes(objetivo as (typeof OBJETIVOS)[number])) {
    return fail("Elige un objetivo válido.");
  }

  const admin = createAdminClient();

  // No se comprueba acá si el correo ya tiene cuenta: Auth no ofrece búsqueda
  // por correo y recorrer todos los usuarios en cada visita al link público
  // sale caro. Si ya existe, al aceptar la solicitud el alta avisa "Ya existe
  // una cuenta con ese correo" y el entrenador resuelve desde su panel.
  const { data: yaPendiente } = await admin
    .from("solicitudes_registro")
    .select("id")
    .ilike("email", email)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (yaPendiente) {
    return fail("Ya tenemos tu solicitud y la estamos revisando. Te avisamos apenas esté lista.");
  }

  const { data: creada, error } = await admin
    .from("solicitudes_registro")
    .insert({
      nombre,
      email,
      telefono,
      fecha_nacimiento: fechaNacimiento || null,
      sexo: (sexo || null) as Sexo | null,
      estatura_cm: estaturaCm,
      peso_kg: pesoKg,
      objetivo: objetivo || null,
      condicion_medica: texto("condicion_medica") || null,
      restriccion_alimenticia: texto("restriccion_alimenticia") || null,
      mensaje: texto("mensaje") || null,
    })
    .select("id")
    .single();

  if (error || !creada) {
    // 23505 = el índice único de correo pendiente. Pasa cuando dos envíos
    // salen casi juntos y el select de arriba no alcanzó a ver el primero.
    if (error?.code === "23505") {
      return fail("Ya tenemos tu solicitud y la estamos revisando.");
    }
    console.error("[registro] insert solicitud falló:", error);
    return fail("No pudimos enviar tu solicitud. Revisa tu conexión e intenta nuevamente.");
  }

  return { error: null, ok: true, solicitudId: creada.id };
}

// ── Comprobante de pago ────────────────────────────────────────────────────

export type ComprobanteState = { error: string | null; ok: boolean };

const TAMANO_MAXIMO_COMPROBANTE = 12 * 1024 * 1024; // 12 MB
const EXTENSIONES_COMPROBANTE = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];
const CONTENT_TYPE_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

/**
 * Sube el capture de la transferencia y lo deja pegado a la solicitud.
 *
 * Se puede repetir: si mandó el archivo equivocado, vuelve a subir y el nuevo
 * reemplaza al anterior. Cada intento marca el pago como "no verificado" otra
 * vez — si el entrenador ya lo había revisado, tiene que volver a mirarlo.
 */
export async function subirComprobante(
  _prevState: ComprobanteState,
  formData: FormData
): Promise<ComprobanteState> {
  const solicitudId = String(formData.get("solicitud_id") || "");
  const archivo = formData.get("archivo") as File | null;

  if (!solicitudId) return { error: "No encontramos tu inscripción.", ok: false };
  if (!archivo || archivo.size === 0) return { error: "Elige el comprobante.", ok: false };
  if (archivo.size > TAMANO_MAXIMO_COMPROBANTE) {
    return { error: "El archivo supera los 12 MB. Prueba con una captura de pantalla.", ok: false };
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "";
  if (!EXTENSIONES_COMPROBANTE.includes(extension)) {
    return { error: "Formato no soportado. Usa una imagen (JPG, PNG) o un PDF.", ok: false };
  }

  const admin = createAdminClient();

  // La solicitud tiene que existir y seguir pendiente: sin esto, el id de una
  // inscripción ya resuelta serviría para subir archivos indefinidamente.
  const { data: solicitud } = await admin
    .from("solicitudes_registro")
    .select("id, estado")
    .eq("id", solicitudId)
    .maybeSingle();

  if (!solicitud || solicitud.estado !== "pendiente") {
    return { error: "No encontramos tu inscripción.", ok: false };
  }

  const contentType =
    archivo.type || CONTENT_TYPE_POR_EXTENSION[extension] || "application/octet-stream";
  const storagePath = `${solicitudId}/${Date.now()}.${extension}`;
  const bytes = await archivo.arrayBuffer();

  const { error: errorSubida } = await admin.storage
    .from("comprobantes")
    .upload(storagePath, bytes, { contentType });

  if (errorSubida) {
    console.error("[registro] subida de comprobante falló:", errorSubida);
    return { error: "No pudimos subir el comprobante. Intenta nuevamente.", ok: false };
  }

  const { error: errorUpdate } = await admin
    .from("solicitudes_registro")
    .update({
      comprobante_path: storagePath,
      comprobante_subido_en: new Date().toISOString(),
      pago_verificado: false,
      pago_verificado_por: null,
      pago_verificado_en: null,
    })
    .eq("id", solicitudId);

  if (errorUpdate) {
    // El archivo quedó huérfano en Storage; se borra para no dejar basura que
    // nadie va a poder asociar a ninguna solicitud.
    await admin.storage.from("comprobantes").remove([storagePath]);
    console.error("[registro] no se pudo guardar el comprobante:", errorUpdate);
    return { error: "No pudimos guardar el comprobante. Intenta nuevamente.", ok: false };
  }

  return { error: null, ok: true };
}
