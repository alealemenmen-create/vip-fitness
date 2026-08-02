/** Opciones compartidas entre el formulario público de registro y el panel del
 * entrenador. Los objetivos son los mismos que ofrece "Agregar alumno nuevo"
 * (ver CrearAlumnoForm) para que el valor guardado en `alumno_perfil.objetivo`
 * sea siempre uno de la misma lista, venga de donde venga. */

export const OBJETIVOS = [
  "Pérdida de grasa",
  "Aumento de masa muscular",
  "Recomposición corporal",
  "Mejorar condición física",
] as const;

export const SEXOS = [
  { valor: "femenino", etiqueta: "Femenino" },
  { valor: "masculino", etiqueta: "Masculino" },
  { valor: "otro", etiqueta: "Prefiero no decirlo" },
] as const;

export function etiquetaSexo(valor: string | null): string | null {
  return SEXOS.find((s) => s.valor === valor)?.etiqueta ?? null;
}

/**
 * Correo válido, con criterio estricto a propósito.
 *
 * La versión laxa (`[^\s@]+@[^\s@]+\.[^\s@]+`) aceptaba cosas como
 * `{juan@gmail.com`: cualquier carácter servía mientras no fuera espacio ni
 * arroba. Eso pasó de verdad en el primer registro real, y el problema no se
 * ve hasta el final del camino — el correo queda guardado, el entrenador
 * intenta aceptar la solicitud y Supabase rechaza la creación de la cuenta
 * con un error genérico, cuando ya no hay nadie a quien preguntarle.
 *
 * Acá se limita a los caracteres que de verdad se usan en un correo. No
 * atrapa un `gmial.com` mal escrito (ninguna validación lo hace), para eso
 * está el botón de corregir el correo en la ficha de la solicitud.
 */
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Teléfonos de cualquier formato: dígitos, espacios, +, guiones y paréntesis.
 * Se valida la cantidad de dígitos, no la forma exacta — pedirle a alguien que
 * escriba su número "bien" es la manera más rápida de perderlo. */
export const TELEFONO_RE = /^[\d\s+()-]{8,20}$/;

/** Formato chileno para el monto de la inscripción: $35.000. Vive acá y no en
 * lib/configuracion/registro.ts porque ese módulo es `server-only` y la
 * pantalla de pago, que es la que muestra el monto, corre en el navegador. */
export function formatearMonto(monto: number): string {
  return `$${monto.toLocaleString("es-CL")}`;
}
