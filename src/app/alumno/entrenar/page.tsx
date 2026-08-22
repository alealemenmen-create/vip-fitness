import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { CalendarioEntrenamiento } from "@/components/student/CalendarioEntrenamiento";
import { BalanceSesionesMes } from "@/components/student/BalanceSesionesMes";
import {
  obtenerRutinaActiva,
  obtenerDiasRutina,
  obtenerNumerosCalendario,
  obtenerAvanceCiclo,
  obtenerBalanceSesionesMes,
  obtenerSesionEnProgreso,
  obtenerDiaVistaPrevia,
} from "./data";
import { PuntosVipGanados } from "@/components/student/PuntosVipGanados";
import {
  descansosDespuesDe,
  diasQueNumeran,
  semanaDelNumero,
} from "@/lib/entrenamiento/ciclo-sesiones";

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
  if (!sesionEnProgresoId) return null;
  return (
    <div className="flex justify-end gap-1.5">
      <Link
        href={`/alumno/entrenar/sesion/${sesionEnProgresoId}`}
        className={`${PILDORA} flex items-center gap-1.5 text-vip`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-vip" />
        Entrenamiento en curso
      </Link>
    </div>
  );
}

export default async function EntrenarPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; puntos?: string; plan?: string; portal_v2?: string }>;
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
  const [diasRutina, avance, balanceSesiones, sesionEnProgresoId] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerAvanceCiclo(supabase, userId, rutina.id),
    balanceSesionesPromise,
    sesionEnProgresoPromise,
  ]);
  const { proximoNumero, ultimoNumeroHecho } = avance;

  // Una rutina con días pero todos de descanso queda igual de vacía que una
  // sin días: desde que los descansos no numeran, no hay ninguna sesión que
  // ofrecer. Sin este caso, más abajo se leería `numeros[0]` de una lista
  // vacía.
  if (diasRutina.filter((d) => d.tipo === "entrenamiento").length === 0) {
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-3 pb-6">
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

  const { pagina: paginaParam, puntos: puntosParam, plan: avisoPlan, portal_v2: avisoPortalV2 } = await searchParams;
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
  const diasUnicos = [...new Set(numeros.map((numero) => numero.dia.id))];
  const vistas = await Promise.all(
    diasUnicos.map((diaId) => obtenerDiaVistaPrevia(supabase, userId, diaId))
  );
  const vistasPrevias = Object.fromEntries(
    vistas
      .filter((vista): vista is NonNullable<typeof vista> => vista !== null)
      .map((vista) => [vista.id, vista])
  );

  return (
    // `pb-16` y no `pb-36`: el contenedor que hace scroll ya aporta 96 px
    // (`pb-24`) y el CTA fijo empieza 142 px arriba del borde inferior, así que
    // 144 px propios dejaban ~85 px de vacío negro entre "Estado del plan
    // mensual" y "Iniciar rutina" al llegar al final.
    <div className="entrenar-minimalista space-y-2 pb-16">
      <PuntosVipGanados key={puntosParam ?? "0"} puntos={puntosGanados} detalle="Entrenamiento guardado en tu progreso" />
      {avisoPortalV2 === "no_habilitado" ? (
        <Card padding="p-3" className="border border-white/10 bg-surface">
          <p className="text-caption font-semibold text-text">Portal VIP V2 todavía no está habilitado para tu cuenta.</p>
          <p className="text-micro mt-1 text-text-secondary">Tu Vista clásica sigue funcionando con todos tus datos. Tu entrenador te avisará cuando puedas entrar al piloto.</p>
        </Card>
      ) : null}
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

      {/* El calendario y la tarjeta de "Iniciar entrenamiento" van ANTES del
          balance del mes: es lo que el alumno viene a hacer, y con el balance
          en medio quedaba abajo del pliegue. El balance es de consulta. */}
      <CalendarioEntrenamiento
        numeros={numeros}
        pagina={pagina}
        seleccionInicial={seleccionInicial}
        rutinaId={rutina.id}
        soloLectura={soloLectura}
        sesionesPorSemana={sesionesPorSemana}
        descansoDespuesDe={descansoDespuesDe}
        ultimoNumeroHecho={ultimoNumeroHecho}
        planNombre={balanceSesiones?.planNombre ?? null}
        planPausado={balanceSesiones?.pausado ?? false}
        // Pausado a pedido de Alejandro (2026-08-22): ver el mismo comentario
        // en `portal-v2/entrenamiento/page.tsx`.
        cupoAgotado={false}
        vistasPrevias={vistasPrevias}
      />

      <div className="space-y-2 pt-2">
        <Link
          href="/alumno/entrenar/historial"
          className="mx-auto flex w-fit items-center rounded-full border border-white/[0.09] px-4 py-2 text-caption font-semibold text-text-secondary"
        >
          Ver historial de entrenamiento
        </Link>
        {balanceSesiones && (
          <details className="group rounded-2xl border border-white/[0.05] bg-surface/35">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-caption font-semibold text-text-secondary marker:content-none">
              Estado del plan mensual
              <span className="text-[16px] text-text-tertiary transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="px-2 pb-2">
              <BalanceSesionesMes balance={balanceSesiones} compacta />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
