"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X, UserCog, FileText, Sun, Moon, LogOut, Newspaper, Sparkles } from "lucide-react";
import { logout } from "@/app/actions";
import { guardarTemaBoton } from "@/app/alumno/perfil/actions";

type TemaBoton = "espejo" | "vip" | "femenino";
const TEMAS_BOTON: { valor: TemaBoton; texto: string; muestra: string }[] = [
  { valor: "espejo", texto: "Espejo", muestra: "linear-gradient(135deg, #060606, #1d1d20)" },
  { valor: "vip", texto: "VIP", muestra: "linear-gradient(135deg, #ffc247, #ff8a00)" },
  { valor: "femenino", texto: "Lady", muestra: "linear-gradient(135deg, #ff8ac0, #b388ff)" },
];

/** Menú lateral de las tres rayitas (arriba a la derecha). Concentra lo que
 * antes andaba suelto por la pantalla: perfil, documentos, tema y cerrar
 * sesión. */
/** Globito rojo con el número de novedades, estilo WhatsApp. A partir de 100
 * muestra "99+" para no deformar el círculo. */
function Globito({ cantidad, className }: { cantidad: number; className: string }) {
  return (
    <span
      aria-label={`${cantidad} novedades sin ver`}
      className={`flex min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white tabular-nums ${className}`}
      style={{ height: 16 }}
    >
      {cantidad > 99 ? "99+" : cantidad}
    </span>
  );
}

export function MenuAlumno({
  nombre,
  noticiasSinVer = 0,
}: {
  nombre: string;
  noticiasSinVer?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [claro, setClaro] = useState(false);
  const [temaBoton, setTemaBoton] = useState<TemaBoton>("espejo");
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
    setAbierto(true);
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
      {/* Va dentro de la placa dorada del logo: sin fondo propio, rayitas
          blancas sobre el ámbar. */}
      <button
        onClick={abrir}
        aria-label="Abrir menú"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center text-white"
      >
        <Menu size={28} strokeWidth={2.75} />
        {noticiasSinVer > 0 && (
          <Globito cantidad={noticiasSinVer} className="absolute -right-0.5 -top-0.5 border border-black" />
        )}
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

            <aside className="relative flex h-full w-72 max-w-[80%] flex-col bg-surface p-5">
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
                  href="/alumno/noticias"
                  icon={<Newspaper size={20} />}
                  texto="Noticias VIP"
                  sinVer={noticiasSinVer}
                  onNavegar={() => setAbierto(false)}
                />
                <ItemMenu
                  href="/alumno/documentos"
                  icon={<FileText size={20} />}
                  texto="Mis documentos"
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
  sinVer = 0,
  onNavegar,
}: {
  href: string;
  icon: React.ReactNode;
  texto: string;
  sinVer?: number;
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
      {sinVer > 0 && <Globito cantidad={sinVer} className="ml-auto" />}
    </Link>
  );
}
