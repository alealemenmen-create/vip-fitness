import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { calcularEdad } from "@/lib/date";
import { etiquetaSexo } from "@/lib/solicitudes/campos";
import type { DatosPersonales } from "@/app/alumno/perfil/data";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <p className="text-[9px] text-text-tertiary">{etiqueta}</p>
      <p className="text-caption text-text">{valor || "Sin registrar"}</p>
    </div>
  );
}

export function DatosPersonalesSoloLectura({ datos }: { datos: DatosPersonales }) {
  const edad = datos.fechaNacimiento ? `${calcularEdad(datos.fechaNacimiento)} años` : null;

  return (
    <Card padding="p-2">
      <p className="text-[10px] mb-1 text-text-tertiary">DATOS PERSONALES</p>
      <div className="grid grid-cols-2 gap-2">
        <Dato etiqueta="EDAD" valor={edad} />
        <Dato etiqueta="ESTATURA" valor={datos.estaturaCm ? `${datos.estaturaCm} cm` : null} />
        <Dato etiqueta="SEXO" valor={etiquetaSexo(datos.sexo)} />
        <div>
          <p className="text-[9px] text-text-tertiary">TELÉFONO</p>
          {datos.telefono ? (
            // Enlace a WhatsApp: es como el entrenador se comunica con los
            // alumnos, y el número llega desde el registro sin formato fijo,
            // así que se le sacan los símbolos para armar el wa.me.
            <a
              href={`https://wa.me/${datos.telefono.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption flex items-center gap-1 text-success"
            >
              {datos.telefono}
              <MessageCircle size={11} />
            </a>
          ) : (
            <p className="text-caption text-text">Sin registrar</p>
          )}
        </div>
      </div>
      <div className="mt-1.5 space-y-1">
        <Dato etiqueta="CONDICIÓN MÉDICA" valor={datos.condicionMedica} />
        <Dato etiqueta="CONDICIÓN ALIMENTICIA / ALERGIAS" valor={datos.restriccionAlimenticia} />
      </div>
    </Card>
  );
}
