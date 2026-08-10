"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FichaAlumnoForm } from "@/components/student/FichaAlumnoForm";
import { guardarFichaDeAlumno } from "@/app/admin/alumnos/fichaActions";
import { camposFaltantes, type FichaAlumno } from "@/lib/perfil-alumno/ficha";

/** La ficha del alumno, editable por el entrenador desde el panel.
 *
 * Colapsada por defecto: en el perfil del alumno ya hay mucho encima (peso,
 * fotos, historial, comidas), y esto se abre cuando hace falta llenarla o
 * corregirla. La cabecera dice de una si falta algo, para no tener que
 * desplegarla solo para averiguarlo. */
export function FichaAlumnoAdmin({
  alumnoId,
  nombre,
  ficha,
}: {
  alumnoId: string;
  nombre: string;
  ficha: FichaAlumno;
}) {
  const [abierta, setAbierta] = useState(false);
  const faltantes = camposFaltantes(ficha);
  const accion = guardarFichaDeAlumno.bind(null, alumnoId);

  return (
    <Card padding="p-0" className={`overflow-hidden ${faltantes.length > 0 ? "border-l-2 border-warning" : ""}`}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        <ClipboardList size={17} className="mt-0.5 shrink-0 text-text-tertiary" />
        <div className="min-w-0 flex-1">
          <p className="text-secondary font-medium text-text">Ficha de entrenamiento</p>
          <p className="text-micro text-text-tertiary">
            {faltantes.length === 0
              ? "Completa. El generador y la revisión de IA la están usando."
              : `Falta: ${faltantes.join(", ")}`}
          </p>
        </div>
        {abierta ? (
          <ChevronUp size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        )}
      </button>

      {abierta && (
        <div className="border-t border-border p-3">
          <FichaAlumnoForm ficha={ficha} accion={accion} modo="admin" nombreAlumno={nombre} />
        </div>
      )}
    </Card>
  );
}
