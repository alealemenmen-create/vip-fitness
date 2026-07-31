import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { PantallaComer, type GuiaPlan } from "@/components/student/PantallaComer";
import {
  obtenerRegistrosRango,
  obtenerPlanAlimentacion,
  obtenerDocumentoDieta,
} from "../data";
import { hoyISO, horaActualISO, sumarDiasISO } from "@/lib/date";

/**
 * Cuántos días se traen a cada lado del elegido.
 *
 * Con la tira mostrando 7 días (3 + elegido + 3), 10 alcanza para moverse una
 * semana entera en cualquier dirección sin volver a pedirle nada al servidor,
 * y para que todos los puntitos visibles tengan su estado. Recién al salir de
 * ese rango se carga una ventana nueva.
 */
const DIAS_A_CADA_LADO = 10;

/**
 * Alimentación: encabezado, tira de días, tarjeta de macros, línea de tiempo
 * por horas y buscador fijo, todo en una sola pantalla.
 *
 * La fecha vive en la URL, así que volver atrás o compartir el enlace mantiene
 * el día; `/alumno/comer` sin fecha redirige a hoy. Dentro de la ventana
 * precargada, cambiar de día NO navega: es puro estado del cliente.
 */
export default async function ComerDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const rango = {
    desde: sumarDiasISO(fecha, -DIAS_A_CADA_LADO),
    hasta: sumarDiasISO(fecha, DIAS_A_CADA_LADO),
  };

  const [registros, plan, documentoDieta] = await Promise.all([
    obtenerRegistrosRango(supabase, alumnoId, rango.desde, rango.hasta),
    obtenerPlanAlimentacion(supabase, alumnoId),
    obtenerDocumentoDieta(supabase, alumnoId),
  ]);

  // Las comidas del plan que traen hora se muestran como guía en su franja.
  const guias: GuiaPlan[] = (plan?.comidas ?? [])
    .filter((c) => c.hora)
    .map((c) => ({ hora: Number(c.hora!.slice(0, 2)), nombre: c.nombre, kcal: c.kcal }))
    .filter((g) => Number.isInteger(g.hora) && g.hora >= 0 && g.hora <= 23);

  return (
    <PantallaComer
      fechaInicial={fecha}
      registrosServidor={registros}
      rango={rango}
      plan={plan}
      guias={guias}
      soloLectura={soloLectura}
      hoy={hoyISO()}
      horaActual={horaActualISO()}
      documentoDieta={documentoDieta}
    />
  );
}
