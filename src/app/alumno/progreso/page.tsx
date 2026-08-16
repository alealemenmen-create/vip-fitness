import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { PesoCorporal } from "@/components/student/PesoCorporal";
import { GaleriaProgreso } from "@/components/student/GaleriaProgreso";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { obtenerHistorialPeso, obtenerGaleriaSemanal } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { BarraPuntosVip } from "@/components/student/BarraPuntosVip";
import { PUNTOS_VIP } from "@/lib/ranking/reglas";
import { semanaActualISO } from "@/lib/date";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import type { PeriodoSeguimiento } from "@/lib/seguimiento/tipos";
import { PanelSeguimiento } from "@/components/seguimiento/PanelSeguimiento";

export default async function ProgresoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { alumnoId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const periodoNumero = Number((await searchParams).periodo);
  const periodo: PeriodoSeguimiento = periodoNumero === 14 || periodoNumero === 30 ? periodoNumero : 7;

  const [historial, semanas, seguimiento] = await Promise.all([
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerGaleriaSemanal(supabase, alumnoId),
    obtenerSeguimientoIntegral(supabase, alumnoId, periodo),
  ]);
  // El nombre ya viene de requireAlumno(); no hace falta volver a `perfiles`.
  const frase = fraseDelDia("progreso", nombreAlumnoPublicado(nombre).split(" ")[0] ?? "");
  const lunes = semanaActualISO()[0].fecha;
  const pesoEstaSemana = historial.some((registro) => registro.fecha >= lunes);
  // La última entrada de `semanas` es siempre la semana en curso (ver
  // `construirGaleriaSemanal`) — no hace falta volver a comparar fechas acá.
  const fotoEstaSemana = semanas[semanas.length - 1]?.foto !== null;
  const puntosSeguimiento =
    (pesoEstaSemana ? PUNTOS_VIP.pesoSemanal : 0) +
    (fotoEstaSemana ? PUNTOS_VIP.fotoSemanal : 0);

  return (
    <div className="space-y-6 pb-8">
      {seguimiento && <PanelSeguimiento datos={seguimiento} modo="alumno" baseHref="/alumno/progreso" imprimirHref="/alumno/progreso/imprimir" />}
      <div className="border-t border-border pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Actualizar evolución</p>
      </div>
      <MensajeMotivacional frase={frase} />
      <BarraPuntosVip
        puntos={puntosSeguimiento}
        maximo={PUNTOS_VIP.pesoSemanal + PUNTOS_VIP.fotoSemanal}
        etiqueta="Seguimiento semanal"
        ayuda={`${pesoEstaSemana ? "Peso listo" : "Registra tu peso"} · ${fotoEstaSemana ? "Foto lista" : "Sube tu foto"}`}
      />
      <PesoCorporal historial={historial} soloLectura={soloLectura} />
      <GaleriaProgreso semanas={semanas} soloLectura={soloLectura} />
    </div>
  );
}
