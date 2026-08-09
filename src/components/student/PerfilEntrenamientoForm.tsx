"use client";

import { useActionState } from "react";
import { guardarPerfilEntrenamiento, type EstadoPerfilEntrenamiento } from "@/app/alumno/mi-entrenamiento/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";

const inicial: EstadoPerfilEntrenamiento = { error: null, ok: false };
type Datos = Record<string, string | number | boolean | null> | null;

export function PerfilEntrenamientoForm({ datos }: { datos: Datos }) {
  const [estado, action, pending] = useActionState(guardarPerfilEntrenamiento, inicial);
  const valor = (campo: string) => String(datos?.[campo] ?? "");
  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-3">
        <div><label className="text-caption mb-1 block text-text-tertiary">OBJETIVO PRINCIPAL</label><Select name="objetivo_principal" defaultValue={valor("objetivo_principal")} required><option value="">Seleccionar</option><option value="perdida_grasa">Pérdida de grasa</option><option value="hipertrofia">Hipertrofia</option><option value="fuerza">Fuerza</option><option value="recomposicion">Recomposición</option><option value="condicion_fisica">Condición física</option><option value="rendimiento">Rendimiento</option><option value="mantencion">Mantención</option></Select></div>
        <div><label className="text-caption mb-1 block text-text-tertiary">OBJETIVO SECUNDARIO (OPCIONAL)</label><Input name="objetivo_secundario" defaultValue={valor("objetivo_secundario")} placeholder="Ej: mejorar postura o correr 5 km" /></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-caption mb-1 block text-text-tertiary">DÍAS/SEMANA</label><Input type="number" name="dias_disponibles" min={1} max={7} defaultValue={valor("dias_disponibles") || 3} required /></div><div><label className="text-caption mb-1 block text-text-tertiary">MINUTOS/SESIÓN</label><Input type="number" name="minutos_sesion" min={20} max={180} defaultValue={valor("minutos_sesion") || 60} required /></div></div>
        <Select name="experiencia" defaultValue={valor("experiencia") || "principiante"}><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></Select>
        <Select name="cardio_nivel" defaultValue={valor("cardio_nivel") || "medio"}><option value="bajo">Cardio actual bajo</option><option value="medio">Cardio actual medio</option><option value="alto">Cardio actual alto</option></Select>
        <Select name="preferencia_equipo" defaultValue={valor("preferencia_equipo") || "indistinto"}><option value="indistinto">Equipo indistinto</option><option value="maquinas">Prefiero máquinas</option><option value="peso_libre">Prefiero peso libre</option></Select>
      </Card>
      <Card className="space-y-3">
        <p className="text-caption text-text-tertiary">PREFERENCIAS Y ACTIVIDAD</p>
        <Textarea name="actividades_adicionales" defaultValue={valor("actividades_adicionales")} placeholder="Deportes u otras actividades que realizas" rows={2} />
        <Textarea name="ejercicios_preferidos" defaultValue={valor("ejercicios_preferidos")} placeholder="Ejercicios que te gustan" rows={2} />
        <Textarea name="ejercicios_no_deseados" defaultValue={valor("ejercicios_no_deseados")} placeholder="Ejercicios que no te gustan" rows={2} />
      </Card>
      <Card className="space-y-3">
        <p className="text-caption text-text-tertiary">SALUD Y SEGURIDAD</p>
        <p className="text-caption text-text-secondary">Esta información no reemplaza una evaluación médica. Informa cualquier dolor o antecedente para que tu entrenador revise el plan.</p>
        <Textarea name="molestias" defaultValue={valor("molestias")} placeholder="Dolores o molestias actuales" rows={2} />
        <Textarea name="lesiones_diagnosticadas" defaultValue={valor("lesiones_diagnosticadas")} placeholder="Lesiones diagnosticadas" rows={2} />
        <Textarea name="operaciones_previas" defaultValue={valor("operaciones_previas")} placeholder="Operaciones anteriores relevantes" rows={2} />
        <Textarea name="condiciones_medicas" defaultValue={valor("condiciones_medicas")} placeholder="Condiciones médicas relevantes" rows={2} />
        <Textarea name="medicamentos_relevantes" defaultValue={valor("medicamentos_relevantes")} placeholder="Medicamentos que puedan afectar el ejercicio" rows={2} />
        <label className="text-caption flex gap-2 text-text-secondary"><input type="checkbox" name="autorizacion_medica" value="si" defaultChecked={Boolean(datos?.autorizacion_medica)} /> Tengo autorización médica si mi situación la requiere.</label>
        <label className="text-caption flex gap-2 text-text-secondary"><input type="checkbox" name="declaracion_veracidad" value="si" defaultChecked={Boolean(datos?.declaracion_veracidad)} required /> Confirmo que la información es correcta y avisaré si cambia.</label>
      </Card>
      {estado.error && <p className="text-caption text-error">{estado.error}</p>}{estado.ok && <p className="text-caption text-success">Perfil guardado. Tu entrenador ya puede revisarlo.</p>}
      <Button type="submit" loading={pending}>{pending ? "Guardando…" : "Guardar mi perfil de entrenamiento"}</Button>
    </form>
  );
}

