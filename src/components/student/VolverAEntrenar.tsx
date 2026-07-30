"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function VolverAEntrenar({ titulo }: { titulo: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/alumno/entrenar")}
      className="flex w-full min-w-0 items-center gap-2 text-left"
      aria-label="Volver a entrenar"
    >
      <ArrowLeft size={20} className="shrink-0 text-text-secondary" />
      <span className="text-h3 truncate text-text">{titulo}</span>
    </button>
  );
}
