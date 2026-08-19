import { BibliotecaEjerciciosV2 } from "@/components/v2/BibliotecaEjerciciosV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";

export const dynamic = "force-dynamic";

export default async function BibliotecaEjerciciosV2Page({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string }>;
}) {
  const { buscar } = await searchParams;
  const [ejercicios, contexto] = await Promise.all([
    obtenerBiblioteca(),
    obtenerContextoAlumnoOpcional(),
  ]);
  const resumenes = ejercicios.map((ejercicio) => ({
    id: ejercicio.id,
    nombre: ejercicio.nombre,
    aliases: ejercicio.aliases,
    grupoMuscular: ejercicio.grupoMuscular,
    equipo: ejercicio.equipo,
    ilustracionSlug: ejercicio.ilustracionSlug,
    fotoMiniaturaUrl: ejercicio.fotoMiniaturaUrl,
    fotoCompletaUrl: ejercicio.fotoCompletaUrl,
    videoCloudflareEstado: ejercicio.videoCloudflareEstado,
  }));
  return <BibliotecaEjerciciosV2 ejercicios={resumenes} puedeVerVideos={Boolean(contexto)} busquedaInicial={buscar ?? ""} />;
}
