import { requireRol } from "@/lib/auth";
import { obtenerBibliotecaSinCache } from "@/lib/ejercicios/data";
import { GaleriaEjercicios } from "@/components/admin/GaleriaEjercicios";
import { TituloPestana } from "@/components/admin/TituloPestana";

export default async function EjerciciosAdminPage() {
  await requireRol(["entrenador", "admin"]);
  // Sin caché a propósito — ver `obtenerBibliotecaSinCache`: esta es la
  // pantalla donde el entrenador acaba de subir una foto y tiene que verla.
  const biblioteca = await obtenerBibliotecaSinCache();

  return (
    <div className="space-y-4 pb-4">
      <TituloPestana>
        <p className="text-caption text-text-tertiary">GALERÍA</p>
        <h1 className="text-h2 text-text">Fotos de ejercicios</h1>
      </TituloPestana>
      <p className="text-secondary text-text-secondary">
        Toca la foto de cualquier ejercicio para subir una nueva o cambiar la que tiene. Se publica
        para los alumnos al instante.
      </p>
      <GaleriaEjercicios ejercicios={biblioteca} />
    </div>
  );
}
