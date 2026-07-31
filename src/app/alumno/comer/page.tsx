import { redirect } from "next/navigation";
import { hoyISO } from "@/lib/date";

/** La pestaña "Comer" abre siempre el día de hoy: la pantalla vive en
 * [fecha], que es la que guarda el día en la URL. */
export default function ComerPage() {
  redirect(`/alumno/comer/${hoyISO()}`);
}
