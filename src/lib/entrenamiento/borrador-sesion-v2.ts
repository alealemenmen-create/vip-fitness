export type SerieBorradorSesionV2 = {
  reps: string;
  peso: string;
  completada: boolean;
};

export type RegistroBorradorSesionV2 = Record<string, SerieBorradorSesionV2[]>;

export type BorradorSesionV2 = {
  version: 1;
  sesionId: string;
  actualizadoEn: number;
  registro: RegistroBorradorSesionV2;
  notas: Record<string, string>;
  segundosSesion: number;
  ejercicioActivoId: string;
  serieActivaIndice: number;
  unidadPeso: "kg" | "lb";
  pasosTecnica: Record<string, number>;
  pausaTecnica: { clave: string; segundos: number; pasoSiguiente: number } | null;
};

type RestaurarBorradorInput = {
  sesionId: string;
  registroBase: RegistroBorradorSesionV2;
  notasBase: Record<string, string>;
  ahora?: number;
};

const VERSION = 1;
const VIGENCIA_MAXIMA_MS = 48 * 60 * 60 * 1000;

export function claveBorradorSesionV2(sesionId: string) {
  return `vip-v2-sesion-borrador:${sesionId}`;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoSeguro(valor: unknown, maximo: number) {
  return typeof valor === "string" && valor.length <= maximo ? valor : "";
}

function serieSegura(valor: unknown): SerieBorradorSesionV2 | null {
  if (!esObjeto(valor) || typeof valor.completada !== "boolean") return null;
  const reps = textoSeguro(valor.reps, 20);
  const peso = textoSeguro(valor.peso, 20);
  if (valor.reps !== reps || valor.peso !== peso) return null;
  return { reps, peso, completada: valor.completada };
}

function pesoServidorEnUnidad(valor: string, unidad: "kg" | "lb") {
  if (unidad === "kg" || valor.trim() === "") return valor;
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero)) return valor;
  return String(Math.round(numero * 2.20462 * 10) / 10);
}

function posicionTecnicaValida(clave: string, registro: RegistroBorradorSesionV2) {
  for (const [ejercicioId, series] of Object.entries(registro)) {
    const prefijo = `${ejercicioId}-`;
    if (!clave.startsWith(prefijo)) continue;
    const indice = Number(clave.slice(prefijo.length));
    return Number.isInteger(indice) && indice >= 0 && indice < series.length && !series[indice].completada;
  }
  return false;
}

/**
 * Recupera únicamente un borrador reciente de la misma sesión y con la misma
 * geometría de ejercicios. Las series ya confirmadas por el servidor siempre
 * ganan sobre una copia local antigua; el borrador completa sólo lo que todavía
 * no llegó a guardarse.
 */
export function restaurarBorradorSesionV2(
  crudo: string | null,
  input: RestaurarBorradorInput,
): BorradorSesionV2 | null {
  if (!crudo) return null;

  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!esObjeto(valor)) return null;
  if (valor.version !== VERSION || valor.sesionId !== input.sesionId) return null;

  const actualizadoEn = Number(valor.actualizadoEn);
  const ahora = input.ahora ?? Date.now();
  if (!Number.isFinite(actualizadoEn) || actualizadoEn > ahora + 60_000 || ahora - actualizadoEn > VIGENCIA_MAXIMA_MS) {
    return null;
  }
  if (!esObjeto(valor.registro)) return null;
  const unidadPeso = valor.unidadPeso === "lb" ? "lb" : "kg";

  const registro: RegistroBorradorSesionV2 = {};
  for (const [ejercicioId, seriesBase] of Object.entries(input.registroBase)) {
    const candidatas = valor.registro[ejercicioId];
    if (!Array.isArray(candidatas) || candidatas.length !== seriesBase.length) return null;
    const seriesLocales = candidatas.map(serieSegura);
    if (seriesLocales.some((serie) => serie === null)) return null;
    registro[ejercicioId] = seriesBase.map((serieServidor, indice) => {
      if (serieServidor.completada) {
        return { ...serieServidor, peso: pesoServidorEnUnidad(serieServidor.peso, unidadPeso) };
      }
      return seriesLocales[indice] as SerieBorradorSesionV2;
    });
  }

  const ejercicioActivoId = typeof valor.ejercicioActivoId === "string" && registro[valor.ejercicioActivoId]
    ? valor.ejercicioActivoId
    : Object.keys(registro)[0];
  if (!ejercicioActivoId) return null;
  const indiceSolicitado = Number(valor.serieActivaIndice);
  const serieActivaIndice = Number.isInteger(indiceSolicitado)
    ? Math.min(Math.max(0, indiceSolicitado), registro[ejercicioActivoId].length - 1)
    : 0;

  const notasCrudas = esObjeto(valor.notas) ? valor.notas : {};
  const notas = Object.fromEntries(Object.keys(registro).map((ejercicioId) => {
    const notaLocal = notasCrudas[ejercicioId];
    return [
      ejercicioId,
      typeof notaLocal === "string" && notaLocal.length <= 1_000
        ? notaLocal
        : input.notasBase[ejercicioId] || "",
    ];
  }));
  const segundos = Number(valor.segundosSesion);
  const pasosCrudos = esObjeto(valor.pasosTecnica) ? valor.pasosTecnica : {};
  const pasosTecnica = Object.fromEntries(Object.entries(pasosCrudos).flatMap(([clave, paso]) => {
    const numero = Number(paso);
    return posicionTecnicaValida(clave, registro) && Number.isInteger(numero) && numero >= 0 && numero <= 20
      ? [[clave, numero]]
      : [];
  }));
  let pausaTecnica: BorradorSesionV2["pausaTecnica"] = null;
  if (esObjeto(valor.pausaTecnica)) {
    const clave = typeof valor.pausaTecnica.clave === "string" ? valor.pausaTecnica.clave : "";
    const segundosPausa = Number(valor.pausaTecnica.segundos);
    const pasoSiguiente = Number(valor.pausaTecnica.pasoSiguiente);
    if (
      posicionTecnicaValida(clave, registro)
      && Number.isFinite(segundosPausa)
      && segundosPausa >= 0
      && segundosPausa <= 5 * 60
      && Number.isInteger(pasoSiguiente)
      && pasoSiguiente >= 0
      && pasoSiguiente <= 20
    ) {
      const transcurridos = Math.max(0, Math.floor((ahora - actualizadoEn) / 1_000));
      pausaTecnica = {
        clave,
        segundos: Math.max(0, Math.floor(segundosPausa) - transcurridos),
        pasoSiguiente,
      };
    }
  }

  return {
    version: VERSION,
    sesionId: input.sesionId,
    actualizadoEn,
    registro,
    notas,
    segundosSesion: Number.isFinite(segundos) ? Math.min(Math.max(0, Math.floor(segundos)), 24 * 60 * 60) : 0,
    ejercicioActivoId,
    serieActivaIndice,
    unidadPeso,
    pasosTecnica,
    pausaTecnica,
  };
}
