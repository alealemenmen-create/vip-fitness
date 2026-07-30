"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { publicarRutinaAVariosAlumnos } from "@/app/admin/archivos/actions";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

type Ejercicio = RutinaExtraida["dias"][number]["ejercicios"][number];
type Dia = RutinaExtraida["dias"][number];

const EJERCICIO_VACIO: Ejercicio = {
  orden: 0,
  nombre: "",
  series: 3,
  reps: "10-12",
  descansoSegundos: 60,
  tecnicaTipo: null,
  tecnicaInstruccion: null,
  observacion: null,
  grupoMuscular: null,
};

const GRUPOS_MUSCULARES: { value: NonNullable<Ejercicio["grupoMuscular"]>; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "brazos", label: "Brazos" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
];

/** Una fila por ejercicio, no una ficha.
 *
 * Antes se dibujaban los 7 campos apilados siempre: con una rutina de 7 días y
 * 8 ejercicios por día eran 56 bloques altísimos, imposibles de repasar. Ahora
 * queda a la vista lo que de verdad se corrige (nombre, series, reps, descanso)
 * y el resto se despliega solo si hace falta — o solo si ya trae contenido, así
 * nada de lo que extrajo la IA queda escondido. */
function EjercicioForm({
  numero,
  ejercicio,
  onChange,
  onRemove,
}: {
  numero: number;
  ejercicio: Ejercicio;
  onChange: (e: Ejercicio) => void;
  onRemove: () => void;
}) {
  const traeExtras = Boolean(
    ejercicio.grupoMuscular || ejercicio.tecnicaTipo || ejercicio.observacion
  );
  const [ampliado, setAmpliado] = useState(traeExtras);

  return (
    <div className="radius-control border border-border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-right text-text-tertiary">{numero}</span>
        <Input
          value={ejercicio.nombre}
          onChange={(e) => onChange({ ...ejercicio, nombre: e.target.value })}
          placeholder="Nombre del ejercicio"
          className="flex-1 py-1.5"
        />
        <IconButton ariaLabel="Quitar ejercicio" onClick={onRemove}>
          <Trash2 size={15} className="text-error" />
        </IconButton>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 pl-[22px]">
        <label className="text-caption shrink-0 text-text-tertiary">Series</label>
        <Input
          type="number"
          min="1"
          value={ejercicio.series}
          onChange={(e) => onChange({ ...ejercicio, series: Number(e.target.value) })}
          className="w-12 px-1.5 py-1 text-center"
        />
        <label className="text-caption shrink-0 text-text-tertiary">Reps</label>
        <Input
          value={ejercicio.reps}
          onChange={(e) => onChange({ ...ejercicio, reps: e.target.value })}
          className="w-16 px-1.5 py-1 text-center"
        />
        <label className="text-caption shrink-0 text-text-tertiary">Desc.</label>
        <Input
          type="number"
          min="0"
          value={ejercicio.descansoSegundos ?? ""}
          onChange={(e) =>
            onChange({
              ...ejercicio,
              descansoSegundos: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-14 px-1.5 py-1 text-center"
        />
        <button
          type="button"
          onClick={() => setAmpliado((v) => !v)}
          aria-label={ampliado ? "Ocultar detalles" : "Más detalles"}
          className="ml-auto shrink-0 p-1 text-text-tertiary"
        >
          {ampliado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {ampliado && (
        <div className="mt-2 space-y-1.5 pl-[22px]">
          <Select
            value={ejercicio.grupoMuscular ?? ""}
            onChange={(e) =>
              onChange({
                ...ejercicio,
                grupoMuscular: (e.target.value || null) as Ejercicio["grupoMuscular"],
              })
            }
            className="py-1.5"
          >
            <option value="">Grupo muscular sin especificar</option>
            {GRUPOS_MUSCULARES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
          <Input
            value={ejercicio.tecnicaTipo ?? ""}
            onChange={(e) => onChange({ ...ejercicio, tecnicaTipo: e.target.value || null })}
            placeholder="Técnica especial (ej: Biserie (1/2))"
            className="py-1.5"
          />
          {ejercicio.tecnicaTipo && (
            <Textarea
              value={ejercicio.tecnicaInstruccion ?? ""}
              onChange={(e) =>
                onChange({ ...ejercicio, tecnicaInstruccion: e.target.value || null })
              }
              placeholder="Instrucción de la técnica"
              rows={2}
              className="py-1.5"
            />
          )}
          <Input
            value={ejercicio.observacion ?? ""}
            onChange={(e) => onChange({ ...ejercicio, observacion: e.target.value || null })}
            placeholder="Observación"
            className="py-1.5"
          />
        </div>
      )}
    </div>
  );
}

/** Editor de la rutina que extrajo la IA, antes de publicarla.
 *
 * Recibe una LISTA de alumnos, no uno solo: desde la sección Documentos el
 * mismo PDF se analiza una vez y se publica a todos los que se marcaron. Desde
 * el perfil de un alumno se le pasa una lista de uno. */
export function RutinaDraftEditor({
  alumnoIds,
  draftInicial,
  onDescartar,
}: {
  alumnoIds: string[];
  draftInicial: RutinaExtraida;
  onDescartar: () => void;
}) {
  const [draft, setDraft] = useState(draftInicial);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicado, setPublicado] = useState(false);
  const [fallidos, setFallidos] = useState<{ nombre: string; error: string }[]>([]);
  const [publicados, setPublicados] = useState(0);

  const actualizarDia = (diaIdx: number, cambios: Partial<Dia>) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) => (i === diaIdx ? { ...dia, ...cambios } : dia)),
    }));
  };

  const actualizarEjercicio = (diaIdx: number, ejIdx: number, ejercicio: Ejercicio) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx
          ? { ...dia, ejercicios: dia.ejercicios.map((e, j) => (j === ejIdx ? ejercicio : e)) }
          : dia
      ),
    }));
  };

  const agregarEjercicio = (diaIdx: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx ? { ...dia, ejercicios: [...dia.ejercicios, { ...EJERCICIO_VACIO }] } : dia
      ),
    }));
  };

  const quitarEjercicio = (diaIdx: number, ejIdx: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx ? { ...dia, ejercicios: dia.ejercicios.filter((_, j) => j !== ejIdx) } : dia
      ),
    }));
  };

  const moverDia = (diaIdx: number, direccion: -1 | 1) => {
    setDraft((d) => {
      const nuevos = [...d.dias];
      const destino = diaIdx + direccion;
      if (destino < 0 || destino >= nuevos.length) return d;
      [nuevos[diaIdx], nuevos[destino]] = [nuevos[destino], nuevos[diaIdx]];
      return { ...d, dias: nuevos };
    });
  };

  const quitarDia = (diaIdx: number) => {
    setDraft((d) => ({ ...d, dias: d.dias.filter((_, i) => i !== diaIdx) }));
  };

  const agregarDia = () => {
    setDraft((d) => ({
      ...d,
      dias: [
        ...d.dias,
        {
          numero: d.dias.length + 1,
          nombre: `Día ${d.dias.length + 1}`,
          tipo: "entrenamiento",
          descripcion: null,
          ejercicios: [],
        },
      ],
    }));
  };

  const publicar = async () => {
    setPublicando(true);
    setError(null);

    // El try/finally NO es decorativo. Antes, si la acción del servidor lanzaba
    // (error de red, función cortada por tiempo, fallo del servidor), la promesa
    // se rechazaba y el `setPublicando(false)` de abajo nunca se ejecutaba: el
    // botón quedaba en "Publicando…" para siempre, sin mostrar nada. El
    // entrenador no tenía forma de saber que había fallado, ni yo de saber por
    // qué. Cualquier fallo tiene que terminar en un mensaje en pantalla.
    try {
      const resultado = await publicarRutinaAVariosAlumnos(alumnoIds, draft);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      // Puede haber salido bien para unos y mal para otros: se muestra el
      // resultado real en vez de un "listo" que oculte a los que quedaron fuera.
      setPublicados(resultado.publicados);
      setFallidos(resultado.fallidos.map((f) => ({ nombre: f.nombre, error: f.error })));

      if (resultado.publicados === 0) {
        setError("No fue posible publicar la rutina a ningún alumno.");
        return;
      }
      setPublicado(true);
    } catch (e) {
      setError(
        `No se pudo publicar: ${e instanceof Error ? e.message : "error inesperado"}. ` +
          "La rutina sigue aquí, puedes intentar de nuevo."
      );
    } finally {
      setPublicando(false);
    }
  };

  if (publicado) {
    return (
      <Card>
        <p className="text-body text-text">
          {publicados === 1
            ? "Rutina publicada. Ya está disponible en Entrenar para el alumno."
            : `Rutina publicada para ${publicados} alumnos. Ya está disponible en Entrenar.`}
        </p>
        {fallidos.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-caption mb-1 text-error">
              No se pudo publicar a {fallidos.length}{" "}
              {fallidos.length === 1 ? "alumno" : "alumnos"}:
            </p>
            {fallidos.map((f) => (
              <p key={f.nombre} className="text-caption text-text-secondary">
                {f.nombre} — {f.error}
              </p>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE DE LA RUTINA</label>
        <Input
          value={draft.nombreRutina}
          onChange={(e) => setDraft((d) => ({ ...d, nombreRutina: e.target.value }))}
        />
      </Card>

      {draft.dias.map((dia, diaIdx) => (
        <Card key={diaIdx} className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={dia.numero}
              onChange={(e) => actualizarDia(diaIdx, { numero: Number(e.target.value) })}
              className="w-16 shrink-0 py-2"
            />
            <Input
              value={dia.nombre}
              onChange={(e) => actualizarDia(diaIdx, { nombre: e.target.value })}
              placeholder="Nombre del día"
              className="flex-1 py-2"
            />
            <IconButton
              ariaLabel="Mover arriba"
              onClick={() => moverDia(diaIdx, -1)}
              disabled={diaIdx === 0}
            >
              <ChevronUp size={16} className="text-text-secondary" />
            </IconButton>
            <IconButton
              ariaLabel="Mover abajo"
              onClick={() => moverDia(diaIdx, 1)}
              disabled={diaIdx === draft.dias.length - 1}
            >
              <ChevronDown size={16} className="text-text-secondary" />
            </IconButton>
            <IconButton ariaLabel="Quitar día" onClick={() => quitarDia(diaIdx)}>
              <Trash2 size={16} className="text-error" />
            </IconButton>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => actualizarDia(diaIdx, { tipo: "entrenamiento" })}
              className={`text-secondary radius-control flex-1 py-2 font-medium transition-colors duration-200 ease-in-out ${
                dia.tipo === "entrenamiento" ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
              }`}
            >
              Entrenamiento
            </button>
            <button
              onClick={() => actualizarDia(diaIdx, { tipo: "descanso" })}
              className={`text-secondary radius-control flex-1 py-2 font-medium transition-colors duration-200 ease-in-out ${
                dia.tipo === "descanso" ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
              }`}
            >
              Descanso
            </button>
          </div>

          {dia.tipo === "descanso" ? (
            <Textarea
              value={dia.descripcion ?? ""}
              onChange={(e) => actualizarDia(diaIdx, { descripcion: e.target.value || null })}
              placeholder="Sugerencia para el día de descanso (opcional, ej: Caminata ligera 20-30 min)"
              rows={2}
              className="py-2"
            />
          ) : (
            <>
              {dia.ejercicios.map((ej, ejIdx) => (
                <EjercicioForm
                  key={ejIdx}
                  numero={ejIdx + 1}
                  ejercicio={ej}
                  onChange={(e) => actualizarEjercicio(diaIdx, ejIdx, e)}
                  onRemove={() => quitarEjercicio(diaIdx, ejIdx)}
                />
              ))}

              <button
                onClick={() => agregarEjercicio(diaIdx)}
                className="text-secondary radius-control flex w-full items-center justify-center gap-1 bg-surface-2 py-2.5 font-medium text-vip"
              >
                <Plus size={16} /> Agregar ejercicio
              </button>
            </>
          )}
        </Card>
      ))}

      <button
        onClick={agregarDia}
        className="text-secondary radius-control flex w-full items-center justify-center gap-1 border border-border py-3 text-text-tertiary"
      >
        <Plus size={16} /> Agregar día
      </button>

      {error && <p className="text-caption text-error">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={publicar} loading={publicando} className="flex-1">
          {publicando ? "Publicando…" : "Confirmar y asignar rutina"}
        </Button>
        <Button variant="secondary" size="lg" onClick={onDescartar} className="w-auto px-6">
          Descartar
        </Button>
      </div>
    </div>
  );
}
