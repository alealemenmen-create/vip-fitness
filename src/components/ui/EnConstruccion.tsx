import { Card } from "@/components/ui/Card";

export function EnConstruccion({ titulo, etapa }: { titulo: string; etapa: string }) {
  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-h2 text-text">{titulo}</h1>
      <Card>
        <p className="text-body text-text-secondary">
          Esta sección se construye en la {etapa}, según el plan de trabajo por etapas. Por ahora
          no hay datos ni acciones disponibles aquí.
        </p>
      </Card>
    </div>
  );
}
