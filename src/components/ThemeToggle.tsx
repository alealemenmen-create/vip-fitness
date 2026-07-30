"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setClaro(document.documentElement.getAttribute("data-theme") === "light");
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const alternar = () => {
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
    <button
      onClick={alternar}
      aria-label={claro ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary transition-colors duration-200 ease-in-out ${className}`}
    >
      {claro ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
