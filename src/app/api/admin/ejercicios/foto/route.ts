import { randomUUID } from "node:crypto";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { procesarImagen, TAMANO_MAXIMO_FOTO, TIPOS_IMAGEN } from "@/lib/ejercicios/procesarFoto";

export const dynamic = "force-dynamic";

/**
 * Sube una foto a Storage YA, sin vincularla todavía a ningún ejercicio —
 * se llama apenas se elige/saca la foto en GaleriaEjercicios.tsx, antes de
 * que el entrenador termine de llenar el resto del formulario.
 *
 * Es una ruta de verdad (`fetch` con un POST normal), NO un Server Action
 * llamado directo — a diferencia de una Server Action (que viaja envuelta en
 * el protocolo RSC de Next), acá el archivo llega tal cual en el cuerpo del
 * request, sin nada de por medio que pueda tocarlo.
 *
 * Motivo real de este cambio: las fotos subidas vía Server Action llegaban
 * a Storage corruptas — confirmado bajándolas después y viendo sus bytes
 * (el patrón exacto de forzar datos binarios a texto UTF-8, byte por byte).
 * Una subida aislada, directa a Supabase Storage sin pasar por ningún
 * Server Action, se comprobó bit a bit idéntica — así que el problema
 * estaba en ese camino puntual, no en Storage ni en el procesamiento de la
 * imagen. Esta ruta evita ese camino por completo.
 */
export async function POST(request: Request): Promise<Response> {
  await requireRol(["entrenador", "admin"]);

  // DIAGNÓSTICO TEMPORAL: un patrón fijo (los 256 valores de byte posibles),
  // generado en el propio servidor — no depende del navegador ni del
  // archivo que suba el entrenador. Sirve para aislar si la corrupción pasa
  // ANTES de este punto (algo con el archivo real, en el camino
  // navegador→servidor) o DESPUÉS (algo con esta subida a Storage
  // puntualmente, corriendo en el entorno real de producción — la prueba
  // local anterior corrió en otra máquina, no en este mismo entorno
  // desplegado). Sacar una vez que se encuentre la causa.
  const patronFijo = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) patronFijo[i] = i;
  const resultadoPatron = await (await createClient()).storage
    .from("ejercicios-fotos")
    .upload("_diagnostico/patron-fijo.bin", patronFijo, { contentType: "image/webp", upsert: true });

  const formData = await request.formData();
  const archivo = formData.get("foto") as File | null;

  if (!archivo || archivo.size === 0) {
    return Response.json({ ok: false, error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO) {
    return Response.json({ ok: false, error: "La foto pesa demasiado (máx. 15 MB)." }, { status: 400 });
  }
  if (archivo.type && !TIPOS_IMAGEN.has(archivo.type)) {
    return Response.json(
      { ok: false, error: "Formato no soportado — subí una foto JPG, PNG o HEIC." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  const supabase = await createClient();
  // Carpeta al azar: en este momento todavía no existe (o no se conoce) el
  // id del ejercicio al que va a terminar vinculada esta foto — no hace
  // falta moverla después, la URL ya es la definitiva.
  const carpeta = `sueltas/${randomUUID()}`;
  const rutaMini = `${carpeta}/miniatura.webp`;
  const rutaCompleta = `${carpeta}/completa.webp`;

  // DIAGNÓSTICO TEMPORAL: guarda los bytes tal cual llegaron al servidor,
  // ANTES de que sharp los toque — para poder comparar el tamaño que dice el
  // navegador (`archivo.size`) contra lo que de verdad recibió el servidor
  // (`bytes.length`), y bajar este archivo crudo aparte para ver si la
  // corrupción ya está acá (algo en el camino navegador→servidor) o si
  // aparece recién al procesarla. Sacar una vez que se encuentre la causa.
  const resultadoCrudo = await supabase.storage
    .from("ejercicios-fotos")
    .upload(`${carpeta}/original-crudo.bin`, bytes, { contentType: "image/webp" });

  const diagnostico = {
    tamanoNavegador: archivo.size,
    tamanoRecibido: bytes.length,
    carpeta,
    errorPatronFijo: resultadoPatron.error?.message ?? null,
    errorOriginalCrudo: resultadoCrudo.error?.message ?? null,
  };

  const procesada = await procesarImagen(bytes);
  if ("error" in procesada) {
    return Response.json({ ok: false, error: procesada.error, diagnostico }, { status: 400 });
  }

  const [subeMini, subeCompleta] = await Promise.all([
    supabase.storage.from("ejercicios-fotos").upload(rutaMini, procesada.miniatura, { contentType: "image/webp" }),
    supabase.storage.from("ejercicios-fotos").upload(rutaCompleta, procesada.completa, { contentType: "image/webp" }),
  ]);
  if (subeMini.error || subeCompleta.error) {
    return Response.json(
      { ok: false, error: "No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.", diagnostico },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    miniaturaUrl: supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaMini).data.publicUrl,
    completaUrl: supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaCompleta).data.publicUrl,
    diagnostico,
  });
}
