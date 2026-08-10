import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

/** Texto legible de una rutina — día por día, ejercicio por ejercicio, con lo
 * que de verdad importa para entrenar (series, reps, descanso, técnica). No
 * es un volcado de la base de datos: es lo mismo que vería el entrenador si
 * la hubiera escrito a mano y pegado como .txt.
 *
 * Vive en `lib` (no en las Server Actions) a propósito: lo usa tanto el
 * servidor al publicar (para guardarlo como documento del alumno) como el
 * cliente para la vista previa en RutinaDraftEditor, antes de confirmar. */
export function serializarRutinaATexto(datos: RutinaExtraida): string {
  const partes = [datos.nombreRutina || "Rutina de entrenamiento", ""];
  for (const dia of datos.dias) {
    partes.push(`Día ${dia.numero} — ${dia.nombre}`);
    if (dia.tipo === "descanso") {
      partes.push(dia.descripcion ? `Descanso: ${dia.descripcion}` : "Descanso");
    } else {
      dia.ejercicios.forEach((ej, i) => {
        let linea = `${i + 1}. ${ej.nombre} — ${ej.series}x${ej.reps}, descanso ${ej.descansoSegundos}s`;
        if (ej.tecnicaTipo) linea += ` [${ej.tecnicaTipo}${ej.tecnicaInstruccion ? `: ${ej.tecnicaInstruccion}` : ""}]`;
        partes.push(linea);
        if (ej.observacion) partes.push(`   Nota: ${ej.observacion}`);
      });
    }
    partes.push("");
  }
  return partes.join("\n").trim();
}
