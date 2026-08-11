"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

/**
 * Dictado por voz al lado de un campo de escritura. Pedido del entrenador:
 * escribir observaciones con el pulgar, parado en la sala, es lento.
 *
 * Usa la API de reconocimiento del propio navegador (`SpeechRecognition`), no
 * un servicio nuestro ni de terceros: no hay audio que subir, no hay costo por
 * uso y no hay una clave más que administrar.
 *
 * Aviso que ya se le dio y que este componente respeta: **en iPhone el soporte
 * es irregular**. Por eso el botón NO se dibuja cuando el navegador no lo
 * implementa — antes que un micrófono que al tocarlo no hace nada, ninguno. Y
 * cuando falla en mitad del dictado se dice por qué, en vez de quedarse
 * escuchando en silencio.
 *
 * Lo dictado se AGREGA a lo que ya había escrito, nunca lo reemplaza: perder
 * un párrafo tipeado por hablar encima sería peor que no tener dictado.
 */

/** Tipos mínimos: la API no está en las definiciones estándar de TypeScript. */
type ResultadoReconocimiento = { 0: { transcript: string }; isFinal: boolean };
type EventoReconocimiento = { results: ArrayLike<ResultadoReconocimiento>; resultIndex: number };
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((evento: EventoReconocimiento) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type ConstructorReconocedor = new () => Reconocedor;

function constructorDisponible(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function BotonDictado({
  onTexto,
  className = "",
  etiqueta = "Dictar",
}: {
  /** Recibe el texto reconocido para que el llamador decida dónde agregarlo. */
  onTexto: (texto: string) => void;
  className?: string;
  etiqueta?: string;
}) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconocedor = useRef<Reconocedor | null>(null);

  // Después de montar, no en el render: en el servidor no hay `window` y
  // decidirlo durante la hidratación daría desajuste.
  useEffect(() => {
    // Diferido un tick, igual que ThemeToggle: marcar el estado dentro del
    // cuerpo del efecto encadena un render extra en cada campo de la rutina.
    const id = window.setTimeout(() => setSoportado(constructorDisponible() !== null), 0);
    return () => {
      window.clearTimeout(id);
      reconocedor.current?.stop();
    };
  }, []);

  const alternar = () => {
    if (escuchando) {
      reconocedor.current?.stop();
      return;
    }
    const Constructor = constructorDisponible();
    if (!Constructor) return;

    setError(null);
    const instancia = new Constructor();
    instancia.lang = "es-CL";
    instancia.continuous = false;
    // Solo los resultados finales: los parciales se corrigen solos mientras se
    // habla, y agregarlos al campo dejaría el texto duplicado a medias.
    instancia.interimResults = false;

    instancia.onresult = (evento) => {
      let texto = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        if (resultado.isFinal) texto += resultado[0].transcript;
      }
      if (texto.trim()) onTexto(texto.trim());
    };
    instancia.onerror = (evento) => {
      setError(
        evento.error === "not-allowed"
          ? "Falta el permiso del micrófono."
          : evento.error === "no-speech"
            ? "No se escuchó nada."
            : "El dictado no funcionó en este navegador."
      );
      setEscuchando(false);
    };
    instancia.onend = () => setEscuchando(false);

    try {
      instancia.start();
      reconocedor.current = instancia;
      setEscuchando(true);
    } catch {
      setError("El dictado no funcionó en este navegador.");
    }
  };

  // Sin soporte no se dibuja nada: un micrófono muerto es peor que ninguno.
  if (!soportado) return null;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={alternar}
        aria-label={escuchando ? "Detener el dictado" : etiqueta}
        title={etiqueta}
        className={`grid size-7 shrink-0 place-items-center rounded-full border ${
          escuchando ? "animate-pulse border-error text-error" : "border-border text-text-tertiary"
        } ${className}`}
      >
        {escuchando ? <MicOff size={13} /> : <Mic size={13} />}
      </button>
      {error && <span className="text-[9px] text-text-tertiary">{error}</span>}
    </span>
  );
}
