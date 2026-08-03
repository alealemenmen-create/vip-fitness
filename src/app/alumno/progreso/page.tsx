import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { PesoCorporal } from "@/components/student/PesoCorporal";
import { GaleriaProgreso } from "@/components/student/GaleriaProgreso";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { obtenerHistorialPeso, obtenerFotosProgreso } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { BarraPuntosVip } from "@/components/student/BarraPuntosVip";
import { PUNTOS_VIP } from "@/lib/ranking/reglas";
import { semanaActualISO } from "@/lib/date";

export default async function ProgresoPage() {
  const { alumnoId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [historial, fotos] = await Promise.all([
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerFotosProgreso(supabase, alumnoId),
  ]);
  // El nombre ya viene de requireAlumno(); no hace falta volver a `perfiles`.
  const frase = fraseDelDia("progreso", nombreAlumnoPublicado(nombre).split(" ")[0] ?? "");
  const lunes = semanaActualISO()[0].fecha;
  const pesoEstaSemana = historial.some((registro) => registro.fecha >= lunes);
  const fotoEstaSemana = fotos.some((foto) => foto.fechaFoto >= lunes);
  const puntosSeguimiento =
    (pesoEstaSemana ? PUNTOS_VIP.pesoSemanal : 0) +
    (fotoEstaSemana ? PUNTOS_VIP.fotoSemanal : 0);

  return (
    <div className="space-y-6 pb-8">
      <MensajeMotivacional frase={frase} />
      <BarraPuntosVip
        puntos={puntosSeguimiento}
        maximo={PUNTOS_VIP.pesoSemanal + PUNTOS_VIP.fotoSemanal}
        etiqueta="Seguimiento semanal"
        ayuda={`${pesoEstaSemana ? "Peso listo" : "Registra tu peso"} · ${fotoEstaSemana ? "Foto lista" : "Sube tu foto"}`}
      />
      <PesoCorporal historial={historial} soloLectura={soloLectura} />
      <GaleriaProgreso fotos={fotos} soloLectura={soloLectura} />
    </div>
  );
}
