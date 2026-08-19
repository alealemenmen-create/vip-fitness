export type SeguimientoDiarioValidado = {
  entreno_hoy: boolean | null;
  cumplio_alimentacion: boolean | null;
  agua_litros: number | null;
  horas_sueno: number | null;
  energia: number | null;
  molestias: string | null;
  comentario: string | null;
};

function booleanoOpcional(valor: FormDataEntryValue | null) {
  if (valor === "true") return true;
  if (valor === "false") return false;
  return null;
}

function numeroOpcional(
  valor: FormDataEntryValue | null,
  campo: string,
  minimo: number,
  maximo: number,
) {
  const texto = typeof valor === "string" ? valor.trim().replace(",", ".") : "";
  if (!texto) return { valor: null, error: null };
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) {
    return { valor: null, error: `${campo} debe estar entre ${minimo} y ${maximo}.` };
  }
  return { valor: numero, error: null };
}

function textoOpcional(valor: FormDataEntryValue | null, maximo: number) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto ? texto.slice(0, maximo) : null;
}

export function validarSeguimientoDiario(formData: FormData):
  | { ok: true; datos: SeguimientoDiarioValidado }
  | { ok: false; error: string } {
  const agua = numeroOpcional(formData.get("agua_litros"), "El agua", 0, 15);
  if (agua.error) return { ok: false, error: agua.error };
  const sueno = numeroOpcional(formData.get("horas_sueno"), "El sueño", 0, 24);
  if (sueno.error) return { ok: false, error: sueno.error };
  const energia = numeroOpcional(formData.get("energia"), "La energía", 1, 5);
  if (energia.error || (energia.valor !== null && !Number.isInteger(energia.valor))) {
    return { ok: false, error: energia.error ?? "La energía debe ser un número entero entre 1 y 5." };
  }

  return {
    ok: true,
    datos: {
      entreno_hoy: booleanoOpcional(formData.get("entreno_hoy")),
      cumplio_alimentacion: booleanoOpcional(formData.get("cumplio_alimentacion")),
      agua_litros: agua.valor,
      horas_sueno: sueno.valor,
      energia: energia.valor,
      molestias: textoOpcional(formData.get("molestias"), 300),
      comentario: textoOpcional(formData.get("comentario"), 600),
    },
  };
}
