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
import { HeroAvance, DetalleAvance } from "@/components/seguimiento/PanelSeguimiento";

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
    // Orden pensado con Alejandro (2026-08-16): el motivo semanal de entrar a
    // esta pestaña es CHECK-IN (foto + peso), no leer el panel analítico
    // completo. El hero de adherencia (identidad de la pantalla, engancha de
    // un vistazo) queda arriba de todo; las acciones de la semana van justo
    // debajo, antes del análisis largo — que sigue completo, solo que ahora
    // es la parte de "profundizar" y no lo primero que hay que atravesar.
    <div className="space-y-6 pb-8">
      {seguimiento && (
        <HeroAvance datos={seguimiento} modo="alumno" baseHref="/alumno/progreso" imprimirHref="/alumno/progreso/imprimir" />
      )}

      <div className="encabezado-acciones-semana">
        <p className="eyebrow-avance">Esta semana</p>
        <h2 className="text-h3 font-semibold text-text">Registra tu progreso</h2>
      </div>
      <MensajeMotivacional frase={frase} />
      <BarraPuntosVip
        puntos={puntosSeguimiento}
        maximo={PUNTOS_VIP.pesoSemanal + PUNTOS_VIP.fotoSemanal}
        etiqueta="Seguimiento semanal"
        ayuda={`${fotoEstaSemana ? "Foto lista" : "Sube tu foto"} · ${pesoEstaSemana ? "Peso listo" : "Registra tu peso"}`}
      />
      {/* Foto antes que peso: es el ritual semanal en el que más se apoya
          esta pantalla (antes/después, historial, semana actual) — pedido
          explícito de Alejandro por sobre el orden anterior. */}
      <GaleriaProgreso semanas={semanas} soloLectura={soloLectura} />
      <PesoCorporal historial={historial} soloLectura={soloLectura} />

      {seguimiento && (
        <div className="pt-2">
          <p className="mb-3 eyebrow-avance">Análisis completo</p>
          <DetalleAvance datos={seguimiento} modo="alumno" />
        </div>
      )}
    </div>
  );
}
