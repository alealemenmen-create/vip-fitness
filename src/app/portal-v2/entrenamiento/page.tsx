import Link from "next/link";
import { EntrenamientoInicioV2 } from "@/components/v2/EntrenamientoInicioV2";
import styles from "@/components/v2/PortalV2.module.css";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  obtenerAvanceCiclo,
  obtenerBalanceSesionesMes,
  obtenerDiaVistaPrevia,
  obtenerDiasRutina,
  obtenerNumerosCalendario,
  obtenerRutinaActiva,
  obtenerSesionEnProgreso,
} from "@/app/alumno/entrenar/data";
import { descansosDespuesDe, diasQueNumeran, semanaDelNumero } from "@/lib/entrenamiento/ciclo-sesiones";

export default async function EntrenamientoV2Page({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const sesionEnProgresoPromesa = soloLectura ? Promise.resolve(null) : obtenerSesionEnProgreso(supabase, alumnoId);
  const balancePromesa = obtenerBalanceSesionesMes(supabase, alumnoId);
  const rutina = await obtenerRutinaActiva(alumnoId);

  if (!rutina) {
    await Promise.all([sesionEnProgresoPromesa, balancePromesa]);
    return (
      <section className={styles.simplePage}>
        <h1 className={styles.simpleTitle}>Entrenamiento</h1>
        <p className={styles.simpleLead}>Todavía no tienes un programa asignado. Tu entrenador lo está preparando.</p>
        <Link href="/alumno/inicio" className={styles.classicLink}>Abrir el portal clásico</Link>
      </section>
    );
  }

  const [diasRutina, avance, balance, sesionEnProgresoId] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerAvanceCiclo(supabase, alumnoId, rutina.id),
    balancePromesa,
    sesionEnProgresoPromesa,
  ]);
  const diasEntrenamiento = diasQueNumeran(diasRutina);

  if (diasEntrenamiento.length === 0) {
    return (
      <section className={styles.simplePage}>
        <h1 className={styles.simpleTitle}>{rutina.nombre}</h1>
        <p className={styles.simpleLead}>Este programa todavía no tiene días de entrenamiento cargados.</p>
      </section>
    );
  }

  const sesionesPorSemana = Math.max(1, diasEntrenamiento.length);
  const { pagina: paginaParam } = await searchParams;
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
  const vistas = await Promise.all(diasUnicos.map((diaId) => obtenerDiaVistaPrevia(supabase, alumnoId, diaId)));
  const vistasPrevias = Object.fromEntries(
    vistas
      .filter((vista): vista is NonNullable<typeof vista> => vista !== null)
      .map((vista) => [vista.id, vista]),
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
      planNombre={balance?.planNombre ?? null}
      planPausado={balance?.pausado ?? false}
      cupoAgotado={(balance?.balance ?? 1) <= 0}
      soloLectura={soloLectura}
    />
  );
}
