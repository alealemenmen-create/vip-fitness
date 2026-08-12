import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { CalendarioEntrenamiento } from "@/components/student/CalendarioEntrenamiento";
import { BalanceSesionesMes } from "@/components/student/BalanceSesionesMes";
import { ImpulsoVip } from "@/components/student/ImpulsoVip";
import {
  obtenerRutinaActiva,
  obtenerDiasRutina,
  obtenerNumerosCalendario,
  obtenerProximoNumero,
  obtenerBalanceSesionesMes,
  obtenerSesionEnProgreso,
} from "./data";
import { PuntosVipGanados } from "@/components/student/PuntosVipGanados";
import { descansosDespuesDe, diasQueNumeran, semanaDelNumero, sesionDeLaSemana } from "@/lib/entrenamiento/ciclo-sesiones";

/** Los dos accesos chicos de arriba, alineados a la derecha para que caigan
 * bajo el menú de las tres rayitas. El título de la pantalla ("Entrenamiento
 * VIP") lo pone el encabezado — ver `RUTAS_COMPACTAS` en Logo.tsx.
 *
 * "Entrenamiento en curso" era una barra de ancho completo y pasó a esta
 * píldora, del mismo tamaño que Historial: se distingue por el color de acento
 * y el puntito, no por ocupar espacio. El cronómetro de la rutina NO va acá
 * — vive en la pantalla de la sesión, junto al botón "Iniciar rutina" (ver
 * sesion/[id]/page.tsx). */
const PILDORA = "text-[8px] rounded-full bg-surface-2 px-2 py-1 font-medium";

function AccesosEntrenar({ sesionEnProgresoId }: { sesionEnProgresoId: string | null }) {
  return (
    <div className="flex justify-end gap-1.5">
      {sesionEnProgresoId && (
        <Link
          href={`/alumno/entrenar/sesion/${sesionEnProgresoId}`}
          className={`${PILDORA} flex items-center gap-1.5 text-vip`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-vip" />
          Entrenamiento en curso
        </Link>
      )}
      <Link href="/alumno/entrenar/historial" className={`${PILDORA} text-text-secondary`}>
        Historial
      </Link>
    </div>
  );
}

export default async function EntrenarPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; puntos?: string; plan?: string }>;
}) {
  const { alumnoId: userId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  // Ninguna de estas dos depende de la rutina: se piden ya mismo, en paralelo
  // con todo lo demás, en vez de esperar a tener la rutina para recién
  // pedirlas (eso las volvía dos round-trips extra en la cadena crítica).
  const sesionEnProgresoPromise = soloLectura
    ? Promise.resolve(null)
    : obtenerSesionEnProgreso(supabase, userId);
  const balanceSesionesPromise = obtenerBalanceSesionesMes(supabase, userId);

  const rutina = await obtenerRutinaActiva(userId);

  if (!rutina) {
    // Nadie las lee en esta rama, pero hay que esperarlas igual para no dejar
    // promesas colgadas.
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-3 pb-6">
        <ImpulsoVip
          indicador="En preparación"
          mensaje="Tu próxima rutina todavía no está asignada. Mantente activo y vuelve cuando tu entrenador la publique."
        />
        <Card padding="p-4">
          <p className="text-body text-text-secondary">
            Todavía no tienes una rutina asignada.
            <br />
            Tu entrenador debe asignarte una rutina.
          </p>
        </Card>
      </div>
    );
  }

  // Días de la rutina y próximo número no dependen entre sí, solo de
  // rutina.id: se piden en paralelo en vez de uno después del otro.
  const [diasRutina, proximoNumero, balanceSesiones, sesionEnProgresoId] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerProximoNumero(supabase, userId, rutina.id),
    balanceSesionesPromise,
    sesionEnProgresoPromise,
  ]);

  // Una rutina con días pero todos de descanso queda igual de vacía que una
  // sin días: desde que los descansos no numeran, no hay ninguna sesión que
  // ofrecer. Sin este caso, más abajo se leería `numeros[0]` de una lista
  // vacía.
  if (diasRutina.filter((d) => d.tipo === "entrenamiento").length === 0) {
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-3 pb-6">
        <ImpulsoVip
          indicador="En preparación"
          mensaje="Tu rutina ya está creada; falta que tu entrenador cargue los días para comenzar."
        />
        <Card padding="p-4">
          <p className="text-body text-text-secondary">
            {diasRutina.length === 0
              ? "Esta rutina todavía no tiene días cargados."
              : "Esta rutina solo tiene días de descanso cargados."}
          </p>
        </Card>
      </div>
    );
  }

  const { pagina: paginaParam, puntos: puntosParam, plan: avisoPlan } = await searchParams;
  const puntosGanados = Math.max(0, Number(puntosParam) || 0);

  /**
   * La semana del alumno son sus SESIONES, no los días escritos en la rutina.
   *
   * Acá estaba el desfase: la rueda de `obtenerNumerosCalendario` giraba sobre
   * todos los días (5, contando el descanso) mientras esta pantalla paginaba
   * sobre los de entrenamiento (4). Cinco contra cuatro, y la rutina se corría
   * un lugar por semana.
   *
   * `plan.diasSemana` ya no manda acá: es un dato comercial (cuántas sesiones
   * pagó el alumno) y puede no coincidir con los días que el entrenador
   * realmente cargó. Si no coinciden, mandan los de la rutina — es lo que el
   * alumno tiene que entrenar. El plan sigue gobernando el balance del mes,
   * que es donde corresponde.
   */
  const diasEntrenamiento = diasQueNumeran(diasRutina);
  const sesionesPorSemana = Math.max(1, diasEntrenamiento.length);
  const pagina = paginaParam
    ? Math.max(1, Number(paginaParam) || 1)
    : semanaDelNumero(proximoNumero, sesionesPorSemana);
  const desde = (pagina - 1) * sesionesPorSemana + 1;

  const numeros = await obtenerNumerosCalendario(
    supabase,
    userId,
    rutina.id,
    diasEntrenamiento,
    desde,
    sesionesPorSemana,
    diasRutina
  );

  /**
   * Los descansos salieron de la numeración, pero no de la rutina: el
   * entrenador los sigue escribiendo y el alumno los sigue viendo. Se marcan
   * como una recomendación DESPUÉS de la sesión que los precede en la rutina
   * ("sesión 1, descanso, sesión 2"), sin número ni casillero propio.
   */
  const descansoDespuesDe = descansosDespuesDe(diasRutina);

  const numeroEnProgreso = numeros.find((n) => n.sesionId === sesionEnProgresoId)?.numero;
  const seleccionInicial =
    numeroEnProgreso ??
    (numeros.some((n) => n.numero === proximoNumero) ? proximoNumero : numeros[0].numero);
  const diaImpulso = numeros.find((numero) => numero.numero === seleccionInicial) ?? numeros[0];
  const mensajeImpulso = sesionEnProgresoId
    ? "Ya estás en movimiento. Retoma tu sesión activa y ciérrala con la misma intensidad con la que comenzaste."
    : diaImpulso.estado === "completado"
      ? "Sesión cumplida. Revisa tus marcas y usa esa referencia para superar tu próxima semana."
      : diaImpulso.dia.tipo === "descanso"
        ? "La recuperación también construye resultados. Respeta el descanso y vuelve con energía completa."
        : `Hoy toca ${diaImpulso.dia.nombre}. Entra con un objetivo claro y completa cada serie con intención.`;

  return (
    <div className="space-y-2.5 pb-6">
      <PuntosVipGanados key={puntosParam ?? "0"} puntos={puntosGanados} detalle="Entrenamiento guardado en tu progreso" />
      {(avisoPlan === "pausado" || avisoPlan === "agotado") && (
        <Card padding="p-3" className="border border-warning/40 bg-warning/10">
          <p className="text-caption font-semibold text-warning">
            {avisoPlan === "pausado" ? "Tu plan está pausado" : "Ya completaste las sesiones de este mes"}
          </p>
          <p className="text-micro mt-1 text-text-secondary">
            {avisoPlan === "pausado"
              ? "Tu rutina, registros y Puntos VIP siguen guardados. Habla con tu entrenador para reactivarlo."
              : "El cupo se renovará automáticamente el próximo mes. Si necesitas una excepción, consulta a tu entrenador."}
          </p>
        </Card>
      )}
      <AccesosEntrenar sesionEnProgresoId={sesionEnProgresoId} />
      <ImpulsoVip
        indicador={
          sesionEnProgresoId
            ? "Sesión en curso"
            : `Semana ${pagina} · Sesión ${sesionDeLaSemana(diaImpulso.numero, sesionesPorSemana)} de ${sesionesPorSemana}`
        }
        mensaje={mensajeImpulso}
      />

      {/* El calendario y la tarjeta de "Iniciar entrenamiento" van ANTES del
          balance del mes: es lo que el alumno viene a hacer, y con el balance
          en medio quedaba abajo del pliegue. El balance es de consulta. */}
      <CalendarioEntrenamiento
        numeros={numeros}
        pagina={pagina}
        seleccionInicial={seleccionInicial}
        proximoNumero={proximoNumero}
        rutinaId={rutina.id}
        soloLectura={soloLectura}
        sesionesPorSemana={sesionesPorSemana}
        descansoDespuesDe={descansoDespuesDe}
        planNombre={balanceSesiones?.planNombre ?? null}
        planPausado={balanceSesiones?.pausado ?? false}
        cupoAgotado={(balanceSesiones?.balance ?? 1) <= 0}
      />

      <BalanceSesionesMes balance={balanceSesiones} compacta />
    </div>
  );
}
