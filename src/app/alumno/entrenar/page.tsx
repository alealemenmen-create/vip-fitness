import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { CalendarioEntrenamiento } from "@/components/student/CalendarioEntrenamiento";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { BalanceSesionesMes } from "@/components/student/BalanceSesionesMes";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import {
  obtenerRutinaActiva,
  obtenerDiasRutina,
  obtenerNumerosCalendario,
  obtenerProximoNumero,
  obtenerBalanceSesionesMes,
  obtenerSesionEnProgreso,
} from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const NUMEROS_POR_PAGINA = 7;

export default async function EntrenarPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
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

  const [rutina, { data: perfil }] = await Promise.all([
    obtenerRutinaActiva(userId),
    supabase.from("perfiles").select("nombre").eq("id", userId).single(),
  ]);

  const primerNombre = perfil?.nombre ? nombreAlumnoPublicado(perfil.nombre).split(" ")[0] : "";
  const frase = fraseDelDia("entrenar", primerNombre);

  if (!rutina) {
    // Nadie las lee en esta rama, pero hay que esperarlas igual para no dejar
    // promesas colgadas.
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-6 pb-8">
        <h1 className="text-h2 text-text">Entrenamiento <span className="text-vip">VIP</span></h1>
        <MensajeMotivacional frase={frase} />
        <Card>
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
  const [diasRutina, proximoNumero] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    obtenerProximoNumero(supabase, userId, rutina.id),
  ]);

  if (diasRutina.length === 0) {
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-6 pb-8">
        <h1 className="text-h2 text-text">Entrenamiento <span className="text-vip">VIP</span></h1>
        <MensajeMotivacional frase={frase} />
        <Card>
          <p className="text-body text-text-secondary">Esta rutina todavía no tiene días cargados.</p>
        </Card>
      </div>
    );
  }

  const { pagina: paginaParam } = await searchParams;
  const pagina = paginaParam
    ? Math.max(1, Number(paginaParam) || 1)
    : Math.max(1, Math.ceil(proximoNumero / NUMEROS_POR_PAGINA));
  const desde = (pagina - 1) * NUMEROS_POR_PAGINA + 1;

  const [numeros, sesionEnProgresoId, balanceSesiones] = await Promise.all([
    obtenerNumerosCalendario(supabase, userId, rutina.id, diasRutina, desde, NUMEROS_POR_PAGINA),
    sesionEnProgresoPromise,
    balanceSesionesPromise,
  ]);

  const numeroEnProgreso = numeros.find((n) => n.sesionId === sesionEnProgresoId)?.numero;
  const seleccionInicial =
    numeroEnProgreso ??
    (numeros.some((n) => n.numero === proximoNumero) ? proximoNumero : numeros[0].numero);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h2 text-text">Entrenamiento <span className="text-vip">VIP</span></h1>
        <Link
          href="/alumno/entrenar/historial"
          className="text-caption shrink-0 rounded-full bg-surface-2 px-3 py-1.5 font-medium text-text-secondary"
        >
          Historial
        </Link>
      </div>

      <MensajeMotivacional frase={frase} />

      {sesionEnProgresoId && (
        <Link
          href={`/alumno/entrenar/sesion/${sesionEnProgresoId}`}
          className="radius-control flex items-center justify-between border border-border bg-surface px-4 py-3 text-secondary font-semibold text-text"
        >
          <span>Entrenamiento en curso</span>
          <span className="text-vip">Continuar</span>
        </Link>
      )}

      <BalanceSesionesMes balance={balanceSesiones} />

      <CalendarioEntrenamiento
        numeros={numeros}
        pagina={pagina}
        seleccionInicial={seleccionInicial}
        proximoNumero={proximoNumero}
        rutinaId={rutina.id}
        soloLectura={soloLectura}
      />
    </div>
  );
}
