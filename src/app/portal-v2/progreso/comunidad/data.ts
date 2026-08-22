import "server-only";

import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerNoticias } from "@/lib/noticias/data";
import { obtenerRanking } from "@/lib/ranking/data";
import { obtenerTorneosPublicos } from "@/lib/torneos/data";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { seleccionarComentariosRecientes } from "@/lib/comunidad/social";

export type FilaComunidadV2 = {
  alumnoId: string;
  nombre: string;
  iniciales: string;
  puntos: number;
  puesto: number;
  esActual: boolean;
};

export type ActividadComunidadV2 = {
  id: string;
  titulo: string;
  detalle: string;
  nombre: string;
  fecha: string;
  tipo: string;
};

export type FotoPublicableComunidadV2 = {
  id: string;
  fecha: string;
  url: string | null;
};

export type PublicacionComunidadV2 = {
  id: string;
  nombre: string;
  iniciales: string;
  texto: string;
  fecha: string;
  fotoUrl: string | null;
  aplausos: number;
  aplaudida: boolean;
  esPropia: boolean;
  comentarios: { id: string; nombre: string; iniciales: string; texto: string; fecha: string; esPropio: boolean }[];
};

export type ComunidadDatosV2 = {
  nombre: string;
  iniciales: string;
  posicionMes: number | null;
  puntosMes: number;
  impulsos: number;
  sesiones: number;
  soloLectura: boolean;
  general: FilaComunidadV2[];
  mensual: FilaComunidadV2[];
  actividad: ActividadComunidadV2[];
  socialDisponible: boolean;
  socialError: string | null;
  publicaciones: PublicacionComunidadV2[];
  fotosPublicables: FotoPublicableComunidadV2[];
  retos: { id: string; nombre: string; descripcion: string | null; fechaInicio: string; fechaFin: string; regla: string | null; modalidad: string; puntos: number; participantes: number; miEstado: string | null }[];
};

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "VIP";
}

function faltaMigracion(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /comunidad_publicaciones/i.test(error.message ?? "")));
}

async function obtenerSocialComunidadV2(alumnoId: string): Promise<Pick<ComunidadDatosV2, "socialDisponible" | "socialError" | "publicaciones" | "fotosPublicables">> {
  const db = createAdminClient();
  const [{ data: publicaciones, error }, { data: fotosPropias }] = await Promise.all([
    db.from("comunidad_publicaciones").select("id, alumno_id, foto_progreso_id, texto, created_at").eq("estado", "publicada").order("created_at", { ascending: false }).limit(30),
    db.from("fotos_progreso").select("id, alumno_id, storage_path, fecha_foto").eq("alumno_id", alumnoId).order("fecha_foto", { ascending: false }).limit(24),
  ]);
  if (faltaMigracion(error)) return { socialDisponible: false, socialError: null, publicaciones: [], fotosPublicables: [] };
  if (error) return { socialDisponible: true, socialError: "No pudimos cargar la actividad social.", publicaciones: [], fotosPublicables: [] };

  const posts = publicaciones ?? [];
  const postIds = posts.map((post) => post.id);
  const alumnoIds = [...new Set([alumnoId, ...posts.map((post) => post.alumno_id)])];
  const fotoIds = [...new Set(posts.map((post) => post.foto_progreso_id).filter((id): id is string => Boolean(id)))];
  const [resultadoReacciones, resultadoComentarios, resultadoFotos] = await Promise.all([
    postIds.length ? db.from("comunidad_reacciones").select("publicacion_id, alumno_id").in("publicacion_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? db.from("comunidad_comentarios").select("id, publicacion_id, alumno_id, texto, created_at").in("publicacion_id", postIds).eq("estado", "publicado").order("created_at", { ascending: false }).limit(240) : Promise.resolve({ data: [], error: null }),
    fotoIds.length ? db.from("fotos_progreso").select("id, alumno_id, storage_path, fecha_foto").in("id", fotoIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: reacciones, error: errorReacciones } = resultadoReacciones;
  const { data: comentarios, error: errorComentarios } = resultadoComentarios;
  const { data: fotosPublicadas, error: errorFotos } = resultadoFotos;
  if (faltaMigracion(errorReacciones ?? errorComentarios ?? errorFotos ?? null)) {
    return { socialDisponible: false, socialError: null, publicaciones: [], fotosPublicables: [] };
  }
  if (errorReacciones || errorComentarios || errorFotos) {
    return { socialDisponible: true, socialError: "No pudimos reconstruir reacciones, comentarios o fotografías.", publicaciones: [], fotosPublicables: [] };
  }
  for (const comentario of comentarios ?? []) alumnoIds.push(comentario.alumno_id);
  const idsUnicos = [...new Set(alumnoIds)];
  const { data: perfiles } = idsUnicos.length ? await db.from("perfiles").select("id, nombre").in("id", idsUnicos) : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil.nombre]));

  const fotosValidas = (fotosPublicadas ?? []).filter((foto) => posts.some((post) => post.foto_progreso_id === foto.id && post.alumno_id === foto.alumno_id));
  const todasLasFotos = [...fotosValidas, ...(fotosPropias ?? []).filter((foto) => !fotosValidas.some((publicada) => publicada.id === foto.id))];
  const urlPorFoto = new Map<string, string | null>();
  await Promise.all(todasLasFotos.map(async (foto) => {
    const { data } = await db.storage.from("fotos-progreso").createSignedUrl(foto.storage_path, 60 * 60);
    urlPorFoto.set(foto.id, data?.signedUrl ?? null);
  }));

  return {
    socialDisponible: true,
    socialError: null,
    fotosPublicables: (fotosPropias ?? []).map((foto) => ({ id: foto.id, fecha: foto.fecha_foto, url: urlPorFoto.get(foto.id) ?? null })),
    publicaciones: posts.map((post) => {
      const nombre = nombrePorId.get(post.alumno_id) ?? "Alumno VIP";
      const comentariosPost = seleccionarComentariosRecientes(comentarios ?? [], post.id);
      return {
        id: post.id,
        nombre: post.alumno_id === alumnoId ? "Tú" : nombre,
        iniciales: iniciales(nombre),
        texto: post.texto,
        fecha: post.created_at,
        fotoUrl: post.foto_progreso_id ? urlPorFoto.get(post.foto_progreso_id) ?? null : null,
        aplausos: (reacciones ?? []).filter((reaccion) => reaccion.publicacion_id === post.id).length,
        aplaudida: (reacciones ?? []).some((reaccion) => reaccion.publicacion_id === post.id && reaccion.alumno_id === alumnoId),
        esPropia: post.alumno_id === alumnoId,
        comentarios: comentariosPost.map((comentario) => {
          const autor = nombrePorId.get(comentario.alumno_id) ?? "Alumno VIP";
          return { id: comentario.id, nombre: comentario.alumno_id === alumnoId ? "Tú" : autor, iniciales: iniciales(autor), texto: comentario.texto, fecha: comentario.created_at, esPropio: comentario.alumno_id === alumnoId };
        }),
      };
    }),
  };
}

export async function obtenerComunidadV2(): Promise<ComunidadDatosV2 | null> {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return null;
  const supabase = await createClient();

  const [rankingMes, noticiasPorMes, torneos, seguimiento, social] = await Promise.all([
    obtenerRanking("mes"),
    obtenerNoticias(supabase, 3),
    obtenerTorneosPublicos(contexto.alumnoId),
    obtenerSeguimientoIntegral(supabase, contexto.alumnoId, 30),
    obtenerSocialComunidadV2(contexto.alumnoId),
  ]);

  const mensual = rankingMes.map((fila) => ({
    alumnoId: fila.alumnoId,
    nombre: fila.alumnoId === contexto.alumnoId ? "Tú" : fila.nombre,
    iniciales: iniciales(fila.nombre),
    puntos: fila.puntos,
    puesto: fila.posicion,
    esActual: fila.alumnoId === contexto.alumnoId,
  }));

  const ordenGeneral = [...rankingMes]
    .sort((a, b) => b.puntosAcumulados - a.puntosAcumulados || a.nombre.localeCompare(b.nombre, "es"));
  const general = ordenGeneral.map((fila, indice) => ({
    alumnoId: fila.alumnoId,
    nombre: fila.alumnoId === contexto.alumnoId ? "Tú" : fila.nombre,
    iniciales: iniciales(fila.nombre),
    puntos: fila.puntosAcumulados,
    puesto: indice + 1,
    esActual: fila.alumnoId === contexto.alumnoId,
  }));

  const actividad = [...noticiasPorMes.values()]
    .flat()
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.relevancia - a.relevancia)
    .slice(0, 12)
    .map((noticia) => ({
      id: noticia.id,
      titulo: noticia.titular,
      detalle: noticia.detalle,
      nombre: noticia.alumnoNombre,
      fecha: noticia.fecha,
      tipo: noticia.tipo,
    }));

  const propia = rankingMes.find((fila) => fila.alumnoId === contexto.alumnoId);
  return {
    nombre: seguimiento?.alumnoNombre ?? propia?.nombre ?? "Alumno VIP",
    iniciales: iniciales(seguimiento?.alumnoNombre ?? propia?.nombre ?? "Alumno VIP"),
    posicionMes: propia?.posicion ?? null,
    puntosMes: propia?.puntos ?? 0,
    impulsos: seguimiento?.resumen.progresionesCumplidas ?? 0,
    sesiones: seguimiento?.resumen.sesionesRealizadas ?? 0,
    soloLectura: contexto.soloLectura,
    general,
    mensual,
    actividad,
    ...social,
    retos: torneos.slice(0, 6).map((torneo) => ({
      id: torneo.id,
      nombre: torneo.nombre,
      descripcion: torneo.descripcion,
      fechaInicio: torneo.fechaInicio,
      fechaFin: torneo.fechaFin,
      regla: torneo.reglaPublica,
      modalidad: torneo.modalidad,
      puntos: torneo.puntosEnJuego,
      participantes: torneo.participantes.filter((participante) => participante.estado === "aceptado").length,
      miEstado: torneo.miEstado,
    })),
  };
}

export type PulsoComunidadV2 = {
  nombre: string;
  fecha: string;
  aplausos: number;
} | null;

/** Versión mínima de `obtenerSocialComunidadV2` para la tarjeta de pulso de
 * Entrenar: solo la última publicación de OTRO alumno (no la propia, para que
 * siempre sea una señal de comunidad, no un espejo) con sus aplausos. Nada de
 * fotos, comentarios ni el resto del feed -- eso lo sigue resolviendo
 * Comunidad completa. */
export async function obtenerPulsoComunidadV2(alumnoId: string): Promise<PulsoComunidadV2> {
  const db = createAdminClient();
  const { data: publicaciones, error } = await db
    .from("comunidad_publicaciones")
    .select("id, alumno_id, created_at")
    .eq("estado", "publicada")
    .neq("alumno_id", alumnoId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (faltaMigracion(error) || error || !publicaciones?.length) return null;

  const post = publicaciones[0];
  const [{ data: perfil }, { count: aplausos }] = await Promise.all([
    db.from("perfiles").select("nombre").eq("id", post.alumno_id).maybeSingle(),
    db.from("comunidad_reacciones").select("id", { count: "exact", head: true }).eq("publicacion_id", post.id),
  ]);

  return {
    nombre: perfil?.nombre ?? "Alumno VIP",
    fecha: post.created_at,
    aplausos: aplausos ?? 0,
  };
}
