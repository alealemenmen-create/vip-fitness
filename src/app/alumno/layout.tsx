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
import { MenuAlumno } from "@/components/student/MenuAlumno";
import { CampanaNoticias } from "@/components/student/CampanaNoticias";
import { AplicarTemaBotonGuardado } from "@/components/student/AplicarTemaBotonGuardado";
import { AnuncioImportanteFlotante } from "@/components/student/AnuncioImportanteFlotante";
import { CelebracionTorneo } from "@/components/student/CelebracionTorneo";
import { CumpleanosFlotante } from "@/components/student/CumpleanosFlotante";
import { Logo } from "@/components/Logo";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { marcarRequest } from "@/lib/supabase/instrumentacion";

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
    noticiasSinVer,
    anuncioImportante,
    celebracionTorneo,
    cumpleaneros,
    { data: perfilTema, error: errorTema },
  ] = contexto.soloLectura
    ? ([null, 0, null, null, [] as CumpleaneroHoy[], { data: null, error: null }] as const)
    : await Promise.all([
        obtenerSesionEnProgreso(supabase, contexto.alumnoId),
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
    <div className="flex min-h-screen flex-col bg-bg">
      {contexto.soloLectura && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-vip px-4 py-3">
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

      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-1">
        {/* El menú vive DENTRO de la placa dorada: una sola pieza de ancho
            completo, sin el botón morado que la interrumpía. La campanita va
            al lado, para que las novedades se vean desde cualquier pantalla. */}
        <Logo
          compact
          className="mb-3"
          corner={
            <div className="flex items-center gap-2">
              <CampanaNoticias sinVer={noticiasSinVer} />
              <MenuAlumno nombre={nombreAlumnoPublicado(contexto.nombre)} />
            </div>
          }
        />
        {children}
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-md">
        <BottomNav sesionEnProgresoId={sesionEnProgresoId} />
        {contexto.rolSesion !== "alumno" && !contexto.soloLectura && (
          <Link
            href="/admin/alumnos"
            className="block w-full bg-bg py-1 text-center text-[11px] text-text-tertiary"
          >
            Volver al panel de entrenador
          </Link>
        )}
      </div>

      {/* La burbuja flotante "Volver a rutina" se sacó: la pestaña Entrenar ya
          lleva a la sesión en curso (ver BottomNav), así que era un segundo
          botón para lo mismo — y encima quedaba justo encima del buscador fijo
          de Nutrición, que es una de las pantallas donde aparecía. */}
      {anuncioImportante && <AnuncioImportanteFlotante anuncio={anuncioImportante} />}
      {celebracionTorneo && <CelebracionTorneo celebracion={celebracionTorneo} />}
      <CumpleanosFlotante cumpleaneros={cumpleaneros} />
      <AplicarTemaBotonGuardado temaGuardado={errorTema ? undefined : perfilTema?.tema_boton} />
    </div>
  );
}
