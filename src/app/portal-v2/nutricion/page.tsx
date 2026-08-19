import { NutricionV2, type NutricionDatosV2 } from "@/components/v2/NutricionV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerPlanAlimentacion, obtenerRegistrosRango } from "@/app/alumno/comer/data";
import { diasVentanaISO, horaActualISO, hoyISO, sumarDiasISO } from "@/lib/date";

export default async function NutricionV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return <NutricionV2 />;

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
