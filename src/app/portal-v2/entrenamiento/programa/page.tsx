import { ProgramaDetalleV2 } from "@/components/v2/ProgramaDetalleV2";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  obtenerAvanceCiclo,
  obtenerDiasRutina,
  obtenerNumerosCalendario,
  obtenerRutinaActiva,
} from "@/app/alumno/entrenar/data";
import { diasQueNumeran } from "@/lib/entrenamiento/ciclo-sesiones";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import styles from "@/components/v2/PortalV2.module.css";

export default async function ProgramaV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return <ProgramaDetalleV2 />;

  const { alumnoId } = contexto;
  const supabase = await createClient();
  const rutina = await obtenerRutinaActiva(alumnoId);
  if (!rutina) {
    return (
      <div className={styles.trainingPage}>
        <section className={styles.impulso}>
          <div><strong>Todavía no tienes un programa activo</strong><p>Cuando tu entrenador publique tu rutina, aparecerá aquí con todos sus días.</p></div>
        </section>
      </div>
    );
  }

  const diasRutina = await obtenerDiasRutina(rutina.id);
  const diasEntrenamiento = diasQueNumeran(diasRutina);

  let diaSiguienteId: string | null = null;
  let diaSiguienteNumero: number | null = null;
  if (diasEntrenamiento.length > 0) {
    const avance = await obtenerAvanceCiclo(supabase, alumnoId, rutina.id);
    const [siguiente] = await obtenerNumerosCalendario(
      supabase, alumnoId, rutina.id, diasEntrenamiento, avance.proximoNumero, 1, diasRutina,
    );
    if (siguiente) {
      diaSiguienteId = siguiente.dia.id;
      diaSiguienteNumero = siguiente.numero;
    }
  }

  const totalEjercicios = diasRutina.reduce((total, dia) => total + (dia.resumen?.cantidadEjercicios ?? 0), 0);
  const totalSeries = diasRutina.reduce((total, dia) => total + (dia.resumen?.cantidadSeries ?? 0), 0);

  return (
    <ProgramaDetalleV2
      programa={{
        nombre: rutina.nombre,
        diasPorSemana: diasEntrenamiento.length,
        totalDias: diasRutina.length,
        totalEjercicios,
        totalSeries,
        diaSiguienteId,
        diaSiguienteNumero,
        rutinaId: rutina.id,
        dias: diasRutina.map((dia, indice) => {
          const grupoPrincipal = dia.resumen?.gruposMusculares?.[0] ?? null;
          return {
            id: dia.id,
            posicion: indice + 1,
            nombre: dia.nombre,
            tipo: dia.tipo,
            minutos: dia.resumen?.minutosEstimados ?? null,
            etiquetaGrupo: grupoPrincipal ? ETIQUETAS_GRUPO_MUSCULAR[grupoPrincipal] : null,
            foto: grupoPrincipal ? (FOTOS_GRUPO_MUSCULAR[grupoPrincipal]?.[0] ?? null) : null,
          };
        }),
      }}
    />
  );
}
