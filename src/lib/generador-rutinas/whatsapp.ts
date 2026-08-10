/** Vínculo directo al chat de WhatsApp del alumno, sin texto predeterminado.
 *
 * Antes esto abría el chat con un cuestionario largo ya escrito. Se sacó a
 * pedido del entrenador: la ficha del alumno (`/alumno/mi-entrenamiento`) ya
 * trae objetivo, días, lesiones y condiciones médicas, y el generador la lee
 * sola al elegir a la persona — no hace falta pedir los datos por chat. El
 * botón queda solo para abrir la conversación y escribir a mano. */
export function linkWhatsApp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  return `https://wa.me/${digitos}`;
}
