import Link from "next/link";
import { SesionActivaV2, type SesionActivaModeloV2 } from "@/components/v2/SesionActivaV2";
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
import { resolverGrupoTecnica, tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import styles from "@/components/v2/PortalV2.module.css";

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

function construirBloquesTecnica(ejercicios: { sesionEjercicioId: string; tecnicaTipo: string | null }[]) {
  const bloques = new Map<string, string>();
  let grupoActual: { familia: string; id: string; restantes: number | null } | null = null;
  let contador = 0;
  for (const ejercicio of ejercicios) {
    const slug = normalizarTecnicaSesion(ejercicio.tecnicaTipo);
    const encadenada = slug !== null && esTecnicaEncadenada(slug);
    const familia = resolverGrupoTecnica(ejercicio.tecnicaTipo)?.etiqueta ?? "";
    if (!encadenada) {
      grupoActual = null;
      continue;
    }
    if (!grupoActual || grupoActual.familia !== familia || grupoActual.restantes === 0) {
      contador += 1;
      grupoActual = {
        familia,
        id: `${slug}-${contador}`,
        restantes: tamanoGrupoTecnica(ejercicio.tecnicaTipo),
      };
    }
    bloques.set(ejercicio.sesionEjercicioId, grupoActual.id);
    if (grupoActual.restantes !== null) grupoActual.restantes -= 1;
  }
  return bloques;
}

export default async function SesionV2Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto || !id) return <SesionActivaV2 />;

  const supabase = await createClient();
  const sesion = await obtenerSesionCompleta(supabase, contexto.alumnoId, id);
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

  const bloquesTecnica = construirBloquesTecnica(sesion.ejercicios);
  const ejercicios = sesion.ejercicios.map((ejercicio, indice) => {
    const slug = normalizarTecnicaSesion(ejercicio.tecnicaTipo);
    const encadenada = slug !== null && esTecnicaEncadenada(slug);
    const familia = resolverGrupoTecnica(ejercicio.tecnicaTipo)?.etiqueta ?? "";
    const bloqueId = bloquesTecnica.get(ejercicio.sesionEjercicioId);

    const foto = ejercicio.videoCloudflareMiniaturaUrl
      ?? ejercicio.fotoCompletaUrl
      ?? ejercicio.fotoMiniaturaUrl
      ?? (ejercicio.grupoMuscular ? FOTOS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]?.[0] : null)
      ?? "/v2/piernas.webp";
    const historicoPorNumero = new Map(ejercicio.series.map((serie) => [serie.numeroSerie, serie]));
    const objetivos = objetivoRepeticiones(ejercicio.repsProgramadas, ejercicio.seriesProgramadas);
    return {
      id: ejercicio.sesionEjercicioId,
      sesionEjercicioId: ejercicio.sesionEjercicioId,
      bibliotecaEjercicioId: ejercicio.ejercicioId ?? undefined,
      codigo: String.fromCharCode(65 + (indice % 26)),
      nombre: ejercicio.nombre,
      repeticiones: objetivos,
      descanso: ejercicio.descansoPersonalizadoSegundos ?? ejercicio.descansoSegundos ?? 60,
      foto,
      videoUrl: ejercicio.videoUrl ?? undefined,
      videoCloudflareListo: Boolean(ejercicio.videoCloudflareUid && ejercicio.videoCloudflareEstado === "listo"),
      equipo: ejercicio.tecnicaSugerida ?? "Equipo asignado",
      grupo: ejercicio.grupoMuscular ? ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular] : "Entrenamiento",
      tecnica: familia || ejercicio.tecnicaTipo || undefined,
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
          reps: String(guardada?.repsRealizadas ?? objetivo),
          peso: guardada?.pesoKg === null || guardada?.pesoKg === undefined ? "" : String(guardada.pesoKg),
          completada: guardada?.realizada === true,
        };
      }),
    };
  });

  const modelo: SesionActivaModeloV2 = {
    id: sesion.id,
    titulo: sesion.diaNombre,
    fecha: new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(`${sesion.fecha}T12:00:00`)),
    real: true,
    soloLectura: contexto.soloLectura || sesion.estado !== "en_progreso",
    temporizadorAutomaticoInicial: sesion.ejercicios[0]?.temporizadorDescanso ?? true,
    ejercicios,
    momentosAlejandro: sesion.ejercicios.flatMap((ejercicio) =>
      ejercicio.intervencionesImpulso
        .filter((momento) => momento.estado !== "cancelada")
        .map((momento) => ({
          id: momento.id,
          ejercicioId: ejercicio.sesionEjercicioId,
          serieIndice: Math.max(0, momento.serieObjetivo - 1),
          tipo: tipoMomento(momento.tipo),
          titulo: "MOMENTO ALEJANDRO" as const,
          instruccion: momento.instruccion,
          apoyo: momento.motivo,
        })),
    ),
  };

  return <SesionActivaV2 sesion={modelo} />;
}
