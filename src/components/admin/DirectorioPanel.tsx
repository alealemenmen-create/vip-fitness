"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { gruposDestinosParaRol } from "@/lib/admin/destinos";

/** Sin acentos y en minúsculas: "auditoria" tiene que encontrar "Auditoría". */
function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Directorio completo del panel (instructivo §4.3).
 *
 * Todos los destinos, incluidos los que ya tienen pestaña propia abajo. La
 * barra inferior ofrece velocidad; esto ofrece completitud, y es la razón por
 * la que el entrenador ya no necesita girar el teléfono para encontrar
 * Errores reportados o Pedidos de borrado.
 *
 * `contadores` viene del servidor con lo que de verdad hay pendiente. Se
 * dibuja solo cuando es mayor que cero: un cero en cada fila vuelve a
 * convertir el contador en decoración.
 */
export function DirectorioPanel({
  rol,
  contadores = {},
}: {
  rol: "entrenador" | "admin";
  contadores?: Record<string, number>;
}) {
  const [consulta, setConsulta] = useState("");

  const grupos = useMemo(() => {
    const disponibles = gruposDestinosParaRol(rol);
    const buscado = normalizar(consulta.trim());
    if (!buscado) return disponibles;
    return disponibles.map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) =>
        normalizar(`${item.label} ${item.detalle} ${grupo.label}`).includes(buscado)
      ),
    })).filter((grupo) => grupo.items.length > 0);
  }, [consulta, rol]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          aria-hidden
        />
        <input
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          className="buscador-panel !pl-9"
          placeholder="¿Qué necesitas hacer?"
          aria-label="Buscar una herramienta del panel"
        />
      </div>

      {grupos.length === 0 ? (
        <p className="tarjeta-panel text-caption text-text-secondary">
          No hay ninguna herramienta que se llame así. Prueba con «rutina», «foto», «puntos» o «alumno».
        </p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.label} className="tarjeta-menu-panel">
            <h2 className="tarjeta-menu-panel-titulo">{grupo.label}</h2>
            {grupo.items.map((item) => {
              const Icon = item.icon;
              const esperando = contadores[item.seccion] ?? 0;
              return (
                <Link key={item.href} href={item.href} className="item-menu-panel">
                  <span className="item-menu-panel-icono" aria-hidden>
                    <Icon size={15} />
                  </span>
                  <span className="item-menu-panel-texto">
                    <strong>{item.label}</strong>
                    <span>{item.detalle}</span>
                  </span>
                  {esperando > 0 ? (
                    <span className="item-menu-panel-contador">{esperando > 99 ? "99+" : esperando}</span>
                  ) : (
                    <ChevronRight size={16} className="text-text-tertiary" aria-hidden />
                  )}
                </Link>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
