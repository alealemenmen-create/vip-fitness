/** Vínculo directo al chat de WhatsApp del alumno, sin texto predeterminado.
 *
 * Antes esto abría el chat con un cuestionario largo ya escrito. Se sacó a
 * pedido del entrenador: la ficha del alumno (`/alumno/mi-entrenamiento`) ya
 * trae objetivo, días, lesiones y condiciones médicas, y el generador la lee
 * sola al elegir a la persona — no hace falta pedir los datos por chat. El
 * botón queda solo para abrir la conversación y escribir a mano. */
export function linkWhatsApp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  // El teléfono se guarda tal como lo escribe el alumno al registrarse —
  // sin el código de país, solo el celular chileno de 9 dígitos empezando
  // en 9 (ver DatosPersonalesForm). Sin el 56 adelante, wa.me abre un chat
  // con el número equivocado o directamente no encuentra la cuenta.
  if (digitos.length === 9 && digitos.startsWith("9")) digitos = `56${digitos}`;
  return `https://wa.me/${digitos}`;
}
