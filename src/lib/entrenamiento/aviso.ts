/**
 * Aviso de fin de descanso: vibración más un pitido corto.
 *
 * Durante mucho tiempo la app fue muda a propósito ("que nunca suene en el
 * gimnasio"). El usuario cambió de idea: con el teléfono apoyado en el banco y
 * el gimnasio con música, la vibración sola se pierde. Así que ahora suena,
 * pero corto y una sola vez — es un aviso, no una alarma.
 *
 * El sonido se genera con Web Audio en vez de un archivo: son dos tonos, no
 * justifica sumar un .mp3 al bundle ni una petición de red que puede llegar
 * tarde justo cuando hace falta.
 */

/** Duración total de la tanda de vibración, en milisegundos. */
const VIBRACION: number[] = [
  260, 120, 260, 120, 260, 340, 260, 120, 260, 120, 260, 340, 400,
];

let contexto: AudioContext | null = null;
/** Todo lo que está sonando ahora, para poder cortarlo de golpe. */
let sonando: { osc: OscillatorNode; gain: GainNode }[] = [];

/**
 * Deja el audio listo para poder sonar más tarde.
 *
 * Los navegadores de celular solo permiten crear o reanudar un AudioContext
 * dentro de un gesto del usuario. El fin del descanso ocurre en un temporizador,
 * que NO es un gesto: si esperáramos hasta ese momento, el pitido no sonaría
 * nunca. Por eso esto se llama al tocar "Recupérate", que sí lo es.
 */
export function prepararAviso() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    contexto ??= new Ctor();
    if (contexto.state === "suspended") void contexto.resume();
  } catch {
    // Sin audio disponible se sigue avisando por vibración.
  }
}

/** Un tono con entrada y salida suaves — un tono pelado arranca y corta con un
 * chasquido bastante feo en el parlante del celular. */
function tono(desde: number, hz: number, duracion: number) {
  if (!contexto) return;
  const osc = contexto.createOscillator();
  const gain = contexto.createGain();
  osc.type = "sine";
  osc.frequency.value = hz;

  const t = contexto.currentTime + desde;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
  gain.gain.setValueAtTime(0.22, t + duracion - 0.05);
  gain.gain.linearRampToValueAtTime(0, t + duracion);

  osc.connect(gain).connect(contexto.destination);
  osc.start(t);
  osc.stop(t + duracion);
  sonando.push({ osc, gain });
  osc.onended = () => {
    sonando = sonando.filter((s) => s.osc !== osc);
  };
}

/** Vibra y suena. Se llama cuando la cuenta regresiva llega a cero. */
export function avisarFinDescanso() {
  try {
    navigator.vibrate?.(VIBRACION);
  } catch {
    // Si el navegador no permite vibrar, no pasa nada.
  }

  // Dos notas ascendentes: se reconoce como "listo, seguí" y no como el
  // mensaje entrante de cualquier otra app.
  tono(0, 880, 0.16);
  tono(0.2, 1175, 0.26);
}

/**
 * Corta el aviso ya mismo.
 *
 * Se llama apenas el alumno toca la pantalla o vuelve a la app: si ya se dio
 * cuenta de que terminó el descanso, seguir vibrando y sonando cuatro segundos
 * más solo molesta.
 */
export function cortarAviso() {
  try {
    navigator.vibrate?.(0);
  } catch {
    // Ídem.
  }
  for (const { osc, gain } of sonando) {
    try {
      // Bajar la ganancia antes de parar evita el chasquido del corte seco.
      gain.gain.cancelScheduledValues(contexto?.currentTime ?? 0);
      gain.gain.linearRampToValueAtTime(0, (contexto?.currentTime ?? 0) + 0.03);
      osc.stop((contexto?.currentTime ?? 0) + 0.04);
    } catch {
      // El oscilador ya terminó solo.
    }
  }
  sonando = [];
}
