export const SECCIONES_PORTAL = ["entrenamiento", "nutricion", "progreso", "mas"] as const;
export type SeccionPortalId = (typeof SECCIONES_PORTAL)[number];

export const TARJETAS_ENTRENAMIENTO = ["rutina", "biblioteca", "programas", "historial", "impulso", "preparacion"] as const;
export type TarjetaEntrenamientoId = (typeof TARJETAS_ENTRENAMIENTO)[number];

export type ConfiguracionEstudioVip = {
  esquema: 1;
  marca: {
    nombre: string;
    subtitulo: string;
  };
  tema: {
    colorAcento: string;
    colorFondo: string;
  };
  entrenamiento: {
    etiquetaFase: string;
    textoBotonIniciar: string;
    imagenPortadaUrl: string;
    aviso: {
      visible: boolean;
      titulo: string;
      texto: string;
      botonTexto: string;
      botonHref: string;
    };
  };
  navegacion: Array<{
    id: SeccionPortalId;
    etiqueta: string;
    visible: boolean;
  }>;
  tarjetas: Record<TarjetaEntrenamientoId, {
    visible: boolean;
    titulo: string;
    detalle: string;
  }>;
};

export type DocumentoEstudioVip = {
  esquema: 1;
  version: number;
  actualizadoEn: string;
  actualizadoPor: string;
  configuracion: ConfiguracionEstudioVip;
};

export const CONFIGURACION_ESTUDIO_VIP_INICIAL: ConfiguracionEstudioVip = {
  esquema: 1,
  marca: {
    nombre: "VIP Fitness",
    subtitulo: "Tu entrenamiento, progreso y nutricion en un solo lugar",
  },
  tema: {
    colorAcento: "#22d3a0",
    colorFondo: "#090b0a",
  },
  entrenamiento: {
    etiquetaFase: "Fase activa",
    textoBotonIniciar: "Iniciar dia",
    imagenPortadaUrl: "",
    aviso: {
      visible: false,
      titulo: "",
      texto: "",
      botonTexto: "",
      botonHref: "",
    },
  },
  navegacion: [
    { id: "entrenamiento", etiqueta: "Entrenar", visible: true },
    { id: "nutricion", etiqueta: "Nutricion", visible: true },
    { id: "progreso", etiqueta: "Progreso", visible: true },
    { id: "mas", etiqueta: "Mas", visible: true },
  ],
  tarjetas: {
    rutina: { visible: true, titulo: "Rutina asignada", detalle: "Revisa tu sesion completa" },
    biblioteca: { visible: true, titulo: "Biblioteca de ejercicios", detalle: "Tecnica, videos y consejos" },
    programas: { visible: true, titulo: "Mis programas", detalle: "Programa actual y recorrido" },
    historial: { visible: true, titulo: "Registro de entrenamientos", detalle: "Revisa tus sesiones anteriores" },
    impulso: { visible: true, titulo: "Impulso VIP", detalle: "Tu sesion activa objetivos y ajustes segun tu rendimiento." },
    preparacion: { visible: true, titulo: "Preparacion de hoy", detalle: "Calentamiento, tecnica y movilidad" },
  },
};

const ETIQUETAS_NAVEGACION: Record<SeccionPortalId, string> = {
  entrenamiento: "Entrenar",
  nutricion: "Nutricion",
  progreso: "Progreso",
  mas: "Mas",
};

function texto(valor: unknown, respaldo: string, maximo: number) {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) || respaldo : respaldo;
}

function textoOpcional(valor: unknown, maximo: number) {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
}

function color(valor: unknown, respaldo: string) {
  return typeof valor === "string" && /^#[0-9a-f]{6}$/i.test(valor) ? valor.toLowerCase() : respaldo;
}

function urlSegura(valor: unknown) {
  if (typeof valor !== "string") return "";
  const limpia = valor.trim().slice(0, 1000);
  if (!limpia) return "";
  if (limpia.startsWith("/") && !limpia.startsWith("//")) return limpia;
  try {
    return new URL(limpia).protocol === "https:" ? limpia : "";
  } catch {
    return "";
  }
}

/** La misma normalizacion protege guardado, publicacion y lectura del portal. */
export function normalizarConfiguracionEstudioVip(valor: unknown): ConfiguracionEstudioVip {
  const entrada = valor && typeof valor === "object" ? valor as Partial<ConfiguracionEstudioVip> : {};
  const marca = (entrada.marca && typeof entrada.marca === "object" ? entrada.marca : {}) as Partial<ConfiguracionEstudioVip["marca"]>;
  const tema = (entrada.tema && typeof entrada.tema === "object" ? entrada.tema : {}) as Partial<ConfiguracionEstudioVip["tema"]>;
  const entrenamiento = (entrada.entrenamiento && typeof entrada.entrenamiento === "object" ? entrada.entrenamiento : {}) as Partial<ConfiguracionEstudioVip["entrenamiento"]>;
  const aviso = (entrenamiento.aviso && typeof entrenamiento.aviso === "object" ? entrenamiento.aviso : {}) as Partial<ConfiguracionEstudioVip["entrenamiento"]["aviso"]>;
  const tarjetasEntrada = (entrada.tarjetas && typeof entrada.tarjetas === "object" ? entrada.tarjetas : {}) as Partial<ConfiguracionEstudioVip["tarjetas"]>;

  const navegacionEntrada = Array.isArray(entrada.navegacion) ? entrada.navegacion : [];
  const porId = new Map(navegacionEntrada
    .filter((item): item is ConfiguracionEstudioVip["navegacion"][number] => Boolean(item && SECCIONES_PORTAL.includes(item.id)))
    .map((item) => [item.id, item]));
  const orden = [
    ...navegacionEntrada.map((item) => item?.id).filter((id): id is SeccionPortalId => SECCIONES_PORTAL.includes(id as SeccionPortalId)),
    ...SECCIONES_PORTAL,
  ].filter((id, indice, lista) => lista.indexOf(id) === indice);

  const tarjetas = Object.fromEntries(TARJETAS_ENTRENAMIENTO.map((id) => {
    const base = CONFIGURACION_ESTUDIO_VIP_INICIAL.tarjetas[id];
    const candidata = (tarjetasEntrada[id] && typeof tarjetasEntrada[id] === "object" ? tarjetasEntrada[id] : {}) as Partial<ConfiguracionEstudioVip["tarjetas"][TarjetaEntrenamientoId]>;
    return [id, {
      visible: typeof candidata.visible === "boolean" ? candidata.visible : base.visible,
      titulo: texto(candidata.titulo, base.titulo, 70),
      detalle: texto(candidata.detalle, base.detalle, 140),
    }];
  })) as ConfiguracionEstudioVip["tarjetas"];

  return {
    esquema: 1,
    marca: {
      nombre: texto(marca.nombre, CONFIGURACION_ESTUDIO_VIP_INICIAL.marca.nombre, 50),
      subtitulo: texto(marca.subtitulo, CONFIGURACION_ESTUDIO_VIP_INICIAL.marca.subtitulo, 160),
    },
    tema: {
      colorAcento: color(tema.colorAcento, CONFIGURACION_ESTUDIO_VIP_INICIAL.tema.colorAcento),
      colorFondo: color(tema.colorFondo, CONFIGURACION_ESTUDIO_VIP_INICIAL.tema.colorFondo),
    },
    entrenamiento: {
      etiquetaFase: texto(entrenamiento.etiquetaFase, CONFIGURACION_ESTUDIO_VIP_INICIAL.entrenamiento.etiquetaFase, 50),
      textoBotonIniciar: texto(entrenamiento.textoBotonIniciar, CONFIGURACION_ESTUDIO_VIP_INICIAL.entrenamiento.textoBotonIniciar, 35),
      imagenPortadaUrl: urlSegura(entrenamiento.imagenPortadaUrl),
      aviso: {
        visible: aviso.visible === true,
        titulo: textoOpcional(aviso.titulo, 80),
        texto: textoOpcional(aviso.texto, 240),
        botonTexto: textoOpcional(aviso.botonTexto, 35),
        botonHref: urlSegura(aviso.botonHref),
      },
    },
    navegacion: orden.map((id) => {
      const candidata = porId.get(id);
      return {
        id,
        etiqueta: texto(candidata?.etiqueta, ETIQUETAS_NAVEGACION[id], 18),
        visible: id === "entrenamiento" ? true : candidata?.visible !== false,
      };
    }),
    tarjetas,
  };
}
