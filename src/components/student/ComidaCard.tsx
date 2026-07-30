"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, X, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  agregarAlimentoAComida,
  quitarAlimentoDeComida,
  actualizarCantidadAlimento,
  marcarComidaOmitida,
  actualizarObservacionComida,
  buscarAlimentosAction,
} from "@/app/alumno/comer/actions";
import type { AlimentoCatalogo, ComidaDia } from "@/app/alumno/comer/data";

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export function ComidaCard({
  fecha,
  comida,
  soloLectura = false,
}: {
  fecha: string;
  comida: ComidaDia;
  soloLectura?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<AlimentoCatalogo[]>([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);
  const [seleccionado, setSeleccionado] = useState<AlimentoCatalogo | null>(null);
  const [cantidad, setCantidad] = useState("100");
  /** true cuando el alumno mide en cucharadas/unidades en vez de gramos. */
  const [usarMedida, setUsarMedida] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // El catálogo tiene miles de alimentos: se consulta al servidor a medida que
  // el alumno escribe, con una pausa para no disparar una consulta por tecla.
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return;

    let vigente = true;
    const id = setTimeout(async () => {
      const encontrados = await buscarAlimentosAction(q);
      if (!vigente) return;
      setResultados(encontrados);
      setCargandoBusqueda(false);
    }, 250);

    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [busqueda]);

  /** Deja el alimento listo para ingresar la cantidad. Si trae medida propia
   * (1 cucharada, 1 unidad), se arranca en ella en vez de en 100 g. */
  const elegirAlimento = (alimento: AlimentoCatalogo) => {
    setSeleccionado(alimento);
    const conMedida = Boolean(alimento.medidaNombre && alimento.medidaGramos);
    setUsarMedida(conMedida);
    setCantidad(conMedida ? "1" : String(alimento.porcionBase));
  };

  const agregar = () => {
    if (!seleccionado) return;
    setError(null);
    // Siempre se guarda en la unidad base del alimento: la medida casera es
    // solo la forma de ingresarlo.
    const cantidadBase =
      usarMedida && seleccionado.medidaGramos
        ? Number(cantidad) * seleccionado.medidaGramos
        : Number(cantidad);
    startTransition(async () => {
      const res = await agregarAlimentoAComida(
        fecha,
        comida.tipoComida,
        seleccionado.id,
        cantidadBase,
        seleccionado.unidad
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setBuscando(false);
      setBusqueda("");
      setSeleccionado(null);
      setCantidad("100");
    });
  };

  // Tarjeta compacta: son seis por día y con el alto por defecto obligaban a
  // scrollear de más. El total del día sí queda grande.
  return (
    <Card className={`p-4 ${comida.omitida ? "opacity-50" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-card-title text-text">{comida.tipoComida}</p>
        <button
          type="button"
          disabled={soloLectura}
          onClick={
            soloLectura
              ? undefined
              : () => marcarComidaOmitida(fecha, comida.tipoComida, !comida.omitida)
          }
          className="text-caption radius-control shrink-0 border px-2.5 py-1 font-medium transition-colors duration-200 ease-in-out disabled:opacity-60"
          style={{
            borderColor: comida.omitida ? "var(--color-vip)" : "var(--color-border)",
            color: comida.omitida ? "var(--color-vip)" : "var(--color-text-tertiary)",
            background: comida.omitida ? "rgba(255,161,0,0.1)" : "transparent",
          }}
        >
          {comida.omitida ? "Omitida" : "Omitir"}
        </button>
      </div>

      {comida.alimentos.map((a) => (
        <div key={a.id} className="flex items-center justify-between py-1">
          <div className="min-w-0 flex-1">
            <p className="text-secondary truncate text-text">{a.nombre}</p>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                min="1"
                defaultValue={a.cantidad}
                disabled={soloLectura}
                onBlur={
                  soloLectura
                    ? undefined
                    : (e) => {
                        const v = Number(e.target.value);
                        if (v !== a.cantidad) actualizarCantidadAlimento(a.id, v, fecha);
                      }
                }
                className="radius-control w-20 border border-border bg-surface-2 px-2 py-1 text-caption text-text outline-none focus:border-vip disabled:opacity-70"
              />
              <span className="text-caption text-text-tertiary">{a.unidad}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-caption text-vip">{round(a.kcal)} kcal</p>
            {!soloLectura && (
              <IconButton
                ariaLabel="Quitar alimento"
                onClick={() => quitarAlimentoDeComida(a.id, fecha)}
                className="h-7 w-7"
              >
                <X size={14} className="text-error" />
              </IconButton>
            )}
          </div>
        </div>
      ))}

      {comida.alimentos.length > 0 && (
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <p className="text-caption text-text-tertiary">Subtotal</p>
          <p className="text-caption text-text">{round(comida.totales.kcal)} kcal</p>
        </div>
      )}

      {!soloLectura &&
        !comida.omitida &&
        (buscando ? (
          <div
            className={`radius-control mt-3 space-y-2 border ${
              seleccionado ? "border-border/60 p-2" : "border-border p-3"
            }`}
          >
            {/*
              El campo se oculta apenas hay un alimento elegido. Si sigue en
              pantalla, al perder el foco el teclado del celular dispara un
              onChange de confirmación que ejecutaba setSeleccionado(null): la
              app elegía el alimento y se deseleccionaba sola.
            */}
            {!seleccionado && (
              <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-3 py-2">
                <Search size={16} className="text-text-secondary" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => {
                    const valor = e.target.value;
                    // Un onChange con el mismo texto no es una edición real:
                    // es ruido del teclado y no debe borrar nada.
                    if (valor === busqueda) return;
                    setBusqueda(valor);
                    const corta = valor.trim().length < 2;
                    setCargandoBusqueda(!corta);
                    if (corta) setResultados([]);
                  }}
                  placeholder="Buscar alimento…"
                  className="flex-1 bg-transparent text-secondary text-text outline-none"
                />
              </div>
            )}

            {!seleccionado && cargandoBusqueda && (
              <p className="text-caption px-2 py-1 text-text-tertiary">Buscando…</p>
            )}

            {!seleccionado && !cargandoBusqueda && busqueda.trim().length >= 2 && resultados.length === 0 && (
              <p className="text-caption px-2 py-1 text-text-tertiary">
                Sin resultados para &quot;{busqueda.trim()}&quot;.
              </p>
            )}

            {/* Sin scroll interno: una caja chica que scrollea dentro de una
                página que también scrollea es incómoda en el celular, y pelea
                con el toque para seleccionar. */}
            {!seleccionado && resultados.length > 0 && (
              <div className="space-y-1">
                {resultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    /**
                     * Va en onPointerDown y no en onClick a propósito: en el
                     * celular el campo de búsqueda tiene el foco con el teclado
                     * abierto, y el primer toque solo lo cerraba — el clic se
                     * perdía y el alimento no se seleccionaba nunca.
                     * preventDefault evita ese blur.
                     */
                    onPointerDown={(e) => {
                      e.preventDefault();
                      elegirAlimento(r);
                    }}
                    onClick={() => elegirAlimento(r)}
                    className="text-secondary radius-control block w-full px-2 py-1.5 text-left text-text hover:bg-surface-2"
                  >
                    {r.nombre}
                    <span className="text-caption ml-1 text-text-tertiary">
                      ({r.porcionBase} {r.unidad})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {seleccionado && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-secondary min-w-0 flex-1 truncate text-text">
                    {seleccionado.nombre}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSeleccionado(null)}
                    className="text-caption shrink-0 text-text-tertiary underline"
                  >
                    cambiar
                  </button>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-16 py-1"
                  />
                  <span className="text-caption w-24 shrink-0 text-text-tertiary">
                    {usarMedida && seleccionado.medidaNombre
                      ? seleccionado.medidaNombre
                      : seleccionado.unidad}
                  </span>
                </div>

                {/* Los alimentos que no se pesan (aceite, huevo, leche) traen su
                    medida real: se registra en cucharadas o unidades y la app
                    convierte a la unidad base. */}
                {seleccionado.medidaNombre && seleccionado.medidaGramos && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        const nueva = !usarMedida;
                        setUsarMedida(nueva);
                        setCantidad(nueva ? "1" : String(seleccionado.porcionBase));
                      }}
                      className="text-caption text-vip underline"
                    >
                      {usarMedida
                        ? `Medir en ${seleccionado.unidad}`
                        : `Medir en ${seleccionado.medidaNombre}`}
                    </button>
                    {usarMedida && (
                      <span className="text-caption text-text-tertiary">
                        = {Math.round(Number(cantidad || 0) * seleccionado.medidaGramos)}{" "}
                        {seleccionado.unidad}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-caption text-error">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={agregar}
                disabled={!seleccionado || pending}
                className="flex-1"
              >
                {pending ? "Agregando…" : "Agregar"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setBuscando(false);
                  setBusqueda("");
                  setSeleccionado(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setBuscando(true)}
            className="text-secondary radius-control mt-3 flex w-full items-center justify-center gap-1 bg-surface-2 py-2.5 font-medium text-vip"
          >
            <Plus size={16} /> Agregar alimento
          </button>
        ))}

      {!comida.omitida && (comida.observacion || !soloLectura) && (
        <input
          defaultValue={comida.observacion ?? ""}
          disabled={soloLectura}
          onBlur={
            soloLectura
              ? undefined
              : (e) => actualizarObservacionComida(fecha, comida.tipoComida, e.target.value)
          }
          placeholder="Observación (opcional)"
          className="radius-control mt-3 w-full border border-border bg-surface-2 px-3 py-2 text-secondary text-text outline-none focus:border-vip disabled:opacity-70"
        />
      )}
    </Card>
  );
}
