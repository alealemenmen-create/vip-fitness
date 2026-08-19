export const SEGUNDOS_DESCANSO_PERMITIDOS = [40, 60, 90, 120, 150] as const;

export type DatosPersonalesEntrada = {
  nombre: string;
  fechaNacimiento: string;
  estaturaCm: string;
  condicionMedica: string;
  restriccionAlimenticia: string;
  telefono: string;
  sexo: string;
};

export type DatosPersonalesValidados = {
  nombre: string;
  fechaNacimiento: string | null;
  estaturaCm: number | null;
  condicionMedica: string | null;
  restriccionAlimenticia: string | null;
  telefono: string | null;
  sexo: string | null;
};

export type ResultadoValidacionDatosPersonales =
  | { ok: true; datos: DatosPersonalesValidados }
  | { ok: false; error: string };

function fechaIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function fechaIsoHoy(hoy: Date): string {
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Una sola validación para el formulario clásico y V2. Devuelve valores ya
 * normalizados para que la acción no pueda anunciar éxito con datos que la
 * base rechazará después (NaN, fechas imposibles o textos desmedidos).
 */
export function validarDatosPersonales(
  entrada: DatosPersonalesEntrada,
  hoy = new Date(),
): ResultadoValidacionDatosPersonales {
  const nombre = entrada.nombre.trim().replace(/\s+/g, " ");
  const fechaNacimiento = entrada.fechaNacimiento.trim();
  const estaturaTexto = entrada.estaturaCm.trim().replace(",", ".");
  const condicionMedica = entrada.condicionMedica.trim();
  const restriccionAlimenticia = entrada.restriccionAlimenticia.trim();
  const telefono = entrada.telefono.trim();
  const sexo = entrada.sexo.trim();

  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, error: "Ingresa un nombre de entre 2 y 80 caracteres." };
  }
  if (fechaNacimiento) {
    if (!fechaIsoValida(fechaNacimiento)) return { ok: false, error: "Ingresa una fecha de nacimiento válida." };
    if (fechaNacimiento > fechaIsoHoy(hoy)) return { ok: false, error: "La fecha de nacimiento no puede estar en el futuro." };
    if (Number(fechaNacimiento.slice(0, 4)) < 1900) return { ok: false, error: "Revisa el año de nacimiento." };
  }

  const estaturaCm = estaturaTexto ? Number(estaturaTexto) : null;
  if (estaturaCm !== null && (!Number.isFinite(estaturaCm) || estaturaCm < 80 || estaturaCm > 260)) {
    return { ok: false, error: "Ingresa una estatura válida entre 80 y 260 cm." };
  }
  if (telefono && !/^[\d\s+()-]{8,20}$/.test(telefono)) return { ok: false, error: "Ingresa un teléfono válido." };
  if (condicionMedica.length > 2000) return { ok: false, error: "La condición médica no puede superar 2.000 caracteres." };
  if (restriccionAlimenticia.length > 2000) return { ok: false, error: "La información alimenticia no puede superar 2.000 caracteres." };

  return {
    ok: true,
    datos: {
      nombre,
      fechaNacimiento: fechaNacimiento || null,
      estaturaCm,
      condicionMedica: condicionMedica || null,
      restriccionAlimenticia: restriccionAlimenticia || null,
      telefono: telefono || null,
      sexo: sexo || null,
    },
  };
}

export function segundosDescansoPermitidos(segundos: number | null): boolean {
  return segundos === null || SEGUNDOS_DESCANSO_PERMITIDOS.includes(segundos as (typeof SEGUNDOS_DESCANSO_PERMITIDOS)[number]);
}
