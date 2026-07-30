import { Card } from "@/components/ui/Card";
import type { FotoProgreso } from "@/app/alumno/progreso/data";

function Espacio({ etiqueta, foto }: { etiqueta: string; foto?: FotoProgreso }) {
  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">{etiqueta.toUpperCase()}</p>
      <div className="radius-card relative aspect-square overflow-hidden">
        {foto?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt={etiqueta} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <p className="text-caption text-text-tertiary">Sin foto</p>
          </div>
        )}
        {foto && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2">
            <p className="text-caption text-center text-text">{foto.fechaFoto}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function FotosSoloLectura({ fotos }: { fotos: FotoProgreso[] }) {
  const primera = fotos[0];
  const actual = fotos.length > 1 ? fotos[fotos.length - 1] : undefined;

  return (
    <Card>
      <p className="text-caption mb-3 text-text-tertiary">GALERÍA DE PROGRESO</p>
      <div className="grid grid-cols-2 gap-3">
        <Espacio etiqueta="Primera foto" foto={primera} />
        <Espacio etiqueta="Foto actual" foto={actual} />
      </div>
    </Card>
  );
}
