"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  EXPERIENCIAS,
  NIVELES_CARDIO,
  OBJETIVOS,
  PREFERENCIAS_EQUIPO,
  REFERENCIAS_FISICAS,
  SEXOS,
  TEMAS_SALUD,
  sufijoTiene,
  type FichaAlumno,
} from "@/lib/perfil-alumno/ficha";

/** El cuestionario del alumno, uno solo para los tres lugares donde se llena:
 * el ingreso obligatorio, "Mi entrenamiento" y el panel del entrenador.
 *
 * Se escribe tuteando y en lenguaje de sala, no de formulario médico: lo
 * contesta la persona en su teléfono, muchas veces la primera vez que abre la
 * app. Por eso las opciones dicen "llevo menos de 6 meses entrenando" en vez
 * de "principiante". */

export type EstadoFicha = { error: string | null; ok: boolean };
const INICIAL: EstadoFicha = { error: null, ok: false };

/** Un tema de salud: sí/no obligatorio y detalle solo si dice que sí. */
function PreguntaSalud({
  campo,
  pregunta,
  detalle,
  ejemplo,
  valorInicial,
}: {
  campo: string;
  pregunta: string;
  detalle: string;
  ejemplo: string;
  valorInicial: string | null;
}) {
  // Si ya hay texto guardado, la respuesta era "sí". Si la ficha nunca se
  // contestó, arranca sin marcar para obligar a elegir.
  const [tiene, setTiene] = useState<string>(valorInicial ? "si" : "");

  return (
    <div className="radius-control border border-border p-2.5">
      <p className="text-caption text-text">{pregunta}</p>
      <div className="mt-1.5 flex gap-2">
        {[
          { v: "no", t: "No" },
          { v: "si", t: "Sí" },
        ].map((o) => (
          <label
            key={o.v}
            className={`text-caption radius-control flex-1 cursor-pointer py-2 text-center font-medium ${
              tiene === o.v ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
            }`}
          >
            <input
              type="radio"
              name={sufijoTiene(campo)}
              value={o.v}
              checked={tiene === o.v}
              onChange={() => setTiene(o.v)}
              className="sr-only"
            />
            {o.t}
          </label>
        ))}
      </div>
      {tiene === "si" && (
        <div className="mt-2">
          <label className="text-micro mb-1 block text-text-tertiary">{detalle}</label>
          <Textarea name={campo} defaultValue={valorInicial ?? ""} placeholder={ejemplo} rows={2} />
        </div>
      )}
    </div>
  );
}

export function FichaAlumnoForm({
  ficha,
  accion,
  /** "ingreso": primera vez, con el mensaje de bienvenida y sin nada más en
   * pantalla. "edicion": el alumno corrige lo suyo. "admin": lo llena el
   * entrenador por él. */
  modo,
  nombreAlumno,
}: {
  ficha: FichaAlumno;
  accion: (estado: EstadoFicha, formData: FormData) => Promise<EstadoFicha>;
  modo: "ingreso" | "edicion" | "admin";
  nombreAlumno?: string;
}) {
  const [estado, action, pending] = useActionState(accion, INICIAL);
  const esAdmin = modo === "admin";

  if (estado.ok && modo === "ingreso") {
    return (
      <Card className="text-center">
        <p className="text-h3 text-text">Listo, ya te conozco mejor</p>
        <p className="text-body mt-2 text-text-secondary">
          Con estos datos tu rutina se arma pensada para ti: tu objetivo, tus días, tu nivel y lo que tu cuerpo
          necesita cuidar. Vamos a hacer un mejor trabajo.
        </p>
        {/* Recarga completa a propósito: el bloqueo del layout se evalúa en el
            servidor, así que un router.push() del cliente volvería a rebotar
            acá con datos viejos. */}
        {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Debe reevaluar en servidor el bloqueo del layout. */}
        <Button onClick={() => window.location.assign("/alumno/inicio")} className="mt-4">
          Entrar a mi entrenamiento
        </Button>
      </Card>
    );
  }

  return (
    <form
      action={action}
      className={esAdmin ? "grid items-start gap-4 lg:grid-cols-2" : "space-y-4"}
    >
      <Card className="h-fit space-y-3">
        <p className="text-caption text-text-tertiary">
          {esAdmin ? "DATOS PERSONALES" : "SOBRE TI"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">FECHA DE NACIMIENTO</label>
            <Input type="date" name="fecha_nacimiento" defaultValue={ficha.fechaNacimiento ?? ""} required />
          </div>
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">SEXO</label>
            <Select name="sexo" defaultValue={ficha.sexo ?? ""} required>
              <option value="">Seleccionar</option>
              {SEXOS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">ESTATURA (CM)</label>
            <Input type="number" name="estatura_cm" min={100} max={230} defaultValue={ficha.estaturaCm ?? ""} placeholder="170" />
          </div>
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">TELÉFONO</label>
            <Input name="telefono" defaultValue={ficha.telefono ?? ""} placeholder="+56 9 ..." />
          </div>
        </div>
      </Card>

      <Card className="h-fit space-y-3">
        <p className="text-caption text-text-tertiary">QUÉ {esAdmin ? "BUSCA" : "BUSCAS"}</p>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">OBJETIVO PRINCIPAL</label>
          <Select name="objetivo_principal" defaultValue={ficha.objetivoPrincipal ?? ""} required>
            <option value="">Seleccionar</option>
            {OBJETIVOS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">ALGO MÁS QUE {esAdmin ? "QUIERA" : "QUIERAS"} LOGRAR (OPCIONAL)</label>
          <Input name="objetivo_secundario" defaultValue={ficha.objetivoSecundario ?? ""} placeholder="Ej: mejorar la postura, correr 5 km" />
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">
            ¿QUÉ TIPO DE CUERPO {esAdmin ? "BUSCA" : "TE GUSTARÍA DESARROLLAR"}?
          </label>
          <Select name="categoria_competencia" defaultValue={ficha.categoriaReferencia ?? "ninguna"}>
            {REFERENCIAS_FISICAS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {esAdmin ? `${opcion.descripcion} — ${opcion.tecnica}` : opcion.descripcion}
              </option>
            ))}
          </Select>
          <p className="text-micro mt-1 text-text-tertiary">
            {esAdmin
              ? "Es una referencia visual editable: orienta el énfasis, pero el entrenador decide la programación final."
              : "No necesitas conocer categorías de competencia. Tu entrenador revisará esta referencia contigo."}
          </p>
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">EXPERIENCIA ENTRENANDO</label>
          <Select name="experiencia" defaultValue={ficha.experiencia ?? ""} required>
            <option value="">Seleccionar</option>
            {EXPERIENCIAS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className={`h-fit space-y-3 ${esAdmin ? "lg:col-span-2" : ""}`}>
        <p className="text-caption text-text-tertiary">DISPONIBILIDAD</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">DÍAS POR SEMANA</label>
            <Input type="number" name="dias_disponibles" min={1} max={7} defaultValue={ficha.diasDisponibles ?? 3} required />
          </div>
          <div>
            <label className="text-micro mb-1 block text-text-tertiary">MINUTOS POR SESIÓN</label>
            <Input type="number" name="minutos_sesion" min={20} max={180} step={5} defaultValue={ficha.minutosSesion ?? 60} required />
          </div>
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">CONDICIÓN CARDIOVASCULAR ACTUAL</label>
          <Select name="cardio_nivel" defaultValue={ficha.cardioNivel ?? "medio"}>
            {NIVELES_CARDIO.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">PREFERENCIA DE EQUIPO</label>
          <Select name="preferencia_equipo" defaultValue={ficha.preferenciaEquipo ?? "indistinto"}>
            {PREFERENCIAS_EQUIPO.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">OTRAS ACTIVIDADES O DEPORTES (OPCIONAL)</label>
          <Textarea name="actividades_adicionales" defaultValue={ficha.actividadesAdicionales ?? ""} placeholder="Ej: juego fútbol los domingos" rows={2} />
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">EJERCICIOS QUE {esAdmin ? "LE GUSTAN" : "TE GUSTAN"} (OPCIONAL)</label>
          <Textarea name="ejercicios_preferidos" defaultValue={ficha.ejerciciosPreferidos ?? ""} rows={2} />
        </div>
        <div>
          <label className="text-micro mb-1 block text-text-tertiary">EJERCICIOS QUE NO {esAdmin ? "QUIERE" : "QUIERES"} HACER (OPCIONAL)</label>
          <Textarea name="ejercicios_no_deseados" defaultValue={ficha.ejerciciosNoDeseados ?? ""} placeholder="Ej: nada de peso muerto" rows={2} />
        </div>
      </Card>

      <Card className={`space-y-2.5 ${esAdmin ? "lg:col-span-2" : ""}`}>
        <p className="text-caption text-text-tertiary">SALUD</p>
        <p className="text-caption text-text-secondary">
          {esAdmin
            ? "Lo que responda acá decide qué ejercicios se descartan al armarle la rutina. Un dato omitido es un riesgo real."
            : "Esto no reemplaza una evaluación médica, pero decide qué ejercicios entran en tu rutina. Cuéntalo aunque te parezca menor."}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TEMAS_SALUD.map((t) => (
            <PreguntaSalud
              key={t.campo}
              campo={t.campo}
              pregunta={t.pregunta}
              detalle={t.detalle}
              ejemplo={t.ejemplo}
              valorInicial={
                (ficha[
                  {
                    molestias: "molestias",
                    lesiones_diagnosticadas: "lesionesDiagnosticadas",
                    operaciones_previas: "operacionesPrevias",
                    condiciones_medicas: "condicionesMedicas",
                    medicamentos_relevantes: "medicamentosRelevantes",
                  }[t.campo] as keyof FichaAlumno
                ] as string | null) ?? null
              }
            />
          ))}
        </div>
        <label className="text-caption flex gap-2 text-text-secondary">
          <input type="checkbox" name="autorizacion_medica" value="si" defaultChecked={ficha.autorizacionMedica} />
          {esAdmin ? "Tiene autorización médica, si su situación la requiere." : "Tengo autorización médica, si mi situación la requiere."}
        </label>
        {!esAdmin && (
          <label className="text-caption flex gap-2 text-text-secondary">
            <input type="checkbox" name="declaracion_veracidad" value="si" defaultChecked required />
            Confirmo que la información es correcta y avisaré si algo cambia.
          </label>
        )}
      </Card>

      <div className={`space-y-2 ${esAdmin ? "lg:col-span-2" : ""}`}>
        {estado.error && <p className="text-caption text-error">{estado.error}</p>}
        {estado.ok && modo !== "ingreso" && (
          <p className="text-caption text-success">
            {esAdmin ? "Ficha guardada. El generador ya la usa." : "Guardado. Tu entrenador ya lo puede ver."}
          </p>
        )}

        <Button type="submit" loading={pending}>
          {pending ? "Guardando…" : modo === "ingreso" ? "Guardar y entrar" : "Guardar ficha"}
        </Button>

        {nombreAlumno && esAdmin && (
          <p className="text-micro text-text-tertiary">
            Estás llenando la ficha de {nombreAlumno}. Él la puede corregir después desde su app.
          </p>
        )}
      </div>
    </form>
  );
}
