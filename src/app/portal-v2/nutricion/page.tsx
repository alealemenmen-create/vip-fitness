import { NutricionV2, type NutricionDatosV2 } from "@/components/v2/NutricionV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerPlanAlimentacion, obtenerRegistrosRango } from "@/app/alumno/comer/data";
import { diasVentanaISO, horaActualISO, hoyISO, sumarDiasISO } from "@/lib/date";
import styles from "@/components/v2/PortalV2.module.css";

export default async function NutricionV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return <div className={styles.trainingPage}><section className={styles.impulso}><div><strong>Selecciona un perfil de alumno</strong><p>La nutrición de Portal V2 sólo muestra registros y planes reales. Usa “Ver como alumno” desde el panel o activa tu perfil personal.</p></div></section></div>;

  const fechaInicial = hoyISO();
  const desde = sumarDiasISO(fechaInicial, -3);
  const hasta = sumarDiasISO(fechaInicial, 3);
  const supabase = await createClient();
  const [registros, plan] = await Promise.all([
    obtenerRegistrosRango(supabase, contexto.alumnoId, desde, hasta),
    obtenerPlanAlimentacion(supabase, contexto.alumnoId),
  ]);
  const etiquetas = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const dias = diasVentanaISO(fechaInicial, 3, 3).map((dia) => {
    const fecha = new Date(`${dia.fecha}T12:00:00`);
    return { dia: etiquetas[fecha.getDay()], numero: dia.dia, fecha: dia.fecha };
  });
  const datos: NutricionDatosV2 = {
    fechaInicial,
    dias,
    registros,
    plan,
    horaActual: horaActualISO(),
    soloLectura: contexto.soloLectura,
  };

  return <NutricionV2 datos={datos} />;
}
