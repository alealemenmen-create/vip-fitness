import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { PesoCorporal } from "@/components/student/PesoCorporal";
import { GaleriaProgreso } from "@/components/student/GaleriaProgreso";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { obtenerHistorialPeso, obtenerFotosProgreso } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function ProgresoPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [historial, fotos, { data: perfil }] = await Promise.all([
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerFotosProgreso(supabase, alumnoId),
    supabase.from("perfiles").select("nombre").eq("id", alumnoId).single(),
  ]);
  const frase = fraseDelDia(
    "progreso",
    perfil?.nombre ? nombreAlumnoPublicado(perfil.nombre).split(" ")[0] : ""
  );

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-h2 text-text">Tu progreso</h1>
      <MensajeMotivacional frase={frase} />
      <PesoCorporal historial={historial} soloLectura={soloLectura} />
      <GaleriaProgreso fotos={fotos} soloLectura={soloLectura} />
    </div>
  );
}
