"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Settings, X, UserCog, FileText, Sun, Moon, LogOut, Sparkles, Type, Bot, History, ShieldCheck, PieChart, ClipboardList } from "lucide-react";
import { logout } from "@/app/actions";
import { guardarTemaBoton } from "@/app/alumno/perfil/actions";

type TemaBoton = "espejo" | "vip" | "femenino";
const TEMAS_BOTON: { valor: TemaBoton; texto: string; muestra: string }[] = [
  { valor: "espejo", texto: "Espejo", muestra: "linear-gradient(135deg, #060606, #1d1d20)" },
  { valor: "vip", texto: "VIP", muestra: "linear-gradient(135deg, #ffc247, #ff8a00)" },
  { valor: "femenino", texto: "Lady", muestra: "linear-gradient(135deg, #ff8ac0, #b388ff)" },
];

/*
  Zoom de PANTALLA, no de letra (ver --zoom-pantalla en globals.css).

  Antes esto solo multiplicaba la escala tipográfica: la letra se achicaba y
  las tarjetas quedaban igual de grandes con el texto chico adentro. Alejandro
  lo pidió tres veces — "que achique TODO" — y estos son los cuatro tamaños
  que nombró.

  Escalones cortos a propósito: pasando de 1.15 las tarjetas y la barra de
  abajo se rompen en celulares angostos, y bajando de 0.8 la letra chica deja
  de leerse en un teléfono.
*/
type Escala = 0.8 | 0.9 | 1 | 1.15;
const ESCALAS: { valor: Escala; texto: string; muestra: number }[] = [
  { valor: 1.15, texto: "Grande", muestra: 18 },
  { valor: 1, texto: "Normal", muestra: 15 },
  { valor: 0.9, texto: "Pequeña", muestra: 13 },
  { valor: 0.8, texto: "Más pequeña", muestra: 11 },
];

/**
 * Menú lateral del engranaje (arriba a la derecha, junto a la campanita).
 * Concentra lo que antes andaba suelto por la pantalla: perfil, documentos,
 * tamaño de texto, tema y cerrar sesión.
 *
 * Las noticias salieron de acá: viven en la campanita del encabezado
 * (`CampanaNoticias`), que las muestra en todas las pantallas y con su
 * contador a la vista, en vez de escondidas detrás de dos toques.
 */
export function MenuAlumno({ nombre }: { nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [claro, setClaro] = useState(false);
  const [temaBoton, setTemaBoton] = useState<TemaBoton>("espejo");
  // Valor real de `--escala-texto`, no acotado a los tres tamaños de este
  // menú: el panel de zoom del entrenador (ZoomPanel.tsx) escribe la misma
  // variable y la misma clave de localStorage con su propio rango (75/85/100%).
  // Forzar acá cualquier valor ajeno a "Normal" hacía que este selector
  // mintiera sobre el tamaño real que se estaba viendo (bug encontrado en
  // revisión de código). Con el valor real, si vino del panel del entrenador
  // ninguna de las tres opciones queda marcada — correcto: ninguna es la que
  // está activa.
  const [escala, setEscala] = useState<number>(1);
  const [montado, setMontado] = useState(false);

  // El botón vive dentro de un contenedor con transform (esquina del logo),
  // lo que convierte a ese contenedor en el "containing block" de cualquier
  // `position: fixed` de adentro (regla del spec de CSS) — el panel quedaba
  // anclado al rincón del logo en vez de cubrir la pantalla. Se saca por
  // portal a <body> para que sea realmente fixed al viewport.
  useEffect(() => {
    const id = window.setTimeout(() => setMontado(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // El tema real vive en el <html>; se lee al abrir el panel, que es el único
  // momento en que hace falta.
  const abrir = () => {
    setClaro(document.documentElement.getAttribute("data-theme") === "light");
    const tb = document.documentElement.getAttribute("data-tema-boton");
    setTemaBoton(tb === "vip" || tb === "femenino" ? tb : "espejo");
    const e = parseFloat(
      document.documentElement.style.getPropertyValue("--zoom-pantalla") || "1"
    );
    setEscala(e || 1);
    setAbierto(true);
  };

  const elegirEscala = (valor: Escala) => {
    setEscala(valor);
    document.documentElement.style.setProperty("--zoom-pantalla", String(valor));
    document.documentElement.setAttribute("data-zoom-pantalla", String(valor));
    localStorage.setItem("vip-zoom-pantalla", String(valor));
  };

  const elegirTemaBoton = (tema: TemaBoton) => {
    setTemaBoton(tema);
    if (tema === "espejo") {
      document.documentElement.removeAttribute("data-tema-boton");
    } else {
      document.documentElement.setAttribute("data-tema-boton", tema);
    }
    localStorage.setItem("vip-tema-boton", tema);
    // Además de local (aplica al instante), se guarda en la cuenta — así el
    // alumno recupera su tema al entrar desde otro dispositivo o navegador.
    void guardarTemaBoton(tema);
  };

  // Con el panel abierto no se scrollea el fondo.
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  const alternarTema = () => {
    const nuevoClaro = !claro;
    setClaro(nuevoClaro);
    if (nuevoClaro) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("vip-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("vip-theme", "dark");
    }
  };

  return (
    <>
      {/* Engranaje, no las tres rayitas: dice "configuración", que es lo que
          hay adentro. Copia exacta de la pastilla de CampanaNoticias (mismo
          alto, borde y fondo) para que las dos se lean como un par al lado del
          logo, en vez de un ícono suelto sobre el ámbar. */}
      <button
        onClick={abrir}
        aria-label="Configuración"
        className="radius-control relative flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface text-text-secondary active:scale-95"
      >
        <Settings size={18} />
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              aria-label="Cerrar menú"
              onClick={() => setAbierto(false)}
              className="absolute inset-0 bg-black/70"
            />

            {/* overflow-y-auto: con el texto en "Más grande" y una pantalla
                baja, el panel ya no entra completo de una. */}
            <aside className="relative flex h-full w-72 max-w-[80%] flex-col overflow-y-auto bg-surface p-5">
              <div className="mb-6 flex items-start justify-between gap-2">
                <div>
                  <p className="text-caption text-text-tertiary">SESIÓN DE</p>
                  <p className="text-card-title text-text">{nombre}</p>
                </div>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar menú"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-secondary"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                <ItemMenu
                  href="/alumno/perfil"
                  icon={<UserCog size={20} />}
                  texto="Mi perfil"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/mi-entrenamiento"
                  icon={<ClipboardList size={20} />}
                  texto="Mi entrenamiento y objetivos"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/documentos"
                  icon={<FileText size={20} />}
                  texto="Mis planes"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/macros"
                  icon={<PieChart size={20} />}
                  texto="Macros"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/asistente"
                  icon={<Bot size={20} />}
                  texto="Asistente VIP"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/historial"
                  icon={<History size={20} />}
                  texto="Mi Historial"
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/politica-privacidad"
                  icon={<ShieldCheck size={20} />}
                  texto="Política de uso y privacidad"
                  onNavegar={() => setAbierto(false)}
                />
                <button
                  onClick={alternarTema}
                  className="radius-control flex items-center gap-3 px-3 py-3.5 text-body text-text"
                >
                  <span className="text-vip">{claro ? <Moon size={20} /> : <Sun size={20} />}</span>
                  {claro ? "Tema oscuro" : "Tema claro"}
                </button>
              </nav>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-caption mb-2 flex items-center gap-2 text-text-tertiary">
                  <Type size={16} className="text-vip" /> TAMAÑO DE PANTALLA
                </p>
                {/* Dos por fila y no cuatro: con cuatro columnas "Más pequeña"
                    no entra en el panel de 288 px sin partirse. */}
                <div className="grid grid-cols-2 gap-2">
                  {ESCALAS.map((e) => (
                    <button
                      key={e.valor}
                      onClick={() => elegirEscala(e.valor)}
                      className="radius-control flex flex-col items-center justify-end gap-1 py-2.5 transition-colors duration-200 ease-in-out"
                      style={{
                        background: "var(--color-surface-2)",
                        border:
                          escala === e.valor
                            ? "2px solid var(--color-vip)"
                            : "2px solid transparent",
                        color:
                          escala === e.valor ? "var(--color-text)" : "var(--color-text-secondary)",
                      }}
                    >
                      {/* La "A" de muestra enseña el tamaño relativo de cada
                          opción. Ojo: el zoom de pantalla también la escala,
                          así que muestra la proporción entre las cuatro, no un
                          tamaño absoluto en píxeles. */}
                      <span style={{ fontSize: e.muestra, fontWeight: 700, lineHeight: 1 }}>A</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{e.texto}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="text-caption mb-2 flex items-center gap-2 text-text-tertiary">
                  <Sparkles size={16} className="text-vip" /> TEMA DE BOTONES
                </p>
                <div className="flex gap-2">
                  {TEMAS_BOTON.map((t) => (
                    <button
                      key={t.valor}
                      onClick={() => elegirTemaBoton(t.valor)}
                      className="radius-control flex flex-1 flex-col items-center gap-1.5 py-2.5 text-caption font-medium transition-colors duration-200 ease-in-out"
                      style={{
                        background: "var(--color-surface-2)",
                        border:
                          temaBoton === t.valor
                            ? "2px solid var(--color-vip)"
                            : "2px solid transparent",
                        color:
                          temaBoton === t.valor ? "var(--color-text)" : "var(--color-text-secondary)",
                      }}
                    >
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: t.muestra }}
                      />
                      {t.texto}
                    </button>
                  ))}
                </div>
              </div>

              <form action={logout} className="mt-auto">
                <button
                  type="submit"
                  className="radius-control flex w-full items-center justify-center gap-2 border border-border py-3.5 text-body font-medium text-error"
                >
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </form>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}

function ItemMenu({
  href,
  icon,
  texto,
  onNavegar,
}: {
  href: string;
  icon: React.ReactNode;
  texto: string;
  onNavegar: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavegar}
      className="radius-control flex items-center gap-3 px-3 py-3.5 text-body text-text"
    >
      <span className="text-vip">{icon}</span>
      {texto}
    </Link>
  );
}
