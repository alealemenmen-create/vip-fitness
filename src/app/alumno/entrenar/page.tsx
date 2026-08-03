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
import { PuntosVipGanados } from "@/components/student/PuntosVipGanados";

const NUMEROS_POR_PAGINA = 7;

/** Los dos accesos chicos de arriba, alineados a la derecha para que caigan
 * bajo el menú de las tres rayitas. El título de la pantalla ("Entrenamiento
 * VIP") lo pone el encabezado — ver `RUTAS_COMPACTAS` en Logo.tsx.
 *
 * "Entrenamiento en curso" era una barra de ancho completo y pasó a esta
 * píldora, del mismo tamaño que Historial: se distingue por el color de acento
 * y el puntito, no por ocupar espacio. El cronómetro de la rutina NO va acá
 * — vive en la pantalla de la sesión, junto al botón "Iniciar rutina" (ver
 * sesion/[id]/page.tsx). */
const PILDORA = "text-micro rounded-full bg-surface-2 px-2.5 py-1 font-medium";

function AccesosEntrenar({ sesionEnProgresoId }: { sesionEnProgresoId: string | null }) {
  return (
    <div className="flex justify-end gap-2">
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
  searchParams: Promise<{ pagina?: string; puntos?: string }>;
}) {
  const { alumnoId: userId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  // Ninguna de estas dos depende de la rutina: se piden ya mismo, en paralelo
  // con todo lo demás, en vez de esperar a tener la rutina para recién
  // pedirlas (eso las volvía dos round-trips extra en la cadena crítica).
  const sesionEnProgresoPromise = soloLectura
    ? Promise.resolve(null)
    : obtenerSesionEnProgreso(supabase, userId);
  const balanceSesionesPromise = obtenerBalanceSesionesMes(supabase, userId);

  const rutina = await obtenerRutinaActiva(userId);

  // El nombre sale de requireAlumno(), que ya lo trajo: preguntarle otra vez a
  // `perfiles` era un viaje de ~95ms por la misma fila que ya estaba en mano.
  const primerNombre = nombreAlumnoPublicado(nombre).split(" ")[0] ?? "";
  const frase = fraseDelDia("entrenar", primerNombre);

  if (!rutina) {
    // Nadie las lee en esta rama, pero hay que esperarlas igual para no dejar
    // promesas colgadas.
    await Promise.all([sesionEnProgresoPromise, balanceSesionesPromise]);
    return (
      <div className="space-y-4 pb-8">
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
      <div className="space-y-4 pb-8">
        <MensajeMotivacional frase={frase} />
        <Card>
          <p className="text-body text-text-secondary">Esta rutina todavía no tiene días cargados.</p>
        </Card>
      </div>
    );
  }

  const { pagina: paginaParam, puntos: puntosParam } = await searchParams;
  const puntosGanados = Math.max(0, Number(puntosParam) || 0);
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
    <div className="space-y-4 pb-8">
      <PuntosVipGanados key={puntosParam ?? "0"} puntos={puntosGanados} detalle="Entrenamiento guardado en tu progreso" />
      <AccesosEntrenar sesionEnProgresoId={sesionEnProgresoId} />

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
      />

      <BalanceSesionesMes balance={balanceSesiones} />
    </div>
  );
}
