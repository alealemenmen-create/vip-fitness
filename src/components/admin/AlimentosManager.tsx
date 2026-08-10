"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Search, Sparkles, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  guardarAlimento,
  alternarActivoAlimento,
  sugerirMedidaAlimento,
  type FormState,
} from "@/app/admin/alimentos/actions";

export type AlimentoAdmin = {
  id: string;
  nombre: string;
  categoria: string | null;
  porcionBase: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  activo: boolean;
};

const initialState: FormState = { error: null, ok: false };

function AlimentoForm({
  alimento,
  onCerrar,
}: {
  alimento: AlimentoAdmin | null;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(guardarAlimento, initialState);
  const [nombre, setNombre] = useState(alimento?.nombre ?? "");
  const [categoria, setCategoria] = useState(alimento?.categoria ?? "");
  const [porcionBase, setPorcionBase] = useState(alimento?.porcionBase ?? 100);
  const [unidad, setUnidad] = useState(alimento?.unidad ?? "g");
  const [detectando, setDetectando] = useState(false);
  const [errorDeteccion, setErrorDeteccion] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) onCerrar();
  }, [state.ok, onCerrar]);

  const detectarConIA = async () => {
    setDetectando(true);
    setErrorDeteccion(null);
    const resultado = await sugerirMedidaAlimento(nombre, categoria);
    if (resultado.ok) {
      setPorcionBase(resultado.datos.porcionBase);
      setUnidad(resultado.datos.unidad);
    } else {
      setErrorDeteccion(resultado.error);
    }
    setDetectando(false);
  };

  return (
    <Card>
      <p className="text-caption mb-3 text-text-tertiary">
        {alimento ? "EDITAR ALIMENTO" : "NUEVO ALIMENTO"}
      </p>
      <form action={formAction} className="space-y-3">
        {alimento && <input type="hidden" name="alimento_id" value={alimento.id} />}
        <Input
          name="nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            name="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Categoría"
            className="py-2"
          />
          <div className="flex gap-2">
            <Input
              name="porcion_base"
              type="number"
              min="1"
              value={porcionBase}
              onChange={(e) => setPorcionBase(Number(e.target.value))}
              className="w-1/2 py-2"
            />
            <Input
              name="unidad"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-1/2 py-2"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={detectando}
          disabled={!nombre.trim()}
          onClick={detectarConIA}
          className="w-full"
        >
          <Sparkles size={16} /> {detectando ? "Detectando…" : "Detectar unidad con IA"}
        </Button>
        {errorDeteccion && <p className="text-caption text-error">{errorDeteccion}</p>}
        <div className="grid grid-cols-4 gap-2">
          {(["kcal", "prot", "carb", "grasa"] as const).map((campo) => (
            <Input
              key={campo}
              name={campo}
              type="number"
              step="0.1"
              min="0"
              defaultValue={alimento?.[campo] ?? ""}
              placeholder={campo}
              className="py-2 text-caption"
            />
          ))}
        </div>
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="success" size="sm" loading={pending} className="flex-1">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

const SIN_CATEGORIA = "Sin categoría";

function FilaAlimento({
  alimento,
  onEditar,
}: {
  alimento: AlimentoAdmin;
  onEditar: () => void;
}) {
  return (
    <Card className={`flex items-center justify-between ${!alimento.activo ? "opacity-50" : ""}`}>
      <div>
        <p className="text-body text-text">{alimento.nombre}</p>
        <p className="text-caption text-text-tertiary">
          {alimento.kcal} kcal · P{alimento.prot} C{alimento.carb} G{alimento.grasa} /{alimento.porcionBase}
          {alimento.unidad}
        </p>
        {alimento.categoria && <Pill tone="neutral">{alimento.categoria}</Pill>}
      </div>
      <div className="flex gap-2">
        <IconButton ariaLabel="Editar alimento" onClick={onEditar} className="bg-surface-2">
          <Pencil size={16} className="text-text-secondary" />
        </IconButton>
        <button
          onClick={() => alternarActivoAlimento(alimento.id, !alimento.activo)}
          className={`text-caption radius-control bg-surface-2 px-3 py-2 ${
            alimento.activo ? "text-error" : "text-success"
          }`}
        >
          {alimento.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </Card>
  );
}

export function AlimentosManager({
  alimentos,
  categoriaInicial,
}: {
  alimentos: AlimentoAdmin[];
  categoriaInicial?: string;
}) {
  const [editando, setEditando] = useState<"nuevo" | AlimentoAdmin | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Set<string>>(
    () => new Set(categoriaInicial ? [categoriaInicial] : [])
  );

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return alimentos;
    return alimentos.filter((a) => a.nombre.toLowerCase().includes(q));
  }, [alimentos, busqueda]);

  // Agrupados por categoría — el catálogo completo (171 alimentos y creciendo)
  // tardaba en renderizar entero de una: ahora solo se monta la tarjeta de
  // cada alimento cuando su categoría está abierta. Buscando, la agrupación se
  // salta: se quiere ver el resultado ya, sin tener que abrir la categoría.
  const porCategoria = useMemo(() => {
    const mapa = new Map<string, AlimentoAdmin[]>();
    for (const a of filtrados) {
      const clave = a.categoria || SIN_CATEGORIA;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(a);
    }
    return [...mapa.entries()].sort(([x], [y]) => x.localeCompare(y));
  }, [filtrados]);

  const buscando = busqueda.trim().length > 0;

  function alternarCategoria(categoria: string) {
    setCategoriasAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(categoria)) siguiente.delete(categoria);
      else siguiente.add(categoria);
      return siguiente;
    });
  }

  return (
    <div className="space-y-3">
      {!editando && (
        <>
          <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-4 py-3">
            <Search size={18} className="text-text-secondary" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alimento…"
              className="flex-1 bg-transparent text-body text-text outline-none"
            />
          </div>

          <Button onClick={() => setEditando("nuevo")}>
            <Plus size={18} /> Nuevo alimento
          </Button>
        </>
      )}

      {editando && (
        <AlimentoForm
          alimento={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}

      {!editando && buscando && (
        <div className="space-y-3">
          {filtrados.map((a) => (
            <FilaAlimento key={a.id} alimento={a} onEditar={() => setEditando(a)} />
          ))}
          {filtrados.length === 0 && (
            <p className="text-body py-6 text-center text-text-secondary">
              Ningún alimento coincide con &quot;{busqueda}&quot;.
            </p>
          )}
        </div>
      )}

      {!editando &&
        !buscando &&
        porCategoria.map(([categoria, items]) => {
          const abierta = categoriasAbiertas.has(categoria);
          return (
            <div key={categoria} className="space-y-2">
              <button
                onClick={() => alternarCategoria(categoria)}
                className="radius-control flex w-full items-center justify-between border border-border bg-surface-2 px-4 py-3"
              >
                <span className="text-body text-text">{categoria}</span>
                <span className="flex items-center gap-2 text-caption text-text-tertiary">
                  {items.length}
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${abierta ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {abierta && (
                <div className="space-y-2 pl-1">
                  {items.map((a) => (
                    <FilaAlimento key={a.id} alimento={a} onEditar={() => setEditando(a)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
