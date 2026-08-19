"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SincronizarIndicacionesAle({
  sesionId,
  sesionEjercicioIds,
  firmaInicial,
}: {
  sesionId: string;
  sesionEjercicioIds: string[];
  firmaInicial: string;
}) {
  const router = useRouter();
  const firma = useRef(firmaInicial);
  const [, iniciar] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const idsFirma = sesionEjercicioIds.join(",");

  useEffect(() => {
    let activo = true;
    const ids = idsFirma.split(",").filter(Boolean);
    const idsSet = new Set(ids);
    if (ids.length === 0) return;

    // La consulta va directo del navegador a Supabase. Antes llamaba una
    // Server Action de Vercel cada 8 segundos: una sola sesión abierta podía
    // producir cientos de invocaciones por hora aunque nada hubiera cambiado.
    const consultar = () => iniciar(async () => {
      if (document.hidden) return;
      const { data, error } = await supabase
        .from("impulso_vip_intervenciones")
        .select("id, origen, instruccion, estado")
        .in("sesion_ejercicio_id", ids)
        .order("id");
      if (error) return;
      const nueva = JSON.stringify(data ?? []);
      if (!activo || nueva === firma.current) return;
      firma.current = nueva;
      router.refresh();
    });

    // Realtime entrega la indicación en el momento sin pasar por Vercel. El
    // chequeo cada dos minutos es sólo una red de seguridad si el canal se
    // interrumpe; también corre al volver a la aplicación.
    const canal = supabase
      .channel(`impulso-alumno-${sesionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "impulso_vip_intervenciones" },
        (evento) => {
          const nueva = evento.new as { sesion_ejercicio_id?: string };
          const anterior = evento.old as { sesion_ejercicio_id?: string };
          if (idsSet.has(nueva.sesion_ejercicio_id ?? "") || idsSet.has(anterior.sesion_ejercicio_id ?? "")) consultar();
        },
      )
      .subscribe();
    const intervalo = window.setInterval(consultar, 120_000);
    const alVolver = () => { if (!document.hidden) consultar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      void supabase.removeChannel(canal);
    };
  }, [idsFirma, router, sesionId, supabase]);
  return null;
}
