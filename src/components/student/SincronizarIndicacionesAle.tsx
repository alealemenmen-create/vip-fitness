"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarFirmaIntervenciones } from "@/app/alumno/entrenar/impulso-actions";

export function SincronizarIndicacionesAle({ sesionId, firmaInicial }: { sesionId: string; firmaInicial: string }) {
  const router = useRouter();
  const firma = useRef(firmaInicial);
  const [, iniciar] = useTransition();
  useEffect(() => {
    let activo = true;
    const consultar = () => iniciar(async () => {
      const nueva = await consultarFirmaIntervenciones(sesionId).catch(() => firma.current);
      if (!activo || nueva === firma.current) return;
      firma.current = nueva;
      router.refresh();
    });
    const id = window.setInterval(consultar, 8_000);
    return () => { activo = false; window.clearInterval(id); };
  }, [router, sesionId]);
  return null;
}
