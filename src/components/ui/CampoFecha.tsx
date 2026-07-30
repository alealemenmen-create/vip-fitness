"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { FIELD_BASE } from "./Input";

/**
 * Campo de fecha con calendario.
 *
 * `<input type="date">` a secas se ve distinto al resto de los campos en el
 * teléfono: el navegador le impone su propio ancho y alto, así que quedaba más
 * chico y desalineado contra los demás recuadros del perfil. Acá se le saca esa
 * apariencia nativa (`appearance-none` + alto fijo) y se le pone un botón de
 * calendario propio que abre el selector del sistema, para no tener que
 * escribir la fecha a mano.
 */
export function CampoFecha({
  name,
  defaultValue,
  id,
}: {
  name: string;
  defaultValue?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const abrirCalendario = () => {
    const el = ref.current;
    if (!el) return;
    // showPicker() no existe en todos los navegadores y solo funciona desde un
    // gesto del usuario; si falla, el foco alcanza para que se abra igual.
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        name={name}
        type="date"
        defaultValue={defaultValue}
        onClick={abrirCalendario}
        className={`${FIELD_BASE} block h-12 appearance-none pr-12 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left`}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        aria-label="Abrir calendario"
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-vip"
      >
        <CalendarDays size={20} />
      </button>
    </div>
  );
}
