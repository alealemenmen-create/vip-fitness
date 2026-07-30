import { Card } from "@/components/ui/Card";
import { NombreEditable } from "./NombreEditable";
import { EliminarPerfilBoton } from "./EliminarPerfilBoton";
import { eliminarEntrenador } from "@/app/admin/alumnos/actions";

export type EntrenadorFila = { id: string; nombre: string };

export function ListaEntrenadores({
  entrenadores,
  sesionUserId,
}: {
  entrenadores: EntrenadorFila[];
  sesionUserId: string;
}) {
  if (entrenadores.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <p className="text-caption text-text-tertiary">ENTRENADORES</p>
      <div className="space-y-3">
        {entrenadores.map((entrenador) => (
          <div key={entrenador.id} className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
            <NombreEditable perfilId={entrenador.id} nombre={entrenador.nombre} />
            {entrenador.id === sesionUserId ? (
              <span className="text-caption text-text-tertiary">Tú</span>
            ) : (
              <EliminarPerfilBoton
                accion={eliminarEntrenador}
                campoId="entrenador_id"
                valorId={entrenador.id}
                etiqueta="Eliminar"
                advertencia={`Esto elimina el acceso de ${entrenador.nombre} como entrenador y sus notas. No se puede deshacer.`}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
