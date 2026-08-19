export type SeguimientoDiarioValidado = {
  entreno_hoy: boolean | null;
  cumplio_alimentacion: boolean | null;
  agua_litros: number | null;
  horas_sueno: number | null;
  energia: number | null;
  molestias: string | null;
  comentario: string | null;
};

export type RegistroPesoValidado = {
  pesoKg: number;
  observacion: string | null;
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

function textoOpcional(valor: FormDataEntryValue | null, campo: string, maximo: number) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (texto.length > maximo) {
    return { valor: null, error: `${campo} no puede superar ${maximo} caracteres.` };
  }
  return { valor: texto || null, error: null };
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
  const molestias = textoOpcional(formData.get("molestias"), "Las molestias", 300);
  if (molestias.error) return { ok: false, error: molestias.error };
  const comentario = textoOpcional(formData.get("comentario"), "El comentario", 600);
  if (comentario.error) return { ok: false, error: comentario.error };

  const datos: SeguimientoDiarioValidado = {
    entreno_hoy: booleanoOpcional(formData.get("entreno_hoy")),
    cumplio_alimentacion: booleanoOpcional(formData.get("cumplio_alimentacion")),
    agua_litros: agua.valor,
    horas_sueno: sueno.valor,
    energia: energia.valor,
    molestias: molestias.valor,
    comentario: comentario.valor,
  };
  if (Object.values(datos).every((valor) => valor === null)) {
    return { ok: false, error: "Completa al menos una señal de tu check-in antes de guardar." };
  }

  return {
    ok: true,
    datos,
  };
}

/** Valida el dato corporal antes de tocar Supabase. La base permite cualquier
 * número positivo; el límite superior evita errores de teclado que después
 * deforman toda la evolución y son difíciles de detectar visualmente. */
export function validarRegistroPeso(formData: FormData):
  | { ok: true; datos: RegistroPesoValidado }
  | { ok: false; error: string } {
  const entrada = formData.get("peso_kg");
  const textoPeso = typeof entrada === "string" ? entrada.trim().replace(",", ".") : "";
  const peso = Number(textoPeso);
  if (!textoPeso || !Number.isFinite(peso) || peso <= 0 || peso > 500) {
    return { ok: false, error: "Ingresa un peso válido entre 0,1 y 500 kg." };
  }

  const observacion = textoOpcional(formData.get("observacion"), "La observación", 300);
  if (observacion.error) return { ok: false, error: observacion.error };

  return {
    ok: true,
    datos: {
      pesoKg: Math.round(peso * 100) / 100,
      observacion: observacion.valor,
    },
  };
}
