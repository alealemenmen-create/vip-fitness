"use client";

import { useMemo, useState, useTransition } from "react";
import { ArchiveRestore, ArrowLeft, ArrowRightLeft, Archive, FileText, Search, Star, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RutinaDraftEditor, type TecnicaOpcion } from "@/components/admin/RutinaDraftEditor";
import { AjusteRapidoRutina } from "@/components/admin/AjusteRapidoRutina";
import {
  abrirRutinaPublicada,
  archivarRutina,
  cargarNumerosRutina,
  listarRutinasDeAlumno,
  type RutinaDelAlumno,
  type RutinaNumeros,
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
 * "Rutinas hechas": elegir persona, ver lo que ya se le armó, abrir una y
 * seguir trabajándola en la misma mesa de armado, para republicarla — o
 * archivarla (se oculta de esta lista, sin borrar nada) o traspasarla como
 * punto de partida para OTRO alumno.
 *
 * Es la respuesta al cuello de botella real que él describió: con 68 alumnos,
 * la mayoría de las rutinas nuevas son una variación de la anterior, y hasta
 * ahora la única forma de partir de una vieja era extraerla como texto y
 * pegarla en Documentos.
 *
 * Abrir/traspasar una rutina NO la modifica. La vieja queda como está en el
 * historial; al publicar se crea una nueva y esa pasa a ser la activa (del
 * alumno original, o del alumno destino si fue un traspaso). Los puntos VIP
 * no dependen de la rutina (viven atados a la sesión), así que nada de esto
 * los toca.
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
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [abierta, setAbierta] = useState<RutinaExtraida | null>(null);
  const [ajuste, setAjuste] = useState<RutinaNumeros | null>(null);
  const [alumnoDestino, setAlumnoDestino] = useState<AlumnoConRutinas | null>(null);
  const [traspasoRutinaId, setTraspasoRutinaId] = useState<string | null>(null);
  const [busquedaTraspaso, setBusquedaTraspaso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  const visibles = useMemo(
    () => alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [alumnos, busqueda]
  );

  const candidatosTraspaso = useMemo(
    () =>
      alumnos.filter(
        (a) => a.id !== alumno?.id && a.nombre.toLowerCase().includes(busquedaTraspaso.toLowerCase())
      ),
    [alumnos, alumno, busquedaTraspaso]
  );

  const recargarRutinas = (alumnoId: string, incluirArchivadas: boolean) => {
    iniciar(async () => setRutinas(await listarRutinasDeAlumno(alumnoId, incluirArchivadas)));
  };

  const elegirAlumno = (elegido: AlumnoConRutinas) => {
    setAlumno(elegido);
    setRutinas(null);
    setError(null);
    setVerArchivadas(false);
    recargarRutinas(elegido.id, false);
  };

  const alternarArchivadas = () => {
    if (!alumno) return;
    const nuevoValor = !verArchivadas;
    setVerArchivadas(nuevoValor);
    recargarRutinas(alumno.id, nuevoValor);
  };

  const abrir = (rutinaId: string, destino: AlumnoConRutinas) => {
    setError(null);
    iniciar(async () => {
      const resultado = await abrirRutinaPublicada(rutinaId);
      if (!resultado.ok) return setError(resultado.error);
      setAlumnoDestino(destino);
      setAbierta(resultado.rutina);
    });
  };

  const elegirDestinoTraspaso = (destino: AlumnoConRutinas) => {
    if (!traspasoRutinaId) return;
    abrir(traspasoRutinaId, destino);
    setTraspasoRutinaId(null);
    setBusquedaTraspaso("");
  };

  const abrirAjusteRapido = (rutinaId: string) => {
    setError(null);
    iniciar(async () => {
      const resultado = await cargarNumerosRutina(rutinaId);
      if (!resultado.ok) return setError(resultado.error);
      setAjuste(resultado.rutina);
    });
  };

  const alternarArchivo = (rutina: RutinaDelAlumno) => {
    if (!alumno) return;
    setError(null);
    iniciar(async () => {
      const resultado = await archivarRutina(rutina.id, !rutina.archivada);
      if (!resultado.ok) return setError(resultado.error);
      recargarRutinas(alumno.id, verArchivadas);
    });
  };

  if (ajuste && alumno) {
    return (
      <AjusteRapidoRutina
        rutina={ajuste}
        alumnoNombre={alumno.nombre}
        onVolver={() => setAjuste(null)}
        onGuardado={() => recargarRutinas(alumno.id, verArchivadas)}
      />
    );
  }

  if (abierta && alumnoDestino) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAbierta(null);
              setAlumnoDestino(null);
            }}
            className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8fb7d8]"
          >
            <ArrowLeft size={13} /> Volver a sus rutinas
          </button>
          <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">
            {alumno && alumno.id !== alumnoDestino.id
              ? `${alumno.nombre} → ${alumnoDestino.nombre}`
              : alumnoDestino.nombre}
          </p>
        </div>
        <p className="text-micro text-text-tertiary">
          {alumno && alumno.id !== alumnoDestino.id
            ? `Estás copiando esta rutina para ${alumnoDestino.nombre}. La original de ${alumno.nombre} queda intacta en su historial.`
            : "Estás editando una copia. La rutina original queda intacta en el historial; al publicar, la nueva pasa a ser la activa."}
        </p>
        <RutinaDraftEditor
          mesaDeTrabajo
          alumnoIds={[alumnoDestino.id]}
          draftInicial={abierta}
          onDescartar={() => {
            setAbierta(null);
            setAlumnoDestino(null);
          }}
          ejercicios={ejercicios}
          tecnicas={tecnicas}
          planInicial={alumnoDestino.plan?.codigo}
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption font-semibold text-text">Rutinas de {alumno.nombre}</p>
            <button
              type="button"
              onClick={alternarArchivadas}
              className="text-micro shrink-0 font-semibold text-[#8fb7d8]"
            >
              {verArchivadas ? "Ocultar archivadas" : "Ver archivadas"}
            </button>
          </div>
          {cargando && !rutinas && <p className="text-caption text-text-tertiary">Buscando…</p>}
          {rutinas?.length === 0 && (
            <p className="text-caption text-text-tertiary">
              {verArchivadas
                ? "No tiene rutinas archivadas."
                : "Todavía no tiene ninguna rutina publicada. Ármale una desde “Armar rutina”."}
            </p>
          )}
          {rutinas?.map((r) => (
            <div key={r.id} className="radius-control border border-border bg-surface-2 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <FileText size={14} className="shrink-0 text-[#8fb7d8]" />
                <button
                  type="button"
                  onClick={() => alumno && abrir(r.id, alumno)}
                  disabled={cargando}
                  className="min-w-0 flex-1 text-left disabled:opacity-50"
                >
                  <span className="text-caption flex items-center gap-1.5 truncate font-medium text-text">
                    {r.nombre}
                    {r.activa && <Star size={11} className="shrink-0 fill-vip text-vip" />}
                    {r.archivada && (
                      <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-text-tertiary">
                        Archivada
                      </span>
                    )}
                  </span>
                  <span className="text-micro block text-text-tertiary">
                    {fechaCorta(r.creadaEn)} · {r.dias} {r.dias === 1 ? "sesión" : "sesiones"} · {r.ejercicios} ejercicios
                  </span>
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-3 pl-[22px]">
                <button
                  type="button"
                  onClick={() => alumno && abrir(r.id, alumno)}
                  disabled={cargando}
                  className="text-micro font-semibold text-[#4f83b7] disabled:opacity-50"
                >
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => abrirAjusteRapido(r.id)}
                  disabled={cargando}
                  className="flex items-center gap-1 text-micro font-semibold text-[#4f83b7] disabled:opacity-50"
                >
                  <SlidersHorizontal size={11} /> Ajuste rápido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTraspasoRutinaId(r.id);
                    setBusquedaTraspaso("");
                  }}
                  disabled={cargando}
                  className="flex items-center gap-1 text-micro font-semibold text-[#8fb7d8] disabled:opacity-50"
                >
                  <ArrowRightLeft size={11} /> Traspasar
                </button>
                {!r.activa && (
                  <button
                    type="button"
                    onClick={() => alternarArchivo(r)}
                    disabled={cargando}
                    className="flex items-center gap-1 text-micro font-semibold text-text-tertiary disabled:opacity-50"
                  >
                    {r.archivada ? <ArchiveRestore size={11} /> : <Archive size={11} />}
                    {r.archivada ? "Desarchivar" : "Archivar"}
                  </button>
                )}
              </div>

              {traspasoRutinaId === r.id && (
                <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-surface p-2">
                  <p className="text-micro font-semibold text-text">¿A qué alumno se la copio?</p>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-text-tertiary" />
                    <Input
                      value={busquedaTraspaso}
                      onChange={(e) => setBusquedaTraspaso(e.target.value)}
                      placeholder="Buscar alumno…"
                      className="pl-8 text-micro"
                    />
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {candidatosTraspaso.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => elegirDestinoTraspaso(a)}
                        disabled={cargando}
                        className="radius-control flex w-full items-center justify-between gap-2 bg-surface-2 px-2 py-1.5 text-left text-micro font-medium text-text-secondary disabled:opacity-50"
                      >
                        {a.nombre}
                      </button>
                    ))}
                    {candidatosTraspaso.length === 0 && (
                      <p className="text-micro text-text-tertiary">Ningún alumno con ese nombre.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTraspasoRutinaId(null)}
                    className="text-micro font-semibold text-text-tertiary"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
