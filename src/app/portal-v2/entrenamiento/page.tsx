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
import { descansosDespuesDe, diasQueNumeran, mesDelNumero, sesionesPorMes } from "@/lib/entrenamiento/ciclo-sesiones";
import { firmarMiniaturasCloudflareV2 } from "@/lib/cloudflare/miniaturas-v2";
import styles from "@/components/v2/PortalV2.module.css";
import { obtenerDocumentoPublicadoEstudioVip } from "@/lib/estudio-vip/data";
import { obtenerRankingSemanal } from "@/lib/ranking/data";
import { obtenerPulsoComunidadV2 } from "@/app/portal-v2/progreso/comunidad/data";

export default async function EntrenamientoV2Page() {
  const [contexto, documentoEstudio] = await Promise.all([
    obtenerContextoAlumnoOpcional(),
    obtenerDocumentoPublicadoEstudioVip(),
  ]);
  if (!contexto) return <div className={styles.trainingPage}><section className={styles.impulso}><div><strong>Selecciona un perfil de alumno</strong><p>Tu cuenta profesional no tiene una rutina personal activa. Abre Alumnos y usa “Ver como alumno” para revisar datos reales, o activa tu propio perfil desde el panel.</p></div></section></div>;

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

  const [diasRutina, avance, balanceSesiones, sesionEnProgresoId, rankingSemanal, pulsoComunidad] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerAvanceCiclo(supabase, alumnoId, rutina.id),
    obtenerBalanceSesionesMes(supabase, alumnoId),
    soloLectura ? Promise.resolve(null) : obtenerSesionEnProgreso(supabase, alumnoId),
    obtenerRankingSemanal(),
    obtenerPulsoComunidadV2(alumnoId),
  ]);
  const rankingPropia = rankingSemanal.find((fila) => fila.alumnoId === alumnoId) ?? null;
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

  // Ciclo mensual completo (12/16/20/24 días según el split, ver
  // sesionesPorMes) como una sola tira, sin paginar semana por semana --
  // pedido de Alejandro, 2026-08-21: "quita lo de semana, déjame nada más
  // los días". El bloque que se trae es el que contiene el próximo número
  // del alumno, igual que antes se traía la semana que lo contenía.
  const sesionesPorSemana = Math.max(1, diasEntrenamiento.length);
  const totalDelMes = sesionesPorMes(sesionesPorSemana);
  const mes = mesDelNumero(avance.proximoNumero, sesionesPorSemana);
  const desde = (mes - 1) * totalDelMes + 1;
  const numeros = await obtenerNumerosCalendario(
    supabase,
    alumnoId,
    rutina.id,
    diasEntrenamiento,
    desde,
    totalDelMes,
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
      seleccionInicial={seleccionInicial}
      rutinaId={rutina.id}
      rutinaNombre={rutina.nombre}
      descansoDespuesDe={descansosDespuesDe(diasRutina)}
      vistasPrevias={vistasPrevias}
      sesionEnProgresoId={sesionEnProgresoId}
      planNombre={balanceSesiones?.planNombre ?? null}
      planPausado={balanceSesiones?.pausado ?? false}
      // Pausado a pedido de Alejandro (2026-08-22): mientras el control de
      // acceso real dependa de la membresía sincronizada con la app
      // "Gestión VIP Fitness" (todavía no existe esa integración), el cupo
      // de sesiones del mes no debe bloquear que el alumno inicie un día.
      // El cálculo de `balanceSesiones` sigue existiendo (se usa en el panel
      // del entrenador), solo se dejó de usar para bloquear acá.
      cupoAgotado={false}
      soloLectura={soloLectura}
      configuracion={documentoEstudio.configuracion}
      rankingPropia={rankingPropia}
      pulsoComunidad={pulsoComunidad}
    />
  );
}
