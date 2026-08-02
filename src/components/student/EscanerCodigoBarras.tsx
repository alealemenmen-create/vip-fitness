"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importarAlimentoOFF, buscarPorCodigoOFFAction } from "@/app/alumno/comer/actions";
import type { AlimentoCatalogo } from "@/app/alumno/comer/tipos";
import type { ProductoOFF } from "@/lib/alimentos/openFoodFacts";
import { BarcodeFormat, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";

type EstadoCamara = "iniciando" | "activa" | "denegada" | "no_soportada";

// Los productos chilenos de supermercado casi siempre traen EAN-13; se suman
// EAN-8/UPC por si el envase trae un formato corto.
const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e"];

interface DeteccionNativa {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(fuente: HTMLVideoElement): Promise<DeteccionNativa[]>;
}
interface BarcodeDetectorConstructor {
  new (opciones?: { formats?: string[] }): BarcodeDetectorLike;
}

function crearLectorZxing(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  return new BrowserMultiFormatReader(hints);
}

function detenerStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Escanea el código de barras del envase con la cámara trasera, en vivo (sin
 * foto manual). Usa el detector nativo del navegador cuando existe, y si no
 * cae a @zxing/browser. Vive dentro del panel `HojaAgregarComida`, como una
 * vista más junto al buscador de texto y "Crear alimento personalizado".
 */
export function EscanerCodigoBarras({
  onEncontrado,
  onNoEncontrado,
  onVolverATexto,
}: {
  /** El producto ya quedó copiado al catálogo: listo para elegir cantidad. */
  onEncontrado: (alimento: AlimentoCatalogo) => void;
  /** El código no está en Open Food Facts (o la consulta falló): se pasa al
   * formulario de alimento personalizado con el código precargado. */
  onNoEncontrado: (codigo: string) => void;
  onVolverATexto: () => void;
}) {
  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>("iniciando");
  const [reinicio, setReinicio] = useState(0);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [cargandoProducto, setCargandoProducto] = useState(false);
  const [producto, setProducto] = useState<ProductoOFF | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [errorProducto, setErrorProducto] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [errorImportar, setErrorImportar] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamNativoRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const codigoDetectadoRef = useRef<string | null>(null);

  const buscarProducto = async (c: string) => {
    setCargandoProducto(true);
    setErrorProducto(null);
    setNoEncontrado(false);
    const resultado = await buscarPorCodigoOFFAction(c);
    setCargandoProducto(false);
    if (!resultado.ok) {
      setErrorProducto(resultado.error);
      setNoEncontrado(true);
      return;
    }
    if (!resultado.producto) {
      setNoEncontrado(true);
      return;
    }
    setProducto(resultado.producto);
  };

  useEffect(() => {
    let activo = true;
    codigoDetectadoRef.current = null;

    const manejarDeteccion = (valor: string) => {
      if (!activo || codigoDetectadoRef.current) return;
      codigoDetectadoRef.current = valor;
      setCodigo(valor);
      buscarProducto(valor);
      // Se corta el escaneo apenas hay un código: seguir leyendo mientras se
      // muestra el resultado solo confunde (vuelve a disparar el mismo código).
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      detenerStream(streamNativoRef.current);
      streamNativoRef.current = null;
    };

    async function iniciarNativo(deteccion: BarcodeDetectorConstructor) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!activo) {
        detenerStream(stream);
        return;
      }
      streamNativoRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      const detector = new deteccion({ formats: FORMATOS });
      const loop = async () => {
        if (!activo || !videoRef.current) return;
        try {
          const detecciones = await detector.detect(videoRef.current);
          if (detecciones.length > 0) {
            manejarDeteccion(detecciones[0].rawValue);
            return;
          }
        } catch {
          // El video puede no tener un frame listo todavía; se reintenta.
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      setEstadoCamara("activa");
      rafRef.current = requestAnimationFrame(loop);
    }

    async function iniciarZxing() {
      const lector = crearLectorZxing();
      const controls = await lector.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current ?? undefined,
        (resultado) => {
          if (resultado) manejarDeteccion(resultado.getText());
        }
      );
      if (!activo) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setEstadoCamara("activa");
    }

    async function iniciar() {
      if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        if (activo) setEstadoCamara("no_soportada");
        return;
      }
      try {
        const Deteccion = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (Deteccion) {
          await iniciarNativo(Deteccion);
        } else {
          await iniciarZxing();
        }
      } catch (err) {
        if (!activo) return;
        const nombre = err instanceof Error ? err.name : "";
        setEstadoCamara(nombre === "NotAllowedError" || nombre === "PermissionDeniedError" ? "denegada" : "no_soportada");
      }
    }

    iniciar();

    return () => {
      activo = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      detenerStream(streamNativoRef.current);
      streamNativoRef.current = null;
    };
  }, [reinicio]);

  const escanearOtro = () => {
    setCodigo(null);
    setProducto(null);
    setNoEncontrado(false);
    setErrorProducto(null);
    setErrorImportar(null);
    setEstadoCamara("iniciando");
    setReinicio((n) => n + 1);
  };

  const usarProducto = async () => {
    if (!producto) return;
    setImportando(true);
    setErrorImportar(null);
    const resultado = await importarAlimentoOFF({
      offId: producto.offId,
      nombre: producto.nombre,
      marca: producto.marca,
      kcal: producto.kcal,
      prot: producto.prot,
      carb: producto.carb,
      grasa: producto.grasa,
      fibra: producto.fibra,
      azucares: producto.azucares,
      sodio: producto.sodio,
      medidaNombre: producto.medidaNombre,
      medidaGramos: producto.medidaGramos,
      imagenUrl: producto.imagenUrl,
    });
    setImportando(false);
    if (!resultado.alimento) {
      setErrorImportar(resultado.error ?? "No fue posible agregar este producto.");
      return;
    }
    onEncontrado(resultado.alimento);
  };

  return (
    <div className="space-y-3">
      {(estadoCamara === "iniciando" || estadoCamara === "activa") && !codigo && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" className="aspect-[4/3] w-full object-cover" />
          <p className="text-caption absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-white">
            {estadoCamara === "iniciando" ? "Abriendo la cámara…" : "Apunta al código de barras"}
          </p>
        </div>
      )}

      {estadoCamara === "denegada" && (
        <div className="radius-control space-y-2 border border-border p-3">
          <p className="text-caption text-text-tertiary">
            No se pudo acceder a la cámara. Revisa los permisos del navegador para VIP Fitness e intenta de nuevo.
          </p>
          <Button variant="secondary" size="sm" onClick={onVolverATexto} className="w-full">
            Buscar por texto
          </Button>
        </div>
      )}

      {estadoCamara === "no_soportada" && (
        <div className="radius-control space-y-2 border border-border p-3">
          <p className="text-caption text-text-tertiary">
            Este navegador no permite escanear códigos acá. Prueba desde el celular o busca por texto.
          </p>
          <Button variant="secondary" size="sm" onClick={onVolverATexto} className="w-full">
            Buscar por texto
          </Button>
        </div>
      )}

      {codigo && cargandoProducto && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando el código {codigo}…</p>
      )}

      {producto && !cargandoProducto && (
        <div className="radius-control space-y-3 border border-border p-3">
          <div className="flex items-center gap-2">
            {producto.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={producto.imagenUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface">
                <ImageOff size={16} className="text-text-tertiary" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-secondary truncate text-text">
                {producto.nombre}
                {producto.marca && <span className="text-text-tertiary"> · {producto.marca}</span>}
              </p>
              <p className="text-caption text-text-tertiary">por 100 g</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-secondary text-text">{Math.round(producto.kcal)}</p>
              <p className="text-caption text-text-tertiary">kcal</p>
            </div>
            <div>
              <p className="text-secondary text-text">{Math.round(producto.prot)} g</p>
              <p className="text-caption text-text-tertiary">Prot</p>
            </div>
            <div>
              <p className="text-secondary text-text">{Math.round(producto.carb)} g</p>
              <p className="text-caption text-text-tertiary">Carb</p>
            </div>
            <div>
              <p className="text-secondary text-text">{Math.round(producto.grasa)} g</p>
              <p className="text-caption text-text-tertiary">Grasa</p>
            </div>
          </div>
          {producto.azucares !== null && (
            <p className="text-caption text-text-tertiary">Azúcares: {Math.round(producto.azucares)} g / 100 g</p>
          )}

          {errorImportar && <p className="text-caption text-error">{errorImportar}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" loading={importando} onClick={usarProducto}>
              {importando ? "Agregando…" : "Usar este producto"}
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={escanearOtro}>
              Escanear otro
            </Button>
          </div>
        </div>
      )}

      {noEncontrado && codigo && (
        <div className="radius-control space-y-3 border border-border p-3">
          <p className="text-caption text-text-tertiary">
            {errorProducto
              ? `${errorProducto} Puedes crear el alimento a mano con el código igual.`
              : "Ese código no está en Open Food Facts. Puedes crearlo a mano — queda guardado para la próxima vez."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onNoEncontrado(codigo)}>
              Crear alimento con este código
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={escanearOtro}>
              Escanear otro
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
