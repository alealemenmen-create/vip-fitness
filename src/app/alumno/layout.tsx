import Link from "next/link";
import { Eye } from "lucide-react";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { salirDeVistaAlumno } from "@/app/admin/alumnos/actions";
import { obtenerSesionEnProgreso } from "@/app/alumno/entrenar/data";
import {
  contarNoticiasSinVer,
  obtenerAnuncioImportanteSinVer,
  obtenerCumpleanerosDeHoy,
  asegurarNoticiasCumpleanosHoy,
  obtenerPerfilNoticias,
  type CumpleaneroHoy,
} from "@/lib/noticias/data";
import { hoyISO } from "@/lib/date";
import { obtenerCelebracionTorneoHoy } from "@/lib/torneos/data";
import { BottomNav } from "@/components/student/BottomNav";
import { BarraInferiorFija } from "@/components/student/BarraInferiorFija";
import { MenuAlumno } from "@/components/student/MenuAlumno";
import { CampanaNoticias } from "@/components/student/CampanaNoticias";
import { AplicarTemaBotonGuardado } from "@/components/student/AplicarTemaBotonGuardado";
import { AnuncioImportanteFlotante } from "@/components/student/AnuncioImportanteFlotante";
import { CelebracionTorneo } from "@/components/student/CelebracionTorneo";
import { CumpleanosFlotante } from "@/components/student/CumpleanosFlotante";
import { Logo } from "@/components/Logo";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { marcarRequest } from "@/lib/supabase/instrumentacion";
import { registrarIngresoDiario } from "@/lib/ranking/movimientos";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  marcarRequest("carga de pantalla de alumno");
  const contexto = await requireAlumno();
  const supabase = await createClient();

  // Sesión de entrenamiento en curso, si la hay: la burbuja flotante vive
  // acá para verse en cualquier pestaña, no solo en Entrenar.
  //
  // El tema del botón entra en la misma tanda que todo lo demás: antes era una
  // consulta suelta DESPUÉS de este Promise.all, y esa espera extra la pagaba
  // cada carga de cada pantalla de alumno. Además `obtenerPerfilNoticias` es
  // la misma fila que ya leen el globito de noticias y el anuncio importante,
  // deduplicada por request.
  const [
    sesionEnProgresoId,
    ,
    noticiasSinVer,
    anuncioImportante,
    celebracionTorneo,
    cumpleaneros,
    { data: perfilTema, error: errorTema },
  ] = contexto.soloLectura
    ? ([null, 0, 0, null, null, [] as CumpleaneroHoy[], { data: null, error: null }] as const)
    : await Promise.all([
        obtenerSesionEnProgreso(supabase, contexto.alumnoId),
        // Una sola recompensa por fecha. Si ya se registro hoy, el upsert no
        // suma nada. El fallo nunca debe impedir que el alumno use la app.
        registrarIngresoDiario(contexto.alumnoId).catch(() => 0),
        contarNoticiasSinVer(supabase, contexto.alumnoId),
        obtenerAnuncioImportanteSinVer(supabase, contexto.alumnoId),
        obtenerCelebracionTorneoHoy(contexto.alumnoId),
        // Con service role, no con `supabase`: leyendo con el cliente de
        // sesión, RLS le devolvía al alumno solo su PROPIA fila de
        // alumno_perfil, así que jamás veía el cumpleaños de un compañero.
        // Ver obtenerCumpleanerosDeHoy. La segunda llamada no cuesta nada:
        // asegurarNoticiasCumpleanosHoy ya dejó la lista en caché.
        asegurarNoticiasCumpleanosHoy().then(() => obtenerCumpleanerosDeHoy(hoyISO())),
        // Si esto falla (columna sin migrar, error de red) `perfilTema` queda
        // en null — eso NO debe interpretarse como "la cuenta eligió Espejo", o
        // pisaría el tema que el alumno ya tiene aplicado en este dispositivo
        // en cada carga. Ver AplicarTemaBotonGuardado: solo actúa con un valor
        // explícito, nunca ante la ausencia de dato.
        obtenerPerfilNoticias(contexto.alumnoId),
      ]);

  if (errorTema) {
    console.error("[layout] no se pudo leer tema_boton:", errorTema.message);
  }

  return (
    /* `fixed inset-0` y el scroll en un hijo (ver `.pantalla-scroll` en
       globals.css).
       En iOS Safari `overflow: hidden` sobre <body> NO alcanza: el documento
       igual se arrastra y rebota, y mientras dura ese gesto Safari desengancha
       todo lo `position: fixed` y lo vuelve a su lugar recién al levantar el
       dedo. Eso es lo que hacía que la barra de íconos y la cabecera se
       movieran al deslizar. Sacando el shell del flujo con `fixed` no queda
       documento que arrastrar. */
    <div className="shell-alumno fixed inset-0 flex flex-col overflow-hidden bg-bg">
      {contexto.soloLectura && (
        <div className="imprimir-oculto z-10 flex shrink-0 items-center justify-between gap-2 bg-vip px-4 py-3">
          <span className="text-caption flex items-center gap-1.5 text-black">
            <Eye size={16} />
            Viendo como {nombreAlumnoPublicado(contexto.nombre)} · modo solo lectura
          </span>
          <form action={salirDeVistaAlumno}>
            <button type="submit" className="text-caption font-semibold text-black underline">
              Volver al panel
            </button>
          </form>
        </div>
      )}

      {/* SIN padding-top. Un elemento `sticky` está confinado a su bloque
          contenedor, que es el content box de este div — o sea, lo que queda
          DESPUÉS del padding. Con `pt-1` acá, la cabecera de abajo no podía
          anclarse en el borde real: se quedaba 4px más abajo y por esa
          ventanita desfilaba el contenido al scrollear (se veía una franja
          con trozos de tarjetas entre el logo y la hora del teléfono, en
          Inicio, Progreso, Ranked y la sesión de entrenamiento). El aire
          sobre el logo lo pone la cabecera con su propio `pt-1`. */}
      <div className="pantalla-scroll mx-auto w-full max-w-md px-4 pb-24">
        {/* El menú vive DENTRO de la placa dorada: una sola pieza de ancho
            completo, sin el botón morado que la interrumpía. La campanita va
            al lado, para que las novedades se vean desde cualquier pantalla.

            Queda clavado arriba en todas las pestañas: la campanita y el
            engranaje son las dos únicas salidas de la pantalla, y al scrollear
            una sesión de siete ejercicios había que volver hasta arriba para
            encontrarlas. El alto de este bloque está en --alto-cabecera-alumno
            (globals.css), que es lo que usan las cabeceras de cada pestaña para
            pegarse justo debajo sin taparse. */}
        <div className="imprimir-oculto sticky top-0 z-30 -mx-4 bg-bg px-4 pb-2 pt-1">
          <Logo
            compact
            corner={
              <div className="flex items-center gap-2">
                <CampanaNoticias sinVer={noticiasSinVer} />
                <MenuAlumno nombre={nombreAlumnoPublicado(contexto.nombre)} />
              </div>
            }
          />
        </div>
        {children}
      </div>
      {/* z-40: por encima de las cabeceras fijas (z-30) y de cualquier tarjeta.
          Sin un z explícito la barra quedaba a merced del orden del DOM, y en
          Android las filas de serie encendidas en ámbar —que tienen sombra y
          contexto de apilado propio— se colaban por encima de los íconos al
          hacer scroll. */}
      <div className="imprimir-oculto">
        <BarraInferiorFija>
          <BottomNav sesionEnProgresoId={sesionEnProgresoId} />
          {contexto.rolSesion !== "alumno" && !contexto.soloLectura && (
            <Link
              href="/admin/alumnos"
              className="block w-full bg-bg py-1 text-center text-[11px] text-text-tertiary"
            >
              Volver al panel de entrenador
            </Link>
          )}
        </BarraInferiorFija>

        {/* La burbuja flotante "Volver a rutina" se sacó: la pestaña Entrenar ya
            lleva a la sesión en curso (ver BottomNav), así que era un segundo
            botón para lo mismo — y encima quedaba justo encima del buscador fijo
            de Nutrición, que es una de las pantallas donde aparecía. */}
        {anuncioImportante && <AnuncioImportanteFlotante anuncio={anuncioImportante} />}
        {celebracionTorneo && <CelebracionTorneo celebracion={celebracionTorneo} />}
        <CumpleanosFlotante cumpleaneros={cumpleaneros} />
      </div>
      <AplicarTemaBotonGuardado temaGuardado={errorTema ? undefined : perfilTema?.tema_boton} />
    </div>
  );
}
