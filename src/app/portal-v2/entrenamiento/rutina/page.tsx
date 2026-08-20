import { RutinaDetalleV2, type RutinaDetallePresentacionV2 } from "@/components/v2/RutinaDetalleV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerDiaVistaPrevia, obtenerDiasRutina, obtenerRutinaActiva } from "@/app/alumno/entrenar/data";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import { firmarMiniaturasCloudflareV2 } from "@/lib/cloudflare/miniaturas-v2";
import Link from "next/link";
import styles from "@/components/v2/PortalV2.module.css";

function RutinaNoDisponible({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className={styles.trainingPage}>
      <section className={styles.impulso}><div><strong>{titulo}</strong><p>{detalle}</p></div></section>
      <Link className={styles.primaryButton} href="/portal-v2/entrenamiento">Volver a mi entrenamiento</Link>
    </div>
  );
}

export default async function RutinaV2Page({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; numero?: string }>;
}) {
  const contexto = await obtenerContextoAlumnoOpcional();
  const { dia: diaId, numero } = await searchParams;
  if (!contexto) return <RutinaDetalleV2 />;
  if (!diaId) return <RutinaNoDisponible titulo="Elige un día de tu programa" detalle="La vista del entrenamiento se abre desde la semana de tu programa para mostrar exactamente los ejercicios asignados." />;

  const supabase = await createClient();
  const rutina = await obtenerRutinaActiva(contexto.alumnoId);
  if (!rutina) return <RutinaNoDisponible titulo="Todavía no tienes un programa activo" detalle="Cuando tu entrenador publique el siguiente programa, sus días y ejercicios aparecerán aquí sin reemplazar tu historial." />;
  const [vistaSinFirma, dias] = await Promise.all([
    obtenerDiaVistaPrevia(supabase, contexto.alumnoId, diaId),
    obtenerDiasRutina(rutina.id),
  ]);
  const vista = vistaSinFirma
    ? { ...vistaSinFirma, ejercicios: await firmarMiniaturasCloudflareV2(vistaSinFirma.ejercicios) }
    : null;
  if (!vista || vista.tipo !== "entrenamiento") return <RutinaNoDisponible titulo="Este día no está disponible" detalle="El enlace no pertenece a tu programa activo o corresponde a un día de descanso." />;

  const dia = dias.find((item) => item.id === diaId);
  const grupos = dia?.resumen?.gruposMusculares ?? [];
  const principal = grupos.find((grupo) => grupo !== "cardio");
  const fotoEjercicio = vista.ejercicios.find((ejercicio) =>
    ejercicio.videoCloudflareMiniaturaUrl || ejercicio.fotoCompletaUrl || ejercicio.fotoMiniaturaUrl
  );
  const foto = fotoEjercicio?.videoCloudflareMiniaturaUrl
    ?? fotoEjercicio?.fotoCompletaUrl
    ?? fotoEjercicio?.fotoMiniaturaUrl
    ?? (principal ? FOTOS_GRUPO_MUSCULAR[principal]?.[0] : null)
    ?? "/v2/piernas.webp";
  const fotoRespaldo = fotoEjercicio?.fotoCompletaUrl
    ?? fotoEjercicio?.fotoMiniaturaUrl
    ?? (principal ? FOTOS_GRUPO_MUSCULAR[principal]?.[0] : null)
    ?? "/v2/piernas.webp";

  const presentacion: RutinaDetallePresentacionV2 = {
    nombre: vista.nombre,
    descripcion: vista.descripcion ?? "Entrenamiento personalizado por tu entrenador",
    nivel: "Programa personal",
    musculos: grupos.map((grupo) => ETIQUETAS_GRUPO_MUSCULAR[grupo]),
    ejercicios: vista.ejercicios.length,
    series: vista.ejercicios.reduce((total, ejercicio) => total + ejercicio.seriesProgramadas, 0),
    minutos: dia?.resumen?.minutosEstimados ?? 0,
    foto,
    fotoRespaldo,
    rutinaId: rutina.id,
    diaId,
    // Sin `numero` en la URL (ej. al entrar desde la lista del programa, no
    // desde la rueda de calendario de Inicio) no hay un cupo real resuelto:
    // se muestra en solo vista previa en vez de ofrecer "Iniciar" contra un
    // número inventado que podría chocar con otra sesión ya usada ahí.
    numeroCalendario: numero ? Math.max(1, Number(numero) || 1) : null,
    soloLectura: contexto.soloLectura,
    items: vista.ejercicios.map((ejercicio, indice) => ({
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      codigo: String.fromCharCode(65 + (indice % 26)),
      detalle: `${ejercicio.seriesProgramadas} × ${ejercicio.repsProgramadas}`,
      tempo: ejercicio.tecnicaTipo ?? ejercicio.observacion,
      foto: ejercicio.videoCloudflareMiniaturaUrl
        ?? ejercicio.fotoMiniaturaUrl
        ?? ejercicio.fotoCompletaUrl
        ?? foto,
      fotoRespaldo: ejercicio.fotoMiniaturaUrl
        ?? ejercicio.fotoCompletaUrl
        ?? (ejercicio.grupoMuscular ? FOTOS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]?.[0] : null)
        ?? fotoRespaldo,
      grupo: ejercicio.tecnicaTipo ? ejercicio.tecnicaTipo.replaceAll("_", " ").toUpperCase() : `SERIE ${String.fromCharCode(65 + (indice % 26))}`,
    })),
  };

  return <RutinaDetalleV2 rutina={presentacion} />;
}
