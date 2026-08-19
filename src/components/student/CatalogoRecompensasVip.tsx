"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, LockKeyhole, PackageCheck, Sparkles } from "lucide-react";
import { solicitarCanjeVip } from "@/app/alumno/ranked/recompensas-actions";
import type { CanjeVip, RecompensaVip } from "@/lib/recompensas/data";

const ETIQUETA_ESTADO: Record<CanjeVip["estado"], string> = {
  solicitado: "En revisión",
  aprobado: "Aprobado",
  entregado: "Entregado",
  rechazado: "Rechazado · puntos devueltos",
  cancelado: "Cancelado · puntos devueltos",
};

export function CatalogoRecompensasVip({ saldo, catalogo, canjes }: { saldo: number; catalogo: RecompensaVip[]; canjes: CanjeVip[] }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<RecompensaVip | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [procesando, iniciar] = useTransition();

  const canjear = () => {
    if (!confirmando) return;
    setMensaje(null);
    iniciar(async () => {
      const resultado = await solicitarCanjeVip(confirmando.id);
      if (!resultado.ok) return setMensaje(resultado.error);
      setMensaje("Canje solicitado. El stock quedó reservado y tus puntos fueron descontados una sola vez.");
      setConfirmando(null);
      router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <div className="ranked-section-heading">
        <span className="ranked-section-icon"><Gift size={18} /></span>
        <div className="min-w-0 flex-1"><p className="ranked-casino-kicker"><Sparkles size={12} /> Recompensas reales</p><h2 className="text-body font-bold text-text">Tienda VIP</h2><p className="text-micro text-text-tertiary">Saldo disponible: {saldo.toLocaleString("es-CL")} Puntos VIP</p></div>
      </div>
      {catalogo.length ? <div className="grid gap-2 sm:grid-cols-2">{catalogo.map((item) => {
        const sinStock = item.stock === 0;
        const sinSaldo = saldo < item.costoPuntos;
        return <article key={item.id} className="ranked-casino-card radius-card flex min-h-32 flex-col p-4">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.14em] text-vip">{item.tipo}</span><h3 className="mt-1 text-sm font-bold text-text">{item.nombre}</h3></div><Gift size={20} className="shrink-0 text-vip" /></div>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-text-secondary">{item.descripcion || "Recompensa exclusiva del Método VIP."}</p>
          <div className="mt-3 flex items-center justify-between gap-2"><div><strong className="text-sm text-text">{item.costoPuntos.toLocaleString("es-CL")} XP</strong><small className="block text-[9px] text-text-tertiary">{item.stock === null ? "Disponibilidad continua" : `${item.stock} disponibles`}</small></div><button type="button" disabled={procesando || sinStock || sinSaldo} onClick={() => setConfirmando(item)} className="rounded-xl bg-vip px-3 py-2 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-35">{sinStock ? "Agotado" : sinSaldo ? <span className="flex items-center gap-1"><LockKeyhole size={12} /> Faltan puntos</span> : "Canjear"}</button></div>
        </article>;
      })}</div> : <div className="ranked-casino-card radius-card p-4 text-xs text-text-secondary">El catálogo está entre temporadas. Tus puntos se conservan íntegros.</div>}
      {mensaje ? <p role="status" className="rounded-xl border border-vip/25 bg-vip/10 p-3 text-xs text-text">{mensaje}</p> : null}
      {canjes.length ? <details className="ranked-casino-card radius-card px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-text-secondary">Mis canjes ({canjes.length})</summary><div className="mt-3 space-y-2">{canjes.map((canje) => <div key={canje.id} className="flex items-center gap-3 border-t border-border pt-2"><PackageCheck size={16} className="text-vip" /><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-text">{canje.recompensaNombre}</strong><small className="text-[9px] text-text-tertiary">{ETIQUETA_ESTADO[canje.estado]}</small></div><b className="text-[10px] text-text-secondary">{canje.costo.toLocaleString("es-CL")} XP</b></div>)}</div></details> : null}
      {confirmando ? <div className="fixed inset-0 z-[100] grid place-items-end bg-black/80 p-3 sm:place-items-center" role="presentation" onClick={() => setConfirmando(null)}><section className="w-full max-w-md rounded-2xl border border-border bg-surface p-5" role="dialog" aria-modal="true" aria-label="Confirmar canje" onClick={(evento) => evento.stopPropagation()}><Check size={22} className="text-vip" /><h2 className="mt-3 text-lg font-bold text-text">Canjear {confirmando.nombre}</h2><p className="mt-2 text-xs leading-relaxed text-text-secondary">Se reservará una unidad y se descontarán {confirmando.costoPuntos.toLocaleString("es-CL")} puntos. Si el equipo rechaza el canje, el reintegro es automático y auditable.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmando(null)} className="rounded-xl border border-border py-3 text-xs font-semibold text-text-secondary">Volver</button><button type="button" disabled={procesando} onClick={canjear} className="rounded-xl bg-vip py-3 text-xs font-bold text-black">{procesando ? "Reservando…" : "Confirmar canje"}</button></div></section></div> : null}
    </section>
  );
}
