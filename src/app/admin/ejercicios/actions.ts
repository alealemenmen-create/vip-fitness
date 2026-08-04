"use server";

import sharp from "sharp";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { TAG_BIBLIOTECA_EJERCICIOS } from "@/lib/ejercicios/data";
import type { CategoriaEjercicio, EquipoEjercicio, NivelEjercicio } from "@/lib/ejercicios/tipos";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB, la foto sin procesar del celular.
const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function avisarCambios() {
  // Mismo aviso que usa cualquier edición de la biblioteca (ver
  // src/lib/ejercicios/data.ts): sin esto el cambio tarda hasta 1h en
  // aparecer para los alumnos, por el cacheo de `obtenerBiblioteca`.
  updateTag(TAG_BIBLIOTECA_EJERCICIOS);
  revalidatePath("/admin/ejercicios");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/entrenar/[id]", "page");
}

export type SubirFotoState = { error: string | null; ok: boolean };

/**
 * Sube (o reemplaza) la foto de un ejercicio ya existente en la biblioteca.
 *
 * Genera dos versiones a partir de la MISMA foto que sube el entrenador —
 * nunca dos fotos distintas — para que la miniatura chica de la tarjeta y la
 * foto completa del visor ampliado sean siempre la misma imagen:
 *   - miniatura: 500px de ancho, recortada 4:3 (para la tarjetita).
 *   - completa: 1400px de ancho, SIN recortar (respeta el encuadre entero).
 * `.rotate()` sin argumentos aplica la orientación EXIF del celular, así la
 * foto queda derecha sin depender de que el navegador la interprete.
 */
export async function subirFotoEjercicio(
  _prevState: SubirFotoState,
  formData: FormData
): Promise<SubirFotoState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const archivo = formData.get("foto") as File | null;

  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!archivo || archivo.size === 0) return { error: "Elegí una foto.", ok: false };
  if (archivo.size > TAMANO_MAXIMO) return { error: "La foto pesa demasiado (máx. 15 MB).", ok: false };
  if (archivo.type && !TIPOS_IMAGEN.has(archivo.type)) {
    return { error: "Formato no soportado — subí una foto JPG, PNG o HEIC.", ok: false };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  let miniatura: Buffer;
  let completa: Buffer;
  try {
    const base = sharp(bytes).rotate();
    [miniatura, completa] = await Promise.all([
      base.clone().resize({ width: 500, height: 375, fit: "cover" }).webp({ quality: 80 }).toBuffer(),
      base.clone().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    ]);
  } catch {
    return { error: "No se pudo procesar esa foto — probá con otra.", ok: false };
  }

  // Timestamp en el nombre: fuerza a que sea una URL nueva cada vez que se
  // reemplaza la foto, así el navegador del alumno no sigue mostrando la
  // vieja desde caché con la URL de siempre.
  const sello = Date.now();
  const rutaMini = `${ejercicioId}/miniatura-${sello}.webp`;
  const rutaCompleta = `${ejercicioId}/completa-${sello}.webp`;

  const [subeMini, subeCompleta] = await Promise.all([
    supabase.storage.from("ejercicios-fotos").upload(rutaMini, miniatura, {
      contentType: "image/webp",
    }),
    supabase.storage.from("ejercicios-fotos").upload(rutaCompleta, completa, {
      contentType: "image/webp",
    }),
  ]);
  if (subeMini.error || subeCompleta.error) {
    return { error: "No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.", ok: false };
  }

  const urlMini = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaMini).data.publicUrl;
  const urlCompleta = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaCompleta).data.publicUrl;

  const { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({ foto_miniatura_url: urlMini, foto_completa_url: urlCompleta })
    .eq("id", ejercicioId);

  if (errorUpdate) {
    return { error: "La foto se subió pero no se pudo guardar en el ejercicio.", ok: false };
  }

  avisarCambios();
  return { error: null, ok: true };
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

  const nombre = String(formData.get("nombre") || "").trim();
  const grupoMuscular = String(formData.get("grupo_muscular") || "") as GrupoMuscular;
  const categoria = String(formData.get("categoria") || "") as CategoriaEjercicio;
  const equipo = String(formData.get("equipo") || "") as EquipoEjercicio;
  const archivo = formData.get("foto") as File | null;

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

  if (archivo && archivo.size > 0) {
    const datosFoto = new FormData();
    datosFoto.set("ejercicio_id", nuevo.id);
    datosFoto.set("foto", archivo);
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
