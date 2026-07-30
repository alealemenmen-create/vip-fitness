import { Card } from "@/components/ui/Card";
import { calcularEdad } from "@/lib/date";
import type { DatosPersonales } from "@/app/alumno/perfil/data";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <p className="text-caption text-text-tertiary">{etiqueta}</p>
      <p className="text-body text-text">{valor || "Sin registrar"}</p>
    </div>
  );
}

export function DatosPersonalesSoloLectura({ datos }: { datos: DatosPersonales }) {
  const edad = datos.fechaNacimiento ? `${calcularEdad(datos.fechaNacimiento)} años` : null;

  return (
    <Card>
      <p className="text-caption mb-3 text-text-tertiary">DATOS PERSONALES</p>
      <div className="grid grid-cols-2 gap-4">
        <Dato etiqueta="EDAD" valor={edad} />
        <Dato etiqueta="ESTATURA" valor={datos.estaturaCm ? `${datos.estaturaCm} cm` : null} />
      </div>
      <div className="mt-4 space-y-3">
        <Dato etiqueta="CONDICIÓN MÉDICA" valor={datos.condicionMedica} />
        <Dato etiqueta="CONDICIÓN ALIMENTICIA / ALERGIAS" valor={datos.restriccionAlimenticia} />
      </div>
    </Card>
  );
}
