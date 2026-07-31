import { FileText, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatFechaCorta } from "@/lib/date";
import type { Documento } from "@/app/alumno/documentos/data";

const TIPO_LABEL: Record<Documento["tipo"], string> = {
  rutina: "Rutina de entrenamiento",
  alimentacion: "Plan de alimentación",
  // 0027: para lo que el entrenador sube y no es ninguna de las dos cosas
  // (una pauta de estiramientos, una autorización médica, etc.).
  otro: "Otros documentos",
};

const ORDEN_TIPOS: Documento["tipo"][] = ["rutina", "alimentacion", "otro"];

export function ListaDocumentos({
  documentos,
  mensajeVacio = "Tu entrenador todavía no ha subido documentos.",
}: {
  documentos: Documento[];
  mensajeVacio?: string;
}) {
  if (documentos.length === 0) {
    return (
      <Card>
        <p className="text-body text-text-secondary">{mensajeVacio}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {ORDEN_TIPOS.map((tipo) => {
        const items = documentos.filter((d) => d.tipo === tipo);
        if (items.length === 0) return null;

        return (
          <div key={tipo} className="space-y-2">
            <p className="text-caption text-text-tertiary">{TIPO_LABEL[tipo].toUpperCase()}</p>
            <div className="space-y-2">
              {items.map((d) => (
                <a
                  key={d.id}
                  href={d.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block ${!d.url ? "pointer-events-none opacity-50" : ""}`}
                >
                  <Card className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      <FileText size={20} className="text-vip" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body truncate text-text">{d.nombreArchivo}</p>
                      <p className="text-caption text-text-tertiary">
                        {formatFechaCorta(d.fechaAsignacion)}
                      </p>
                    </div>
                    <Download size={18} className="text-text-tertiary" />
                  </Card>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
