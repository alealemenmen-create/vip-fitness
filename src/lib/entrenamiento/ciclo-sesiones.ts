/**
 * Qué sesión le toca al alumno, y por qué los descansos no cuentan.
 *
 * Vive acá y no en `app/alumno/entrenar/data.ts` (que es `server-only`) por la
 * misma razón que `sesion-actual.ts`: es una regla de negocio, no una
 * consulta, y así se puede probar sin base de datos.
 *
 * ## El bug que originó este módulo
 *
 * La rutina del alumno es una rueda de posiciones, no un calendario: no hay
 * ningún concepto de lunes o martes en la app. El número de sesión avanza
 * cuando el alumno consume uno desde el teléfono.
 *
 * Los descansos ocupaban una posición de esa rueda, y eso rompía dos cosas:
 *
 * 1. **Se trababa.** Un descanso de la vida real pasa solo, pero en la app
 *    había que entrar a marcarlo. Nadie abre la app un jueves de descanso, así
 *    que la posición quedaba sin consumir y tapaba el paso: el viernes le
 *    aparecía "descanso" en vez de la sesión que tocaba.
 * 2. **Se desfasaba.** La rueda giraba sobre TODOS los días (5, contando el
 *    descanso) mientras la pantalla paginaba las semanas sobre los de
 *    entrenamiento (4). Cinco contra cuatro: la rutina se corría un lugar por
 *    semana. Reportado por Alejandro: "me marca el lunes la sesión que tocaba
 *    el viernes de la semana pasada".
 *
 * La regla, entonces: **la rueda gira solo sobre los días de entrenamiento.**
 * Los descansos siguen escritos en la rutina y el alumno los sigue viendo,
 * pero como recomendación entre sesiones — sin número ni casillero propio.
 * Pedido textual: "los descansos no me lo marques como día, o márcalo como
 * recomendación o algo así".
 */

type DiaCiclo = { id: string; tipo: "entrenamiento" | "descanso" };

/** Los días que numeran. Es la única definición de "cuántas sesiones tiene la
 * semana del alumno": si esta lista y la paginación de la pantalla no salen
 * del mismo lugar, vuelve el desfase. */
export function diasQueNumeran<T extends DiaCiclo>(dias: readonly T[]): T[] {
  return dias.filter((d) => d.tipo === "entrenamiento");
}

/**
 * Días de entrenamiento que llevan un descanso detrás en la rutina, para
 * dibujar la recomendación entre medio ("sesión 1, descanso, sesión 2").
 *
 * Se mira el día siguiente y no el anterior porque el descanso se recomienda
 * DESPUÉS de entrenar, que es como lo escribe el entrenador. Varios descansos
 * seguidos cuentan como uno: al alumno le da lo mismo, no es una cuenta
 * regresiva.
 */
export function descansosDespuesDe(dias: readonly DiaCiclo[]): string[] {
  return dias.flatMap((dia, i) =>
    dia.tipo === "entrenamiento" && dias[i + 1]?.tipo === "descanso" ? [dia.id] : []
  );
}

/**
 * El día que le toca a un número de la rueda. Los números empiezan en 1.
 *
 * `diasCiclo` tiene que venir ya filtrado por `diasQueNumeran`.
 */
export function diaDelNumero<T>(diasCiclo: readonly T[], numero: number): T | null {
  if (diasCiclo.length === 0 || numero < 1) return null;
  return diasCiclo[(numero - 1) % diasCiclo.length];
}

/** Qué número de sesión es dentro de su semana: 1..sesionesPorSemana. */
export function sesionDeLaSemana(numero: number, sesionesPorSemana: number): number {
  if (sesionesPorSemana < 1) return 1;
  return ((numero - 1) % sesionesPorSemana) + 1;
}

/** En qué semana cae un número. La primera es la 1, no la 0. */
export function semanaDelNumero(numero: number, sesionesPorSemana: number): number {
  if (sesionesPorSemana < 1) return 1;
  return Math.max(1, Math.ceil(numero / sesionesPorSemana));
}

/**
 * Un mes de entrenamiento son cuatro semanas.
 *
 * Es la misma cuenta con la que el plan calcula las sesiones mensuales
 * (`días/semana × 4`, ver `obtenerBalanceSesionesMes`), así que el "de 12" que
 * ve el alumno coincide con lo que tiene contratado.
 *
 * Ojo: es un bloque de cuatro semanas de SU rutina, no el mes del calendario.
 * Si entrena más lento, su semana 4 puede caer en el mes siguiente. El balance
 * mensual sigue contando por mes calendario, que es lo correcto para el cobro;
 * esto es para que el alumno se ubique.
 */
export const SEMANAS_POR_MES = 4;

export function sesionesPorMes(sesionesPorSemana: number): number {
  return Math.max(1, sesionesPorSemana) * SEMANAS_POR_MES;
}

/**
 * El número corrido de la sesión dentro del mes: 1..12 en una rutina de 3
 * días, 1..20 en una de 5.
 *
 * Pedido de Alejandro: que el alumno vea "sesión 8 de 12" y no "sesión 2",
 * porque "sesión 2" solo le dice dónde está parado dentro de la semana y no
 * cuánto lleva del mes.
 */
export function sesionDelMes(numero: number, sesionesPorSemana: number): number {
  const total = sesionesPorMes(sesionesPorSemana);
  return ((Math.max(1, numero) - 1) % total) + 1;
}

/** La semana dentro del mes: 1..4, y vuelve a 1. `semanaDelNumero` sigue
 * creciendo sin techo porque es lo que usa la navegación (?pagina=N). */
export function semanaDelMes(semanaAbsoluta: number): number {
  return ((Math.max(1, semanaAbsoluta) - 1) % SEMANAS_POR_MES) + 1;
}

/** El mes ABSOLUTO (1, 2, 3...) en el que cae un número de la rueda -- igual
 * que `semanaDelNumero` pero de a bloques de `sesionesPorMes` en vez de a
 * bloques de `sesionesPorSemana`. La pantalla de Entrenamiento la usa para
 * traer el ciclo mensual completo (12/16/20/24 días según el split) como una
 * sola tira, sin paginar semana por semana (pedido de Alejandro,
 * 2026-08-21: "quita lo de semana, déjame nada más los días"). */
export function mesDelNumero(numero: number, sesionesPorSemana: number): number {
  return Math.max(1, Math.ceil(numero / sesionesPorMes(sesionesPorSemana)));
}
