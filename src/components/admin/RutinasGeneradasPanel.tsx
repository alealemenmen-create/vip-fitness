"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, FileText, Search, Star } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RutinaDraftEditor, type TecnicaOpcion } from "@/components/admin/RutinaDraftEditor";
import {
  abrirRutinaPublicada,
  listarRutinasDeAlumno,
  type RutinaDelAlumno,
} from "@/app/admin/rutinas-generadas/actions";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";
import type { CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";

export type AlumnoConRutinas = {
  id: string;
  nombre: string;
  plan: { codigo: CodigoPlanEntrenamiento; nombre: string } | null;
};

function fechaCorta(iso: string): string {
  const f = new Date(iso);
  return f.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * "Rutinas generadas": elegir persona, ver lo que ya se le armó, abrir una y
 * seguir trabajándola en la misma mesa de armado, para republicarla.
 *
 * Es la respuesta al cuello de botella real que él describió: con 68 alumnos,
 * la mayoría de las rutinas nuevas son una variación de la anterior, y hasta
 * ahora la única forma de partir de una vieja era extraerla como texto y
 * pegarla en Documentos.
 *
 * Abrir una rutina NO la modifica. La vieja queda como está en el historial;
 * al publicar se crea una nueva y esa pasa a ser la activa.
 */
export function RutinasGeneradasPanel({
  alumnos,
  ejercicios,
  tecnicas,
}: {
  alumnos: AlumnoConRutinas[];
  ejercicios: { id: string; nombre: string; grupo: string; equipo: string; patronMovimiento?: PatronMovimiento | null }[];
  tecnicas: TecnicaOpcion[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [alumno, setAlumno] = useState<AlumnoConRutinas | null>(null);
  const [rutinas, setRutinas] = useState<RutinaDelAlumno[] | null>(null);
  const [abierta, setAbierta] = useState<RutinaExtraida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  const visibles = useMemo(
    () => alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [alumnos, busqueda]
  );

  const elegirAlumno = (elegido: AlumnoConRutinas) => {
    setAlumno(elegido);
    setRutinas(null);
    setError(null);
    iniciar(async () => setRutinas(await listarRutinasDeAlumno(elegido.id)));
  };

  const abrir = (rutinaId: string) => {
    setError(null);
    iniciar(async () => {
      const resultado = await abrirRutinaPublicada(rutinaId);
      if (!resultado.ok) return setError(resultado.error);
      setAbierta(resultado.rutina);
    });
  };

  if (abierta && alumno) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8fb7d8]"
          >
            <ArrowLeft size={13} /> Volver a sus rutinas
          </button>
          <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">{alumno.nombre}</p>
        </div>
        <p className="text-micro text-text-tertiary">
          Estás editando una copia. La rutina original queda intacta en el historial; al publicar, la nueva pasa a
          ser la activa.
        </p>
        <RutinaDraftEditor
          mesaDeTrabajo
          alumnoIds={[alumno.id]}
          draftInicial={abierta}
          onDescartar={() => setAbierta(null)}
          ejercicios={ejercicios}
          tecnicas={tecnicas}
          planInicial={alumno.plan?.codigo}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Card padding="p-3" className="space-y-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-secondary font-medium text-text">¿De quién?</p>
          <Link href="/admin" className="flex items-center gap-1 text-micro font-semibold text-[#8fb7d8]">
            <ArrowLeft size={13} /> Atrás
          </Link>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar alumno…"
            className="pl-9"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {visibles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => elegirAlumno(a)}
              className={`radius-control flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left ${
                alumno?.id === a.id ? "bg-[#dbeafe] text-[#214f7d]" : "bg-surface-2 text-text-secondary"
              }`}
            >
              <span className="text-caption min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
              <span className="text-micro shrink-0 opacity-80">{a.plan?.nombre ?? "Sin plan"}</span>
            </button>
          ))}
          {visibles.length === 0 && <p className="text-caption text-text-tertiary">Ningún alumno con ese nombre.</p>}
        </div>
      </Card>

      {error && <p className="text-caption text-error">{error}</p>}

      {alumno && (
        <Card padding="p-3" className="space-y-1.5">
          <p className="text-caption font-semibold text-text">Rutinas de {alumno.nombre}</p>
          {cargando && !rutinas && <p className="text-caption text-text-tertiary">Buscando…</p>}
          {rutinas?.length === 0 && (
            <p className="text-caption text-text-tertiary">
              Todavía no tiene ninguna rutina publicada. Ármale una desde “Armar rutina”.
            </p>
          )}
          {rutinas?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => abrir(r.id)}
              disabled={cargando}
              className="radius-control flex w-full items-center gap-2 border border-border bg-surface-2 px-2.5 py-2 text-left disabled:opacity-50"
            >
              <FileText size={14} className="shrink-0 text-[#8fb7d8]" />
              <span className="min-w-0 flex-1">
                <span className="text-caption flex items-center gap-1.5 truncate font-medium text-text">
                  {r.nombre}
                  {r.activa && <Star size={11} className="shrink-0 fill-vip text-vip" />}
                </span>
                <span className="text-micro block text-text-tertiary">
                  {fechaCorta(r.creadaEn)} · {r.dias} {r.dias === 1 ? "sesión" : "sesiones"} · {r.ejercicios} ejercicios
                </span>
              </span>
              <span className="text-micro shrink-0 font-semibold text-[#4f83b7]">Abrir</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
