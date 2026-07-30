import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { PesoCorporal } from "@/components/student/PesoCorporal";
import { GaleriaProgreso } from "@/components/student/GaleriaProgreso";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { obtenerHistorialPeso, obtenerFotosProgreso } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function ProgresoPage() {
  const { alumnoId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [historial, fotos] = await Promise.all([
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerFotosProgreso(supabase, alumnoId),
  ]);
  // El nombre ya viene de requireAlumno(); no hace falta volver a `perfiles`.
  const frase = fraseDelDia("progreso", nombreAlumnoPublicado(nombre).split(" ")[0] ?? "");

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-h2 text-text">Tu progreso</h1>
      <MensajeMotivacional frase={frase} />
      <PesoCorporal historial={historial} soloLectura={soloLectura} />
      <GaleriaProgreso fotos={fotos} soloLectura={soloLectura} />
    </div>
  );
}
