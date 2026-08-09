import Image from "next/image";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";

const ETIQUETAS: Record<GrupoMuscular, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

const LINEA = "var(--color-text-secondary)";
const RELLENO = "color-mix(in srgb, var(--color-text) 10%, transparent)";
const RESALTE = "var(--color-text)";
const RESALTE_SUAVE = "color-mix(in srgb, var(--color-text) 26%, transparent)";

/** Figura anatómica atlética, dibujada en blanco y negro. La base es la misma
 * para todos los grupos y la zona trabajada gana contraste sin usar bloques
 * de color ni un estilo de muñeco geométrico. */
function Silueta({ grupo, alto = 26 }: { grupo: GrupoMuscular; alto?: number }) {
  const activa = (zona: GrupoMuscular | GrupoMuscular[]) =>
    Array.isArray(zona) ? zona.includes(grupo) : zona === grupo;
  const relleno = (zona: GrupoMuscular | GrupoMuscular[]) =>
    activa(zona) ? RESALTE_SUAVE : RELLENO;
  const linea = (zona: GrupoMuscular | GrupoMuscular[]) =>
    activa(zona) ? RESALTE : LINEA;

  return (
    <svg
      viewBox="0 0 64 120"
      width={Math.round(alto * 0.72)}
      height={alto}
      fill="none"
      aria-hidden
    >
      {/* Cabeza y cuello */}
      <ellipse cx="32" cy="10" rx="7.2" ry="8.2" fill={RELLENO} stroke={LINEA} strokeWidth="1.5" />
      <path d="M28 18.5v5.2M36 18.5v5.2" stroke={LINEA} strokeWidth="1.4" strokeLinecap="round" />

      {/* Torso atlético: hombros anchos, dorsales y cintura marcada */}
      <path
        d="M27.5 22.5c-5.2.8-10.8 2.5-14.7 6.3-1.8 1.8-2.7 5.2-2.2 8.2l4.2 23.2c.5 3 2.9 5.1 5.7 5.1h4.2l1.3 8.2h12l1.3-8.2h4.2c2.8 0 5.2-2.1 5.7-5.1L53.4 37c.5-3-.4-6.4-2.2-8.2-3.9-3.8-9.5-5.5-14.7-6.3-1.1 2.1-2.6 3.2-4.5 3.2s-3.4-1.1-4.5-3.2Z"
        fill={relleno(["pecho", "espalda", "core"])}
        stroke={linea(["pecho", "espalda", "core", "hombros"])}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Deltoides */}
      <path d="M27 25.2c-5.8-.6-10.2 1.2-13.4 5.2 2.9 4 7.2 5.2 11.4 3.3" fill={relleno("hombros")} stroke={linea("hombros")} strokeWidth="1.4" />
      <path d="M37 25.2c5.8-.6 10.2 1.2 13.4 5.2-2.9 4-7.2 5.2-11.4 3.3" fill={relleno("hombros")} stroke={linea("hombros")} strokeWidth="1.4" />

      {/* Pectorales y dorsales laterales */}
      <path d="M18.5 35.2c4.1-3.2 8.7-4 13.5-.8v11.2c-5.4.9-10.2-.8-13.5-4.3Z" fill={relleno("pecho")} stroke={linea("pecho")} strokeWidth="1.25" />
      <path d="M45.5 35.2c-4.1-3.2-8.7-4-13.5-.8v11.2c5.4.9 10.2-.8 13.5-4.3Z" fill={relleno("pecho")} stroke={linea("pecho")} strokeWidth="1.25" />
      <path d="M18 42.5c1.2 7.6 3.1 13.5 7.6 18" stroke={linea("espalda")} strokeWidth="2" strokeLinecap="round" />
      <path d="M46 42.5c-1.2 7.6-3.1 13.5-7.6 18" stroke={linea("espalda")} strokeWidth="2" strokeLinecap="round" />

      {/* Abdomen segmentado */}
      <path d="M32 46v23M25.8 50.5h12.4M25 57h14M25 63.5h14" stroke={linea("core")} strokeWidth="1.15" strokeLinecap="round" />

      {/* Brazos anatómicos */}
      <path
        d="M12.8 31.2c-3.4 1.7-5.2 4.8-5.8 9.6L3.8 63.5c-.5 3.3.2 6 2.2 8.3l2.7 3c1 1.1 2.8.4 2.8-1.1l-.3-4.5 5.1-22.4c1.3-5.8.5-11.1-3.5-15.6Z"
        fill={relleno("brazos")}
        stroke={linea("brazos")}
        strokeWidth="1.6"
      />
      <path
        d="M51.2 31.2c3.4 1.7 5.2 4.8 5.8 9.6l3.2 22.7c.5 3.3-.2 6-2.2 8.3l-2.7 3c-1 1.1-2.8.4-2.8-1.1l.3-4.5-5.1-22.4c-1.3-5.8-.5-11.1 3.5-15.6Z"
        fill={relleno("brazos")}
        stroke={linea("brazos")}
        strokeWidth="1.6"
      />
      <path d="M8.1 48.5c2.1 1.6 4.4 2.1 7 1.2M55.9 48.5c-2.1 1.6-4.4 2.1-7 1.2" stroke={linea("brazos")} strokeWidth="1.1" />

      {/* Pelvis y piernas musculares */}
      <path d="M25.8 70.5 20.7 78l3.2 6.5h16.2l3.2-6.5-5.1-7.5Z" fill={relleno("piernas")} stroke={linea("piernas")} strokeWidth="1.5" />
      <path
        d="M24 82.5c-3.2 7.7-3.8 14.8-2 21.2l1.1 10.9c.2 2 1.6 3.4 3.5 3.4h2.2l2.1-16.7L31 83Z"
        fill={relleno("piernas")}
        stroke={linea("piernas")}
        strokeWidth="1.6"
      />
      <path
        d="M40 82.5c3.2 7.7 3.8 14.8 2 21.2l-1.1 10.9c-.2 2-1.6 3.4-3.5 3.4h-2.2l-2.1-16.7L33 83Z"
        fill={relleno("piernas")}
        stroke={linea("piernas")}
        strokeWidth="1.6"
      />
      <path d="M23 94.5c2.3 1.5 4.8 1.7 7.4.5M41 94.5c-2.3 1.5-4.8 1.7-7.4.5" stroke={linea("piernas")} strokeWidth="1.1" />

      {/* Cardio: pulso médico discreto */}
      {grupo === "cardio" && (
        <path
          d="M17 45h8l3-6 5.2 13 3.5-7H47"
          stroke={RESALTE}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function GrupoMuscularIcon({
  grupo,
  conEtiqueta = false,
  alto,
}: {
  grupo: GrupoMuscular;
  conEtiqueta?: boolean;
  alto?: number;
}) {
  if (conEtiqueta) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Silueta grupo={grupo} alto={alto} />
        <span className="text-caption text-text-tertiary">{ETIQUETAS[grupo]}</span>
      </div>
    );
  }
  return <Silueta grupo={grupo} alto={alto} />;
}

export { ETIQUETAS as ETIQUETAS_GRUPO_MUSCULAR };

/**
 * Fondo de las miniaturas de grupo muscular.
 *
 * Las fotos son de estudio SOBRE FONDO NEGRO y el recorte que les quitó el
 * fondo no pudo separar del todo el cuerpo: la barba, el short y las sombras
 * son casi tan negras como el fondo, y zonas del interior quedaron
 * transparentes conectadas con el borde (el hueco entre las piernas, por
 * ejemplo), así que no hay relleno de agujeros que las recupere.
 *
 * Sobre negro eso deja de importar: lo transparente vuelve a ser el mismo
 * negro del estudio y la miniatura se ve igual que la foto original. Por eso
 * el fondo es negro fijo en los dos temas, y no `bg-surface`.
 */
const FONDO_FOTO = "#000000";

/**
 * Foto real de un grupo, en un círculo negro. Si el grupo no tiene foto
 * todavía (hoy solo Cardio), cae al dibujo anatómico de siempre — no deja el
 * hueco vacío.
 */
export function FotoGrupoMuscular({
  grupo,
  tamano = 48,
  className = "",
}: {
  grupo: GrupoMuscular;
  tamano?: number;
  className?: string;
}) {
  const fotos = FOTOS_GRUPO_MUSCULAR[grupo];
  if (!fotos) return <GrupoMuscularIcon grupo={grupo} alto={tamano} />;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: tamano, height: tamano, background: FONDO_FOTO }}
    >
      {/* `object-contain`, no `object-cover`: el modelo entero adentro del
          círculo, como una foto de estudio con su propio fondo — no un zoom
          a un pedazo de músculo. Un recorte apretado (cover + posición por
          grupo, lo que había antes) terminaba mostrando manos y piernas
          sueltas, sin que se reconociera la figura. */}
      <Image
        src={fotos[0]}
        alt={ETIQUETAS[grupo]}
        fill
        sizes={`${tamano}px`}
        className="object-contain"
      />
    </div>
  );
}

export { FONDO_FOTO as FONDO_FOTO_GRUPO };

/**
 * Arreglo de fotos para la tarjeta principal del día en Entrenar: el grupo
 * principal (el primero de la lista) ocupa el lado derecho de la tarjeta de
 * punta a punta; si además se trabajan otros grupos ese día, se suman como
 * miniaturas circulares arriba a la izquierda, sobre el degradado. Piernas
 * muestra sus dos fotos (frente + espalda) lado a lado como "principal".
 * Si el grupo principal no tiene foto (Cardio), se mantiene el dibujo de
 * siempre — no se inventa nada para no tener imagen.
 */
/** Rayos de luz diagonales, decorativos, detrás de la foto del día — el
 * mismo motivo cálido que enmarca al modelo en la referencia. Puramente
 * ornamental (aria-hidden), no compite con el texto porque vive detrás del
 * degradado hacia la superficie. */
function RayosLuz() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 opacity-25" viewBox="0 0 300 168" preserveAspectRatio="none">
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={340 - i * 34}
          y1={-20}
          x2={140 - i * 34}
          y2={190}
          stroke="var(--color-vip)"
          strokeWidth={i === 2 ? 3 : 1.4}
        />
      ))}
    </svg>
  );
}

export function FotoDiaEntrenamiento({ grupos }: { grupos: GrupoMuscular[] }) {
  const [principal] = grupos;
  const fotosPrincipal = principal ? FOTOS_GRUPO_MUSCULAR[principal] : undefined;

  if (!principal || !fotosPrincipal) {
    return principal ? (
      <div className="pointer-events-none absolute right-4 top-3 opacity-30">
        <GrupoMuscularIcon grupo={principal} alto={128} />
      </div>
    ) : null;
  }

  const anchoFoto = 108;
  const anchoTotal = fotosPrincipal.length * anchoFoto;

  return (
    <>
      <div
        className={`foto-modelo-integrada foto-modelo-${principal} pointer-events-none absolute inset-y-0 right-6 flex items-center`}
        style={{ width: anchoTotal }}
      >
        {fotosPrincipal.map((src) => (
          <div key={src} className="relative h-full flex-1">
            <Image src={src} alt="" fill sizes="108px" className="object-contain object-bottom" />
          </div>
        ))}
      </div>
      <RayosLuz />
      {/* Degradado hacia la superficie de la tarjeta, para que el título y el
          subtítulo de la izquierda sigan leyéndose sobre la foto. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{
          width: anchoTotal + 56,
          background: "linear-gradient(to right, var(--color-surface) 0%, transparent 60%)",
        }}
      />
      {/* Insignia del grupo principal, arriba a la izquierda: el mismo dibujo
          anatómico de siempre (no una foto — a ese tamaño una foto recortada
          no se reconoce), con resplandor cálido, igual que la referencia. */}
      <div
        className="pointer-events-none absolute left-4 top-3"
        style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-vip) 55%, transparent))" }}
      >
        <GrupoMuscularIcon grupo={principal} alto={40} />
      </div>
    </>
  );
}
