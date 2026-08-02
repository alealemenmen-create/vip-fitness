"use client";

import { useActionState } from "react";
import { guardarDatosPersonales, type FormState } from "@/app/alumno/perfil/actions";
import type { DatosPersonales } from "@/app/alumno/perfil/data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CampoFecha } from "@/components/ui/CampoFecha";
import { SEXOS } from "@/lib/solicitudes/campos";

const initialState: FormState = { error: null, ok: false };

export function DatosPersonalesForm({ datos }: { datos: DatosPersonales }) {
  const [state, formAction, pending] = useActionState(guardarDatosPersonales, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="perfil-nombre" className="text-caption mb-1.5 block text-text-tertiary">
            NOMBRE
          </label>
          <Input
            id="perfil-nombre"
            name="nombre"
            required
            defaultValue={datos.nombre}
            className="uppercase"
          />
        </div>

        <div>
          <label htmlFor="perfil-nacimiento" className="text-caption mb-1.5 block text-text-tertiary">
            FECHA DE NACIMIENTO
          </label>
          <CampoFecha
            id="perfil-nacimiento"
            name="fecha_nacimiento"
            defaultValue={datos.fechaNacimiento ?? ""}
          />
        </div>

        <div>
          <label htmlFor="perfil-telefono" className="text-caption mb-1.5 block text-text-tertiary">
            TELÉFONO (WHATSAPP)
          </label>
          <Input
            id="perfil-telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
            defaultValue={datos.telefono ?? ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="perfil-sexo" className="text-caption mb-1.5 block text-text-tertiary">
              SEXO
            </label>
            <Select id="perfil-sexo" name="sexo" defaultValue={datos.sexo ?? ""}>
              <option value="">Prefiero no decirlo</option>
              {SEXOS.filter((s) => s.valor !== "otro").map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              htmlFor="perfil-estatura"
              className="text-caption mb-1.5 block text-text-tertiary"
            >
              ESTATURA (CM)
            </label>
            <Input
              id="perfil-estatura"
              name="estatura_cm"
              type="number"
              step="0.5"
              min="80"
              max="260"
              inputMode="decimal"
              placeholder="170"
              defaultValue={datos.estaturaCm ?? ""}
            />
          </div>
        </div>

        <div>
          <label className="text-caption mb-1.5 block text-text-tertiary">CONDICIÓN MÉDICA</label>
          <Textarea
            name="condicion_medica"
            rows={2}
            placeholder="Ej: Ninguna, asma, hipertensión, lesión previa…"
            defaultValue={datos.condicionMedica ?? ""}
          />
        </div>

        <div>
          <label className="text-caption mb-1.5 block text-text-tertiary">
            CONDICIÓN ALIMENTICIA / ALERGIAS
          </label>
          <Textarea
            name="restriccion_alimenticia"
            rows={2}
            placeholder="Ej: Ninguna, vegetariano, alergia a maní…"
            defaultValue={datos.restriccionAlimenticia ?? ""}
          />
        </div>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && !state.error && <p className="text-caption text-success">Guardado.</p>}

        <Button type="submit" loading={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </Card>
  );
}
