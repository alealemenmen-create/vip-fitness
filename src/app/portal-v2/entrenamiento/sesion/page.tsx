import Link from "next/link";
import type { Viewport } from "next";
import { SesionActivaV2, type AlternativaEjercicioV2, type SesionActivaModeloV2 } from "@/components/v2/SesionActivaV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerSesionCompleta } from "@/app/alumno/entrenar/data";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import {
  esTecnicaEncadenada,
  normalizarTecnicaSesion,
  type TecnicaEncadenadaSlug,
  type TecnicaIndividualSlug,
} from "@/lib/entrenamiento/motor-tecnicas-sesion";
import { construirBloquesTecnica, resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { Database } from "@/lib/supabase/types";
import styles from "@/components/v2/PortalV2.module.css";
import { firmarMiniaturasCloudflareV2 } from "@/lib/cloudflare/miniaturas-v2";
import { urlMiniaturaFirmada } from "@/lib/cloudflare/stream";
import { obtenerSeguimientoHoy } from "@/app/alumno/inicio/data";
import { evaluarPreparacionDiariaAlejandro, limitarMomentosPorPreparacion } from "@/lib/impulso-vip/preparacion-diaria";
import { calcularDuracionSesionSegundos } from "@/lib/entrenamiento/duracion-sesion";
import { objetivoSerie } from "@/lib/entrenamiento/objetivo-serie";

// `programarAvisoDescanso` espera en el servidor hasta que vence el descanso.
// La V2 necesita el mismo margen que la sesión clásica para que un push de
// 90–180 segundos no sea cortado por el límite por defecto de la plataforma.
export const maxDuration = 300;

// Durante una serie, un gesto involuntario de pinza no debe ampliar la
// interfaz ni ocultar controles. El resto del portal conserva el zoom de
// accesibilidad; esta restriccion solo se aplica a la sesion activa.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

type FichaEjercicioV2 = Pick<Database["public"]["Tables"]["ejercicios"]["Row"],
  | "id" | "nombre" | "grupo_muscular" | "categoria" | "equipo" | "activo" | "calidad_ficha"
  | "patron_movimiento" | "grupos_secundarios" | "nivel" | "descripcion_corta" | "tecnica" | "errores_comunes" | "consejos"
  | "foto_completa_url" | "foto_miniatura_url" | "video_url" | "video_cloudflare_uid"
  | "video_cloudflare_estado" | "video_cloudflare_miniatura_url"
>;

function objetivoRepeticiones(texto: string, cantidad: number) {
  const numeros = texto.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (numeros.length === cantidad) return numeros;
  return Array.from({ length: cantidad }, () => numeros[0] ?? 0);
}

function tipoMomento(tipo: string): "cierre_controlado" | "repeticion_extra" | "rest_pause" | "drop_set" {
  if (tipo === "drop_set") return "drop_set";
  if (tipo === "rest_pause") return "rest_pause";
  if (tipo === "repeticion_objetivo") return "repeticion_extra";
  return "cierre_controlado";
}

export default async function SesionV2Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return <SesionActivaV2 />;
  if (!id) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>Elige el entrenamiento que vas a realizar</strong><p>Esta cuenta utiliza datos reales. Abre tu día desde Entrenamiento para iniciar o continuar su sesión correspondiente.</p></div>
        </section>
        <Link className={styles.primaryButton} href="/portal-v2/entrenamiento">Ver mi entrenamiento</Link>
      </div>
    );
  }

  const supabase = await createClient();
  const sesion = await obtenerSesionCompleta(supabase, contexto.alumnoId, id, { usarDescansoPreferido: false });
  if (!sesion) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>No encontramos esta sesión</strong><p>El enlace no corresponde a tu cuenta o el entrenamiento ya no está disponible.</p></div>
        </section>
        <Link className={styles.primaryButton} href="/portal-v2/entrenamiento">Volver a entrenamiento</Link>
      </div>
    );
  }
  if (sesion.ejercicios.length === 0) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>{sesion.diaNombre}</strong><p>{sesion.diaDescripcion ?? "Este día no contiene ejercicios para registrar."}</p></div>
        </section>
        <Link className={styles.primaryButton} href="/portal-v2/entrenamiento">Volver al programa</Link>
      </div>
    );
  }

  const idsSesionEjercicio = sesion.ejercicios.map((ejercicio) => ejercicio.sesionEjercicioId);
  const { data: personalizaciones, error: errorPersonalizaciones } = await supabase
    .from("sesion_ejercicio_personalizaciones")
    .select("sesion_ejercicio_id, ejercicio_sustituto_id, orden_ejecucion")
    .in("sesion_ejercicio_id", idsSesionEjercicio);
  const personalizacionDisponible = !errorPersonalizaciones;
  const personalizacionPorId = new Map((personalizaciones ?? []).map((fila) => [fila.sesion_ejercicio_id, fila]));
  const ejerciciosSesionOrdenadosSinFirma = sesion.ejercicios
    .map((ejercicio, indiceOriginal) => ({
      ejercicio,
      indiceOriginal,
      ordenPersonal: personalizacionPorId.get(ejercicio.sesionEjercicioId)?.orden_ejecucion,
    }))
    .sort((a, b) => (a.ordenPersonal ?? 10_000 + a.indiceOriginal) - (b.ordenPersonal ?? 10_000 + b.indiceOriginal))
    .map((fila) => fila.ejercicio);
  const ejerciciosSesionOrdenados = await firmarMiniaturasCloudflareV2(ejerciciosSesionOrdenadosSinFirma);

  const idsBiblioteca = new Set(ejerciciosSesionOrdenados.flatMap((ejercicio) => {
    const sustituto = personalizacionPorId.get(ejercicio.sesionEjercicioId)?.ejercicio_sustituto_id;
    return [ejercicio.ejercicioId, sustituto].filter((id): id is string => Boolean(id));
  }));
  const camposFicha = "id, nombre, grupo_muscular, grupos_secundarios, categoria, patron_movimiento, equipo, nivel, descripcion_corta, tecnica, errores_comunes, consejos, activo, calidad_ficha, foto_completa_url, foto_miniatura_url, video_url, video_cloudflare_uid, video_cloudflare_estado, video_cloudflare_miniatura_url";
  const { data: fichasBase } = idsBiblioteca.size
    ? await supabase.from("ejercicios").select(camposFicha).in("id", [...idsBiblioteca])
    : { data: [] };
  const gruposPresentes = [...new Set((fichasBase ?? []).map((ficha) => ficha.grupo_muscular).filter((grupo): grupo is NonNullable<typeof grupo> => Boolean(grupo)))];
  const { data: candidatas } = personalizacionDisponible && gruposPresentes.length
    ? await supabase
        .from("ejercicios")
        .select(camposFicha)
        .in("grupo_muscular", gruposPresentes)
        .eq("activo", true)
        .eq("calidad_ficha", "completa")
        .limit(180)
    : { data: [] };
  const fichaPorId = new Map([...(fichasBase ?? []), ...(candidatas ?? [])].map((ficha) => [ficha.id, ficha]));

  const fichasAlternativas = new Map<string, FichaEjercicioV2[]>();
  for (const ejercicio of ejerciciosSesionOrdenados) {
    const origen = ejercicio.ejercicioId ? fichaPorId.get(ejercicio.ejercicioId) : undefined;
    if (!origen?.grupo_muscular) continue;
    fichasAlternativas.set(ejercicio.sesionEjercicioId, (candidatas ?? [])
      .filter((ficha) => ficha.id !== origen.id
        && ficha.grupo_muscular === origen.grupo_muscular
        && (!origen.categoria || !ficha.categoria || ficha.categoria === origen.categoria)
        // Si el origen ya tiene el ángulo/cabeza muscular clasificado
        // (patron_movimiento), exigimos coincidencia exacta -- no basta con
        // compartir grupo_muscular, que mezcla abductor con aductor, o
        // bíceps con tríceps. Mismo criterio que sustitucionEsCompatible,
        // la validación real del lado del servidor.
        && (!origen.patron_movimiento || ficha.patron_movimiento === origen.patron_movimiento))
      .sort((a, b) => Number(b.categoria === origen.categoria) - Number(a.categoria === origen.categoria)
        || Number(a.equipo !== origen.equipo) - Number(b.equipo !== origen.equipo)
        || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 8));
  }
  const fichasQueSeMuestran = [...(fichasBase ?? []), ...[...fichasAlternativas.values()].flat()];
  const uidsMiniatura = [...new Set(fichasQueSeMuestran
    .filter((ficha) => ficha.video_cloudflare_uid && ficha.video_cloudflare_estado === "listo")
    .map((ficha) => ficha.video_cloudflare_uid as string))];
  const miniaturaFirmadaPorUid = new Map(await Promise.all(
    uidsMiniatura.map(async (uid) => [uid, await urlMiniaturaFirmada(uid)] as const)
  ));

  const fotoGrupo = (grupo: string | null | undefined) =>
    (grupo ? FOTOS_GRUPO_MUSCULAR[grupo as keyof typeof FOTOS_GRUPO_MUSCULAR]?.[0] : null)
      ?? "/v2/piernas.webp";

  const fotoFicha = (ficha: FichaEjercicioV2 | undefined, grupo: string | null) =>
    ficha?.foto_completa_url
      ?? ficha?.foto_miniatura_url
      ?? (ficha?.video_cloudflare_uid ? miniaturaFirmadaPorUid.get(ficha.video_cloudflare_uid) : null)
      ?? fotoGrupo(grupo);
  const alternativaVisual = (ficha: FichaEjercicioV2): AlternativaEjercicioV2 => ({
    id: ficha.id,
    nombre: ficha.nombre,
    foto: fotoFicha(ficha, ficha.grupo_muscular),
    fotoRespaldo: ficha.foto_miniatura_url ?? fotoGrupo(ficha.grupo_muscular),
    equipo: ficha.equipo ? ficha.equipo.replaceAll("_", " ") : "Equipo compatible",
    grupo: ficha.grupo_muscular ? ETIQUETAS_GRUPO_MUSCULAR[ficha.grupo_muscular] : "Entrenamiento",
    videoUrl: ficha.video_url ?? undefined,
    videoCloudflareListo: Boolean(ficha.video_cloudflare_uid && ficha.video_cloudflare_estado === "listo"),
  });
  const alternativas: Record<string, AlternativaEjercicioV2[]> = {};
  for (const ejercicio of ejerciciosSesionOrdenados) {
    alternativas[ejercicio.sesionEjercicioId] = (fichasAlternativas.get(ejercicio.sesionEjercicioId) ?? [])
      .map(alternativaVisual);
  }

  const bloquesTecnica = construirBloquesTecnica(ejerciciosSesionOrdenados);
  const ejercicios = ejerciciosSesionOrdenados.map((ejercicio, indice) => {
    const slug = normalizarTecnicaSesion(ejercicio.tecnicaTipo);
    const encadenada = slug !== null && esTecnicaEncadenada(slug);
    const grupoTecnica = resolverGrupoTecnica(ejercicio.tecnicaTipo);
    const familia = grupoTecnica?.etiqueta ?? "";
    const bloqueId = bloquesTecnica.get(ejercicio.sesionEjercicioId);

    const sustitutoId = personalizacionPorId.get(ejercicio.sesionEjercicioId)?.ejercicio_sustituto_id;
    const fichaSustituta = sustitutoId ? fichaPorId.get(sustitutoId) : undefined;
    const fichaOriginal = ejercicio.ejercicioId ? fichaPorId.get(ejercicio.ejercicioId) : undefined;
    const fichaVisual = fichaSustituta ?? fichaOriginal;
    const foto = fichaSustituta ? fotoFicha(fichaSustituta, fichaSustituta.grupo_muscular) : ejercicio.fotoCompletaUrl
      ?? ejercicio.fotoMiniaturaUrl
      ?? ejercicio.videoCloudflareMiniaturaUrl
      ?? (ejercicio.grupoMuscular ? FOTOS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]?.[0] : null)
      ?? "/v2/piernas.webp";
    const fotoRespaldo = fichaSustituta
      ? fichaSustituta.foto_miniatura_url ?? fotoGrupo(fichaSustituta.grupo_muscular)
      : ejercicio.fotoMiniaturaUrl ?? ejercicio.videoCloudflareMiniaturaUrl ?? fotoGrupo(ejercicio.grupoMuscular);
    const historicoPorNumero = new Map(ejercicio.series.map((serie) => [serie.numeroSerie, serie]));
    const objetivos = objetivoRepeticiones(ejercicio.repsProgramadas, ejercicio.seriesProgramadas);
    // Mismo criterio que la sesión clásica (SesionEjercicioCard.tsx): solo una
    // recomendación APROBADA o MODIFICADA precarga algo -- una "propuesta"
    // (esperando revisión del entrenador) o "bloqueada" (Regla E: dolor,
    // estancamiento, caída de rendimiento) nunca deben sugerir peso ni reps.
    // El dato ya viajaba en `ejercicio.recomendacionImpulso` (lo arma
    // obtenerSesionCompleta, compartido con V1) pero V2 nunca lo leía --
    // por eso el peso salía en blanco en vez de "calibrado" como en V1.
    // Reutiliza literalmente la prioridad probada de V1: Impulso aprobado
    // primero y, si no existe, el último peso real del alumno. Nunca inventa
    // carga para peso corporal ni para recomendaciones bloqueadas.
    const { recomendacionAprobada, pesoObjetivoKg: pesoReferenciaKg } = objetivoSerie(ejercicio, false);
    const repsSugeridasEfectivas = recomendacionAprobada?.repsObjetivoMax ?? null;
    return {
      id: ejercicio.sesionEjercicioId,
      sesionEjercicioId: ejercicio.sesionEjercicioId,
      bibliotecaEjercicioId: fichaSustituta?.id ?? ejercicio.ejercicioId ?? undefined,
      codigo: String.fromCharCode(65 + (indice % 26)),
      nombre: fichaSustituta?.nombre ?? ejercicio.nombre,
      repeticiones: objetivos,
      descanso: ejercicio.descansoPersonalizadoSegundos ?? ejercicio.descansoSegundos ?? 60,
      foto,
      fotoRespaldo,
      videoUrl: fichaSustituta?.video_url ?? ejercicio.videoUrl ?? undefined,
      videoCloudflareListo: fichaSustituta
        ? Boolean(fichaSustituta.video_cloudflare_uid && fichaSustituta.video_cloudflare_estado === "listo")
        : Boolean(ejercicio.videoCloudflareUid && ejercicio.videoCloudflareEstado === "listo"),
      equipo: fichaSustituta?.equipo?.replaceAll("_", " ") ?? ejercicio.tecnicaSugerida ?? "Equipo asignado",
      grupo: fichaSustituta?.grupo_muscular
        ? ETIQUETAS_GRUPO_MUSCULAR[fichaSustituta.grupo_muscular]
        : ejercicio.grupoMuscular ? ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular] : "Entrenamiento",
      grupoClave: fichaVisual?.grupo_muscular ?? ejercicio.grupoMuscular ?? undefined,
      gruposSecundarios: fichaVisual?.grupos_secundarios ?? [],
      categoria: fichaVisual?.categoria?.replaceAll("_", " ") ?? undefined,
      patronMovimiento: fichaVisual?.patron_movimiento?.replaceAll("_", " ") ?? undefined,
      nivel: fichaVisual?.nivel ?? undefined,
      descripcion: fichaVisual?.descripcion_corta ?? undefined,
      instrucciones: [fichaVisual?.tecnica, ...(fichaVisual?.consejos ?? [])].filter((texto): texto is string => Boolean(texto?.trim())),
      erroresComunes: fichaVisual?.errores_comunes ?? [],
      tecnica: familia || ejercicio.tecnicaTipo || undefined,
      tecnicaColor: grupoTecnica?.color,
      bloqueId,
      tecnicaSlug: encadenada ? slug as TecnicaEncadenadaSlug : undefined,
      tecnicaIndividualSlug: slug && !encadenada ? slug as TecnicaIndividualSlug : undefined,
      tecnicaSeries: ejercicio.tecnicaSeries,
      tecnicaInstruccion: ejercicio.tecnicaInstruccion ?? undefined,
      notaInicial: ejercicio.notaEjercicio ?? "",
      consejo: ejercicio.observacion ?? ejercicio.tecnicaInstruccion ?? ejercicio.tecnicaSugerida ?? undefined,
      ultimoRegistro: ejercicio.ultimoRegistro
        ? {
            fecha: ejercicio.ultimoRegistro.fecha,
            reps: ejercicio.ultimoRegistro.reps,
            pesoKg: ejercicio.ultimoRegistro.pesoKg,
            esPesoCorporal: ejercicio.ultimoRegistro.esPesoCorporal,
          }
        : undefined,
      seriesIniciales: objetivos.map((objetivo, serieIndice) => {
        const guardada = historicoPorNumero.get(serieIndice + 1);
        return {
          reps: String(guardada?.repsRealizadas ?? repsSugeridasEfectivas ?? objetivo),
          peso: guardada?.pesoKg != null
            ? String(guardada.pesoKg)
            : pesoReferenciaKg != null ? String(pesoReferenciaKg) : "",
          completada: guardada?.realizada === true,
        };
      }),
    };
  });

  const preparacionAlejandro = evaluarPreparacionDiariaAlejandro(await obtenerSeguimientoHoy(supabase, contexto.alumnoId));
  const momentosAlejandro = sesion.ejercicios.flatMap((ejercicio) =>
    ejercicio.intervencionesImpulso
      .filter((momento) => momento.estado !== "cancelada" && momento.estado !== "resuelta")
      .map((momento) => ({
        id: momento.id,
        ejercicioId: ejercicio.sesionEjercicioId,
        serieIndice: Math.max(0, momento.serieObjetivo - 1),
        tipo: tipoMomento(momento.tipo),
        titulo: "MOMENTO IMPULSO VIP" as const,
        instruccion: momento.instruccion,
        apoyo: momento.motivo,
        mostradoInicial: momento.estado === "mostrada",
        // Contra el tipo ORIGINAL (momento.tipo), no el ya agrupado por
        // tipoMomento() -- ese agrupamiento mete "fallo_controlado" dentro
        // de "cierre_controlado" para la UI y perdería la señal.
        intensiva: momento.tipo === "drop_set" || momento.tipo === "rest_pause" || momento.tipo === "fallo_controlado",
        estado: momento.estado,
        calibrada: momento.calibrada,
      })),
  );

  const modelo: SesionActivaModeloV2 = {
    id: sesion.id,
    titulo: sesion.diaNombre,
    fecha: new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(`${sesion.fecha}T12:00:00`)),
    real: true,
    soloLectura: contexto.soloLectura || sesion.estado !== "en_progreso",
    duracionSegundosInicial: calcularDuracionSesionSegundos(
      sesion.rutinaIniciadaEn ?? sesion.horaInicio,
      sesion.horaFin ?? new Date().toISOString(),
    ),
    temporizadorAutomaticoInicial: sesion.ejercicios[0]?.temporizadorDescanso ?? true,
    comentarioInicial: sesion.comentario ?? "",
    ejercicios,
    personalizacionDisponible,
    alternativas,
    momentosAlejandro: limitarMomentosPorPreparacion(momentosAlejandro, preparacionAlejandro),
    preparacionAlejandro,
  };

  return <SesionActivaV2 key={modelo.id} sesion={modelo} />;
}
