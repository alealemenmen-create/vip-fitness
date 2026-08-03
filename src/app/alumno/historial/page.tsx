import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { BotonImprimir } from "@/components/student/BotonImprimir";
import { formatFechaDiaSemana } from "@/lib/date";
import { obtenerHistorialCombinado, type DiaHistorial } from "./data";

const ESTADO_COMIDA: Record<string, { texto: string; tone: "success" | "vip" | "neutral" }> = {
  completo: { texto: "Alimentación completa", tone: "success" },
  parcial: { texto: "Alimentación parcial", tone: "vip" },
  vacio: { texto: "Sin comidas registradas", tone: "neutral" },
};

const ESTADO_SESION: Record<string, { texto: string; tone: "success" | "error" | "neutral" }> = {
  completada: { texto: "Entrenamiento completo", tone: "success" },
  finalizada_incompleta: { texto: "Entrenamiento incompleto", tone: "error" },
  abandonada: { texto: "Entrenamiento abandonado", tone: "neutral" },
};

function formatoDuracion(inicio: string | null, fin: string | null): string | null {
  if (!inicio || !fin) return null;
  const minutos = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000);
  if (minutos <= 0) return null;
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
}

function FilaDia({ dia }: { dia: DiaHistorial }) {
  const estadoComida = ESTADO_COMIDA[dia.comida.estado] ?? ESTADO_COMIDA.vacio;
  const estadoSesion = dia.sesion ? ESTADO_SESION[dia.sesion.estado] : null;
  const duracion = dia.sesion ? formatoDuracion(dia.sesion.horaInicio, dia.sesion.horaFin) : null;

  return (
    <Card className="space-y-2.5">
      <p className="text-caption font-semibold text-text-secondary">{formatFechaDiaSemana(dia.fecha)}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {dia.sesion ? (
            <>
              <p className="text-body text-text">
                {dia.sesion.diaNombre || "Entrenamiento"} · {dia.sesion.completados}/{dia.sesion.total} ejercicios
              </p>
              {duracion && <p className="text-caption text-text-tertiary">Duración: {duracion}</p>}
            </>
          ) : (
            <p className="text-body text-text-tertiary">Sin entrenamiento registrado</p>
          )}
        </div>
        {estadoSesion && <Pill tone={estadoSesion.tone} className="shrink-0">{estadoSesion.texto}</Pill>}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="min-w-0">
          <p className="text-body text-text">{estadoComida.texto}</p>
          {dia.comida.kcal > 0 && <p className="text-caption text-text-tertiary">{dia.comida.kcal} kcal</p>}
        </div>
        <p className={`text-caption shrink-0 font-bold ${dia.puntos < 0 ? "text-error" : "text-vip"}`}>
          {dia.puntos > 0 ? "+" : ""}{dia.puntos} pts
        </p>
      </div>
    </Card>
  );
}

export default async function HistorialPage() {
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();
  const dias = await obtenerHistorialCombinado(supabase, alumnoId, 30);
  const totalPuntos = dias.reduce((acc, d) => acc + d.puntos, 0);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link href="/alumno/inicio" className="flex items-center gap-2">
          <ArrowLeft size={20} className="text-text-secondary" />
          <span className="text-h3 text-text">Mi Historial</span>
        </Link>
        <BotonImprimir />
      </div>
      <p className="text-caption text-text-secondary">
        Últimos 30 días de entrenamiento, alimentación y Puntos VIP.
      </p>

      {dias.length === 0 ? (
        <Card>
          <p className="text-body text-text-secondary">
            Todavía no hay actividad registrada en los últimos 30 días.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex items-center justify-between gap-2 !py-3">
            <p className="text-body font-semibold text-text">Puntos VIP ganados en el período</p>
            <p className={`text-h3 font-bold ${totalPuntos < 0 ? "text-error" : "text-vip"}`}>
              {totalPuntos > 0 ? "+" : ""}{totalPuntos}
            </p>
          </Card>
          <div className="space-y-3">
            {dias.map((dia) => (
              <FilaDia key={dia.fecha} dia={dia} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
