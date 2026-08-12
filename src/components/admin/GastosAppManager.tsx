"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CalendarClock, Check, CircleDollarSign, ExternalLink, Pencil, Plus, ReceiptText } from "lucide-react";
import { guardarGasto, marcarGastoPagado, cambiarEstadoGasto, type EstadoGastoAccion } from "@/app/admin/gastos/actions";
import type { GastoApp, PagoGasto } from "@/lib/gastos/data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

const INICIAL: EstadoGastoAccion = { ok: false, mensaje: "" };
const CICLOS = { mensual: "Mensual", anual: "Anual", variable: "Variable / por consumo", unico: "Pago único" } as const;

function dinero(monto: number | null, moneda: string): string {
  if (monto === null) return "Monto por completar";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: moneda, maximumFractionDigits: moneda === "CLP" ? 0 : 2 }).format(monto);
}

function aviso(gasto: GastoApp): { texto: string; clase: string } {
  if (gasto.estado === "vencido") return { texto: `Vencido hace ${Math.abs(gasto.dias ?? 0)} día${gasto.dias === -1 ? "" : "s"}`, clase: "border-error/40 bg-error/10 text-error" };
  if (gasto.estado === "hoy") return { texto: "Toca pagar hoy", clase: "border-error/40 bg-error/10 text-error" };
  if (gasto.estado === "proximo") return { texto: `Toca en ${gasto.dias} día${gasto.dias === 1 ? "" : "s"}`, clase: "border-warning/40 bg-warning/10 text-warning" };
  if (gasto.estado === "sin_fecha") return { texto: "Fecha por completar", clase: "border-border bg-surface-2 text-text-tertiary" };
  return { texto: `Al día · ${gasto.proximaFecha}`, clase: "border-success/30 bg-success/10 text-success" };
}

function FormularioGasto({ editando, alTerminar }: { editando: GastoApp | null; alTerminar: () => void }) {
  const [state, action, pending] = useActionState(guardarGasto, INICIAL);
  return (
    <Card className="border border-border" padding="p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-vip/15 text-vip">{editando ? <Pencil size={17} /> : <Plus size={18} />}</span>
        <div><p className="text-secondary font-bold text-text">{editando ? `Editar ${editando.nombre}` : "Agregar servicio o gasto"}</p><p className="text-micro text-text-tertiary">No guardes tarjetas, claves ni contraseñas.</p></div>
      </div>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <label className="text-caption text-text-secondary">Nombre<Input name="nombre" required defaultValue={editando?.nombre ?? ""} className="mt-1" placeholder="Ej: Apple Developer" /></label>
        <label className="text-caption text-text-secondary">Categoría<Select name="categoria" defaultValue={editando?.categoria ?? "servicio"} className="mt-1"><option value="infraestructura">Infraestructura</option><option value="ia">Inteligencia artificial</option><option value="dominio">Dominio</option><option value="comunicaciones">Comunicaciones</option><option value="desarrollo">Desarrollo</option><option value="servicio">Servicio</option><option value="otro">Otro</option></Select></label>
        <label className="text-caption text-text-secondary">Proveedor<Input name="proveedor" defaultValue={editando?.proveedor ?? ""} className="mt-1" /></label>
        <label className="text-caption text-text-secondary">Plan<Input name="plan" defaultValue={editando?.plan ?? ""} className="mt-1" placeholder="Gratis, Pro, variable…" /></label>
        <label className="text-caption text-text-secondary">Monto estimado<Input name="monto_estimado" type="number" min="0" step="0.01" defaultValue={editando?.montoEstimado ?? ""} className="mt-1" /></label>
        <label className="text-caption text-text-secondary">Moneda<Select name="moneda" defaultValue={editando?.moneda ?? "USD"} className="mt-1"><option value="CLP">CLP</option><option value="USD">USD</option><option value="EUR">EUR</option></Select></label>
        <label className="text-caption text-text-secondary">Frecuencia<Select name="ciclo" defaultValue={editando?.ciclo ?? "mensual"} className="mt-1"><option value="mensual">Mensual</option><option value="anual">Anual</option><option value="variable">Variable / por consumo</option><option value="unico">Pago único</option></Select></label>
        <label className="text-caption text-text-secondary">Próxima fecha<Input name="proxima_fecha" type="date" defaultValue={editando?.proximaFecha ?? ""} className="mt-1" /></label>
        <label className="text-caption text-text-secondary">Avisarme días antes<Input name="avisar_dias_antes" type="number" min="0" max="90" defaultValue={editando?.avisarDiasAntes ?? 3} className="mt-1" /></label>
        <label className="text-caption text-text-secondary">Panel de cobro (opcional)<Input name="enlace_panel" type="url" defaultValue={editando?.enlacePanel ?? ""} className="mt-1" placeholder="https://…" /></label>
        <label className="text-caption text-text-secondary md:col-span-2">Para qué se usa en la app<Input name="uso_app" defaultValue={editando?.usoApp ?? ""} className="mt-1" /></label>
        <label className="text-caption text-text-secondary md:col-span-2">Notas<Textarea name="notas" rows={2} defaultValue={editando?.notas ?? ""} className="mt-1" /></label>
        {state.mensaje && <p className={`text-caption md:col-span-2 ${state.ok ? "text-success" : "text-error"}`}>{state.mensaje}</p>}
        <div className="flex gap-2 md:col-span-2"><Button type="submit" size="sm" loading={pending}>{editando ? "Guardar cambios" : "Agregar gasto"}</Button>{editando && <Button type="button" size="sm" variant="secondary" onClick={alTerminar}>Cancelar</Button>}</div>
      </form>
    </Card>
  );
}

function RegistrarPago({ gasto, hoy }: { gasto: GastoApp; hoy: string }) {
  const [state, action, pending] = useActionState(marcarGastoPagado, INICIAL);
  return (
    <details className="mt-3 rounded-xl border border-border bg-surface-2/50 p-3">
      <summary className="cursor-pointer text-caption font-semibold text-vip">Marcar como pagado</summary>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="gasto_id" value={gasto.id} />
        <label className="text-micro text-text-tertiary">Fecha<Input name="fecha_pago" type="date" required defaultValue={hoy} className="mt-1 !py-2" /></label>
        <label className="text-micro text-text-tertiary">Monto real<Input name="monto_real" type="number" min="0" step="0.01" defaultValue={gasto.montoEstimado ?? ""} className="mt-1 !py-2" /></label>
        <label className="text-micro text-text-tertiary sm:col-span-2">Nota<Input name="nota" placeholder="Factura, exceso de consumo…" className="mt-1 !py-2" /></label>
        {state.mensaje && <p className={`text-caption sm:col-span-2 ${state.ok ? "text-success" : "text-error"}`}>{state.mensaje}</p>}
        <Button type="submit" size="xsAuto" loading={pending} className="sm:col-span-2"><Check size={15} /> Confirmar pago</Button>
      </form>
    </details>
  );
}

export function GastosAppManager({ gastos, pagos, hoy }: { gastos: GastoApp[]; pagos: PagoGasto[]; hoy: string }) {
  const [editando, setEditando] = useState<GastoApp | null>(null);
  const activos = gastos.filter((gasto) => gasto.activo);
  const alertas = activos.filter((gasto) => ["vencido", "hoy", "proximo"].includes(gasto.estado));
  const estimados = (["USD", "CLP", "EUR"] as const).map((moneda) => ({ moneda, total: activos.filter((g) => g.moneda === moneda && g.montoEstimado !== null).reduce((total, gasto) => total + (gasto.ciclo === "anual" ? (gasto.montoEstimado ?? 0) / 12 : (gasto.montoEstimado ?? 0)), 0) })).filter((item) => item.total > 0);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card padding="p-4"><CircleDollarSign size={19} className="text-vip" /><p className="mt-2 text-h3 text-text">{activos.length}</p><p className="text-caption text-text-tertiary">Servicios activos</p></Card>
        <Card padding="p-4"><CalendarClock size={19} className={alertas.length ? "text-error" : "text-success"} /><p className="mt-2 text-h3 text-text">{alertas.length}</p><p className="text-caption text-text-tertiary">Por pagar pronto</p></Card>
        <Card padding="p-4" className="col-span-2"><p className="text-micro text-text-tertiary">ESTIMADO MENSUAL POR MONEDA</p><div className="mt-2 flex flex-wrap gap-3">{estimados.map((item) => <span key={item.moneda} className="text-secondary font-bold text-text">{dinero(item.total, item.moneda)}</span>)}</div><p className="text-micro mt-1 text-text-tertiary">Anuales prorrateados · variables son referencias.</p></Card>
      </section>

      {alertas.length > 0 && <Card className="border border-error/35 bg-error/5" padding="p-4"><p className="flex items-center gap-2 text-secondary font-bold text-error"><AlertTriangle size={17} /> Pagos que necesitan atención</p><p className="text-caption mt-1 text-text-secondary">La app te avisará desde los días configurados para cada servicio.</p></Card>}

      <FormularioGasto key={editando?.id ?? "nuevo"} editando={editando} alTerminar={() => setEditando(null)} />

      <section className="space-y-3">
        <div><h2 className="text-body font-bold text-text">Todos los gastos de la app</h2><p className="text-caption text-text-tertiary">Infraestructura, dominio, IA, correo y herramientas.</p></div>
        {gastos.map((gasto) => { const estado = aviso(gasto); return (
          <Card key={gasto.id} className={gasto.activo ? "border border-border" : "border border-border opacity-55"} padding="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-vip/12 text-vip"><ReceiptText size={19} /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-secondary font-bold text-text">{gasto.nombre}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${estado.clase}`}>{estado.texto}</span></div><p className="text-caption text-text-secondary">{dinero(gasto.montoEstimado, gasto.moneda)} · {CICLOS[gasto.ciclo]}</p><p className="text-micro mt-0.5 text-text-tertiary">{gasto.usoApp ?? gasto.plan ?? "Uso por completar"}</p></div>
              <button type="button" onClick={() => setEditando(gasto)} aria-label={`Editar ${gasto.nombre}`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-text-secondary"><Pencil size={14} /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-micro text-text-tertiary">{gasto.proximaFecha && <span>Próximo: {gasto.proximaFecha}</span>}<span>Aviso: {gasto.avisarDiasAntes} días antes</span>{gasto.enlacePanel && <a href={gasto.enlacePanel} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-vip">Abrir cobro <ExternalLink size={11} /></a>}</div>
            {gasto.notas && <p className="text-caption mt-2 rounded-xl bg-surface-2 px-3 py-2 text-text-secondary">{gasto.notas}</p>}
            {gasto.activo && <RegistrarPago gasto={gasto} hoy={hoy} />}
            <form action={cambiarEstadoGasto} className="mt-2 text-right"><input type="hidden" name="id" value={gasto.id} /><input type="hidden" name="activo" value={gasto.activo ? "false" : "true"} /><button className="text-micro text-text-tertiary underline">{gasto.activo ? "Dejar de controlar" : "Reactivar"}</button></form>
          </Card>
        ); })}
      </section>

      <section className="space-y-3"><div><h2 className="text-body font-bold text-text">Historial de pagos</h2><p className="text-caption text-text-tertiary">Todo lo registrado queda aquí; marcar pagado no borra el cobro anterior.</p></div>{pagos.length === 0 ? <Card padding="p-4"><p className="text-caption text-text-secondary">Todavía no hay pagos registrados.</p></Card> : <Card padding="p-0" className="overflow-hidden"><div className="divide-y divide-border">{pagos.map((pago) => <div key={pago.id} className="flex items-center gap-3 px-4 py-3"><Check size={15} className="shrink-0 text-success" /><div className="min-w-0 flex-1"><p className="text-caption font-semibold text-text">{pago.gastoNombre}</p><p className="text-micro text-text-tertiary">{pago.fechaPago}{pago.nota ? ` · ${pago.nota}` : ""}</p></div><p className="text-caption shrink-0 font-bold text-text">{dinero(pago.montoReal, pago.moneda)}</p></div>)}</div></Card>}</section>
    </div>
  );
}
