"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, ListChecks, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { AbandonarSesionBoton } from "@/components/student/AbandonarSesionBoton";
import { borrarSesiones } from "@/app/alumno/entrenar/actions";
import type { SesionHistorial } from "@/app/alumno/entrenar/data";

const ESTADO_LABEL: Record<string, { texto: string; tone: "success" | "error" | "neutral" }> = {
  completada: { texto: "Completada", tone: "success" },
  finalizada_incompleta: { texto: "Incompleta", tone: "error" },
  abandonada: { texto: "Abandonada", tone: "neutral" },
};

/**
 * Lista de sesiones del Historial de una rutina, con un modo de selección
 * para borrar de una las que fueron de prueba.
 *
 * Por qué hace falta borrar y no alcanza con "Abandonar" (que ya existe):
 * abandonar solo cambia el estado, la fila sigue ahí — y mientras siga ahí
 * sigue ocupando un `numero_calendario` para siempre (ver `borrarSesiones`
 * en `actions.ts` y `obtenerProximoNumero` en `data.ts`). Esto es lo único
 * que de verdad libera esos números.
 */
export function HistorialSesionesLista({
  sesiones,
  rutinaId,
  soloLectura,
}: {
  sesiones: SesionHistorial[];
  rutinaId: string;
  soloLectura: boolean;
}) {
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  function alternarSeleccion(id: string) {
    setSeleccionadas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function cancelarSeleccion() {
    setSeleccionando(false);
    setSeleccionadas(new Set());
  }

  function confirmarBorrado() {
    const ids = Array.from(seleccionadas);
    startTransition(async () => {
      await borrarSesiones(ids, rutinaId);
      setConfirmando(false);
      cancelarSeleccion();
    });
  }

  return (
    <div className="space-y-2">
      {!soloLectura && sesiones.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => (seleccionando ? cancelarSeleccion() : setSeleccionando(true))}
            className="flex items-center gap-1.5 text-caption text-text-secondary active:opacity-70"
          >
            {seleccionando ? (
              <>
                <X size={14} /> Cancelar selección
              </>
            ) : (
              <>
                <ListChecks size={14} /> Marcar sesiones de prueba
              </>
            )}
          </button>
        </div>
      )}

      {sesiones.map((s) => {
        const estado = ESTADO_LABEL[s.estado];
        const marcada = seleccionadas.has(s.id);
        const contenido = (
          <>
            <p className="text-body text-text">
              {s.numeroCalendario ? `#${s.numeroCalendario} · ` : ""}
              {s.diaNombre}
            </p>
            <p className="text-caption text-text-tertiary">
              {s.fecha} · {s.total === 0 ? "Descanso" : `${s.completados}/${s.total} ejercicios`}
            </p>
          </>
        );

        if (seleccionando) {
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => alternarSeleccion(s.id)}
              className="block w-full text-left"
            >
              <Card
                className={`flex items-center justify-between gap-2 transition-colors ${
                  marcada ? "bg-vip/10 ring-2 ring-vip" : ""
                }`}
              >
                <div className="min-w-0 flex-1">{contenido}</div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={estado.tone}>{estado.texto}</Pill>
                  <CheckCircle2 size={20} className={marcada ? "text-vip" : "text-text-tertiary/40"} />
                </div>
              </Card>
            </button>
          );
        }

        return (
          <Card key={s.id} className="flex items-center justify-between gap-2">
            <Link href={`/alumno/entrenar/sesion/${s.id}`} className="min-w-0 flex-1">
              {contenido}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Pill tone={estado.tone}>{estado.texto}</Pill>
              {s.estado !== "abandonada" && <AbandonarSesionBoton sesionId={s.id} />}
              <Link href={`/alumno/entrenar/sesion/${s.id}`}>
                <ChevronRight size={18} className="text-text-tertiary" />
              </Link>
            </div>
          </Card>
        );
      })}

      {seleccionando && seleccionadas.size > 0 && (
        <div className="sticky bottom-4 z-10 pt-2">
          <Button type="button" variant="destructive" size="sm" className="w-full" onClick={() => setConfirmando(true)}>
            <Trash2 size={16} /> Borrar {seleccionadas.size} {seleccionadas.size === 1 ? "sesión" : "sesiones"}
          </Button>
        </div>
      )}

      {confirmando &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Card padding="p-4" className="w-full max-w-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-medium text-text">
                  ¿Borrar {seleccionadas.size} {seleccionadas.size === 1 ? "sesión" : "sesiones"}?
                </p>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setConfirmando(false)}
                  className="text-text-tertiary"
                  disabled={pending}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-caption text-text-secondary">
                Se borran del todo, junto con los Puntos VIP que hayan sumado. Los números de
                calendario que ocupaban quedan libres, así que el próximo día a entrenar puede
                correrse hacia atrás. Esto no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="xsAuto"
                  className="flex-1"
                  onClick={() => setConfirmando(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="xsAuto"
                  className="flex-1"
                  onClick={confirmarBorrado}
                  loading={pending}
                  disabled={pending}
                >
                  Sí, borrar
                </Button>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </div>
  );
}
