"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * El botón que cierra la sesión, con estado de "guardando".
 *
 * Reportado con un alumno real: tocaba "Confirmar +300 pts" y el botón
 * "se quedaba pegado". No estaba colgado — `finalizarSesion` escribe la
 * sesión, calcula los Puntos VIP, resuelve el bono de Impulso y rehace el
 * ranking, y con el wifi del gimnasio eso puede tardar varios segundos. Lo
 * que faltaba era decirlo: el botón se quedaba idéntico, sin girar ni
 * apagarse, así que la única lectura posible era que no había funcionado.
 *
 * `useFormStatus` tiene que leerse desde un hijo del <form>, no desde el
 * componente que lo declara — por eso vive en su propio archivo y no inline.
 * De paso queda deshabilitado mientras envía, así diez toques nerviosos no
 * disparan diez peticiones.
 */
export function BotonFinalizarSesion({
  children,
  variant = "primary",
  size = "sm",
  className = "",
  textoEnviando = "Guardando…",
}: {
  children: React.ReactNode;
  variant?: "primary" | "accion";
  size?: "sm" | "lg";
  className?: string;
  textoEnviando?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      disabled={pending}
    >
      {pending ? textoEnviando : children}
    </Button>
  );
}
