import { RutinaDetalleV2, type RutinaDetallePresentacionV2 } from "@/components/v2/RutinaDetalleV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerDiaVistaPrevia, obtenerDiasRutina, obtenerRutinaActiva } from "@/app/alumno/entrenar/data";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import { firmarMiniaturasCloudflareV2 } from "@/lib/cloudflare/miniaturas-v2";

export default async function RutinaV2Page({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; numero?: string }>;
}) {
  const contexto = await obtenerContextoAlumnoOpcional();
  const { dia: diaId, numero } = await searchParams;
  if (!contexto || !diaId) return <RutinaDetalleV2 />;

  const supabase = await createClient();
  const rutina = await obtenerRutinaActiva(contexto.alumnoId);
  if (!rutina) return <RutinaDetalleV2 />;
  const [vistaSinFirma, dias] = await Promise.all([
    obtenerDiaVistaPrevia(supabase, contexto.alumnoId, diaId),
    obtenerDiasRutina(rutina.id),
  ]);
  const vista = vistaSinFirma
    ? { ...vistaSinFirma, ejercicios: await firmarMiniaturasCloudflareV2(vistaSinFirma.ejercicios) }
    : null;
  if (!vista || vista.tipo !== "entrenamiento") return <RutinaDetalleV2 />;

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

  const presentacion: RutinaDetallePresentacionV2 = {
    nombre: vista.nombre,
    descripcion: vista.descripcion ?? "Entrenamiento personalizado por tu entrenador",
    nivel: "Programa personal",
    musculos: grupos.map((grupo) => ETIQUETAS_GRUPO_MUSCULAR[grupo]),
    ejercicios: vista.ejercicios.length,
    series: vista.ejercicios.reduce((total, ejercicio) => total + ejercicio.seriesProgramadas, 0),
    minutos: dia?.resumen?.minutosEstimados ?? 0,
    foto,
    rutinaId: rutina.id,
    diaId,
    numeroCalendario: Math.max(1, Number(numero) || 1),
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
      grupo: ejercicio.tecnicaTipo ? ejercicio.tecnicaTipo.replaceAll("_", " ").toUpperCase() : `SERIE ${String.fromCharCode(65 + (indice % 26))}`,
    })),
  };

  return <RutinaDetalleV2 rutina={presentacion} />;
}
