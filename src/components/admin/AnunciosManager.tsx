"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Megaphone, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button, IconButton } from "@/components/ui/Button";
import { crearAnuncio, descartarBorrador, eliminarAnuncio, type FormState } from "@/app/admin/noticias/actions";
import type { Anuncio, BorradorNoticia } from "@/lib/noticias/data";

const initialState: FormState = { error: null, ok: false };

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnunciosManager({
  anuncios,
  borradores,
  borradorIA,
}: {
  anuncios: Anuncio[];
  borradores: BorradorNoticia[];
  borradorIA?: { id: string; titulo: string; mensaje: string } | null;
}) {
  const [state, formAction, pending] = useActionState(crearAnuncio, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-card-title mb-3 flex items-center gap-2 text-text">
          <Megaphone size={18} className="text-vip" /> Publicar anuncio
        </p>
        {borradorIA && (
          <div className="mb-3 rounded-xl border border-vip/30 bg-vip/10 p-3">
            <p className="text-caption font-semibold text-vip">BORRADOR DEL ASISTENTE VIP</p>
            <p className="text-caption mt-1 text-text-secondary">Revísalo antes de publicarlo para todos los alumnos.</p>
          </div>
        )}
        <form ref={formRef} action={formAction} className="space-y-3">
          {borradorIA?.id && <input type="hidden" name="borrador_id" value={borradorIA.id} />}
          <Input name="titulo" type="text" defaultValue={borradorIA?.titulo} placeholder="Título del anuncio" required />
          <Textarea
            name="mensaje"
            rows={3}
            defaultValue={borradorIA?.mensaje}
            placeholder="Novedades del gimnasio (horarios, mantención, eventos…)"
            required
          />
          <label className="text-secondary flex items-center gap-2 text-text-secondary">
            <input type="checkbox" name="importante" style={{ accentColor: "var(--color-vip)" }} />
            Importante — muestra una burbuja flotante a todos los alumnos
          </label>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <Button type="submit" variant="accion" loading={pending} className="w-full">
            {pending ? "Publicando…" : "Publicar"}
          </Button>
        </form>
      </Card>

      <div id="borradores-noticias" className="scroll-mt-28 space-y-2">
        {borradores.length > 0 ? (
        <>
          <p className="text-caption font-semibold text-text-tertiary">BORRADORES PENDIENTES</p>
          {borradores.map((borrador) => (
            <Card key={borrador.id} className="flex items-start justify-between gap-3 !p-3">
              <div className="min-w-0">
                <p className="text-secondary truncate font-semibold text-text">{borrador.titulo}</p>
                <p className="text-caption mt-1 line-clamp-2 text-text-secondary">{borrador.mensaje}</p>
                {borrador.generadoConIA && <p className="text-micro mt-1 font-semibold text-vip">GENERADO CON IA</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Link
                  href={`/admin/noticias?ia=1&borrador=${borrador.id}&titulo=${encodeURIComponent(borrador.titulo)}&mensaje=${encodeURIComponent(borrador.mensaje)}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-vip"
                  aria-label="Editar borrador"
                ><Pencil size={15} /></Link>
                <form action={descartarBorrador}>
                  <input type="hidden" name="id" value={borrador.id} />
                  <IconButton ariaLabel="Descartar borrador" type="submit" className="bg-surface-2"><Trash2 size={15} className="text-error" /></IconButton>
                </form>
              </div>
            </Card>
          ))}
        </>
        ) : (
          <Card><p className="text-body text-text-secondary">No hay borradores pendientes.</p></Card>
        )}
      </div>

      <div id="noticias-publicadas" className="scroll-mt-28 space-y-2">
      {anuncios.length === 0 ? (
        <Card>
          <p className="text-body text-text-secondary">Todavía no publicaste ningún anuncio.</p>
        </Card>
      ) : (
        <>
          {anuncios.map((a) => (
            <Card key={a.id} className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-body font-semibold text-text">
                  {a.titulo}
                  {a.importante && <span className="text-caption font-bold text-error">· IMPORTANTE</span>}
                </p>
                <p className="text-secondary mt-0.5 text-text-secondary">{a.mensaje}</p>
                <p className="text-caption mt-1 text-text-tertiary">{formatFecha(a.creadoEn)}</p>
              </div>
              <form action={eliminarAnuncio}>
                <input type="hidden" name="id" value={a.id} />
                <IconButton ariaLabel="Eliminar anuncio" type="submit" className="bg-surface-2">
                  <Trash2 size={16} className="text-error" />
                </IconButton>
              </form>
            </Card>
          ))}
        </>
      )}
      </div>
    </div>
  );
}
