import { EntrenamientoDemoV2 } from "@/components/v2/EntrenamientoDemoV2";
import { EntrenamientoInicioV2 } from "@/components/v2/EntrenamientoInicioV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  obtenerAvanceCiclo,
  obtenerBalanceSesionesMes,
  obtenerDiasRutina,
  obtenerDiaVistaPrevia,
  obtenerNumerosCalendario,
  obtenerRutinaActiva,
  obtenerSesionEnProgreso,
} from "@/app/alumno/entrenar/data";
import { descansosDespuesDe, diasQueNumeran, semanaDelNumero } from "@/lib/entrenamiento/ciclo-sesiones";
import { firmarMiniaturasCloudflareV2 } from "@/lib/cloudflare/miniaturas-v2";
import styles from "@/components/v2/PortalV2.module.css";

export default async function EntrenamientoV2Page({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; plan?: string }>;
}) {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return <EntrenamientoDemoV2 />;

  const { alumnoId, soloLectura } = contexto;
  const supabase = await createClient();
  const rutina = await obtenerRutinaActiva(alumnoId);

  if (!rutina) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>Tu programa está listo para comenzar</strong><p>Cuando tu entrenador asigne una rutina, aparecerá aquí con sus días, ejercicios y progreso real.</p></div>
        </section>
      </div>
    );
  }

  const [diasRutina, avance, balanceSesiones, sesionEnProgresoId] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerAvanceCiclo(supabase, alumnoId, rutina.id),
    obtenerBalanceSesionesMes(supabase, alumnoId),
    soloLectura ? Promise.resolve(null) : obtenerSesionEnProgreso(supabase, alumnoId),
  ]);
  const diasEntrenamiento = diasQueNumeran(diasRutina);

  if (diasEntrenamiento.length === 0) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>Rutina sin sesiones disponibles</strong><p>El programa existe, pero todavía no contiene días de entrenamiento configurados.</p></div>
        </section>
      </div>
    );
  }

  const { pagina: paginaParam } = await searchParams;
  const sesionesPorSemana = Math.max(1, diasEntrenamiento.length);
  const pagina = paginaParam
    ? Math.max(1, Number(paginaParam) || 1)
    : semanaDelNumero(avance.proximoNumero, sesionesPorSemana);
  const desde = (pagina - 1) * sesionesPorSemana + 1;
  const numeros = await obtenerNumerosCalendario(
    supabase,
    alumnoId,
    rutina.id,
    diasEntrenamiento,
    desde,
    sesionesPorSemana,
    diasRutina,
  );
  const numeroEnProgreso = numeros.find((numero) => numero.sesionId === sesionEnProgresoId)?.numero;
  const seleccionInicial = numeroEnProgreso
    ?? (numeros.some((numero) => numero.numero === avance.proximoNumero) ? avance.proximoNumero : numeros[0].numero);
  const diasUnicos = [...new Set(numeros.map((numero) => numero.dia.id))];
  const vistasSinFirma = await Promise.all(diasUnicos.map((diaId) => obtenerDiaVistaPrevia(supabase, alumnoId, diaId)));
  const vistas = await Promise.all(vistasSinFirma.map(async (vista) => vista
    ? { ...vista, ejercicios: await firmarMiniaturasCloudflareV2(vista.ejercicios) }
    : null));
  const vistasPrevias = Object.fromEntries(
    vistas.filter((vista): vista is NonNullable<typeof vista> => vista !== null).map((vista) => [vista.id, vista]),
  );

  return (
    <EntrenamientoInicioV2
      numeros={numeros}
      pagina={pagina}
      seleccionInicial={seleccionInicial}
      rutinaId={rutina.id}
      rutinaNombre={rutina.nombre}
      descansoDespuesDe={descansosDespuesDe(diasRutina)}
      vistasPrevias={vistasPrevias}
      sesionEnProgresoId={sesionEnProgresoId}
      planNombre={balanceSesiones?.planNombre ?? null}
      planPausado={balanceSesiones?.pausado ?? false}
      cupoAgotado={(balanceSesiones?.balance ?? 1) <= 0}
      soloLectura={soloLectura}
    />
  );
}
