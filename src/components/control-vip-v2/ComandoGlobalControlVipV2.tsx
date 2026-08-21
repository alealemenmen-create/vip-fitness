"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, X } from "lucide-react";
import { DESTINOS_CONTROL_VIP_V2 } from "@/lib/control-vip-v2/destinos";

type AlumnoBasico = { id: string; nombre: string };

/** Sin acentos y en minúsculas — mismo criterio que `DirectorioPanel.tsx`. */
function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type Resultado = { id: string; label: string; detalle: string; href: string };

/**
 * Comando global de Control VIP V2 (doc §5.3). No hay ningún precedente en
 * el código (`cmdk` no está instalado): se arma a mano sobre los índices que
 * ya existen — destinos del panel nuevo y la lista liviana de alumnos — tal
 * como recomienda el propio documento ("no necesita un motor de búsqueda
 * externo" en su primera versión).
 */
export function ComandoGlobalControlVipV2({ alumnos }: { alumnos: AlumnoBasico[] }) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function cerrar() {
    setAbierto(false);
    setConsulta("");
  }

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      const esAtajo = (evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k";
      if (esAtajo) {
        evento.preventDefault();
        setAbierto((v) => !v);
      } else if (evento.key === "Escape") {
        cerrar();
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // Solo enfoca el campo al abrir — no toca estado, así que no dispara
  // renders en cascada (la limpieza de `consulta` vive en `cerrar()`).
  useEffect(() => {
    if (!abierto) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [abierto]);

  const resultados = useMemo<Resultado[]>(() => {
    const buscado = normalizar(consulta.trim());
    const destinos: Resultado[] = DESTINOS_CONTROL_VIP_V2.map((d) => ({
      id: `destino-${d.href}`,
      label: d.label,
      detalle: d.detalle,
      href: d.href,
    }));
    const alumnosResultado: Resultado[] = alumnos.map((a) => ({
      id: `alumno-${a.id}`,
      label: a.nombre,
      detalle: "Alumno",
      href: `/control-vip/alumnos/${a.id}`,
    }));

    const todo = [...destinos, ...alumnosResultado];
    if (!buscado) return destinos.slice(0, 8);
    return todo.filter((r) => normalizar(`${r.label} ${r.detalle}`).includes(buscado)).slice(0, 20);
  }, [alumnos, consulta]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={cerrar}
    >
      <div
        className="tarjeta-panel w-full max-w-lg overflow-hidden !p-0"
        role="dialog"
        aria-modal="true"
        aria-label="Comando global"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar un alumno, una herramienta…"
            className="buscador-panel !rounded-none !border-none !pl-9 !pr-9"
            aria-label="Buscar"
          />
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-text-tertiary hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {resultados.length === 0 ? (
            <p className="p-3 text-caption text-text-secondary">Nada con ese nombre.</p>
          ) : (
            resultados.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  cerrar();
                  router.push(r.href);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-vip/10 text-vip">
                  <User size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-medium text-text">{r.label}</span>
                  <span className="block truncate text-micro text-text-tertiary">{r.detalle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
