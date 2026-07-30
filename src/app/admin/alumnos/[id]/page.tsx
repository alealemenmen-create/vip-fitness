import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { entrarComoAlumno, eliminarAlumno, actualizarCorreoPerfil } from "@/app/admin/alumnos/actions";
import { NombreEditable } from "@/components/admin/NombreEditable";
import { EliminarPerfilBoton } from "@/components/admin/EliminarPerfilBoton";
import { CambiarCorreoForm } from "@/components/admin/CambiarCorreoForm";
import { Card } from "@/components/ui/Card";
import { PerfilAlumnoForm } from "@/components/admin/PerfilAlumnoForm";
import { CredencialesAlumno } from "@/components/admin/CredencialesAlumno";
import { DatosPersonalesSoloLectura } from "@/components/admin/DatosPersonalesSoloLectura";
import { NotasManager } from "@/components/admin/NotasManager";
import { ArchivosManager } from "@/components/admin/ArchivosManager";

/** Desde aquí se analiza un PDF con IA y se publica la rutina, y las dos cosas
 * tardan más que el límite por defecto de Vercel (10 s): el análisis ronda los
 * 5 s y puede subir con un PDF grande. Sin esto, la función se corta a mitad y
 * el botón queda "Publicando…" para siempre. */
export const maxDuration = 60;
import { PesoCorporalSoloLectura } from "@/components/admin/PesoCorporalSoloLectura";
import { FotosSoloLectura } from "@/components/admin/FotosSoloLectura";
import { HistorialEntrenamiento } from "@/components/admin/HistorialEntrenamiento";
import { ResumenComidas } from "@/components/admin/ResumenComidas";
import { SeguimientoDiarioSoloLectura } from "@/components/admin/SeguimientoDiarioSoloLectura";
import { obtenerHistorialPeso, obtenerFotosProgreso } from "@/app/alumno/progreso/data";
import { obtenerRutinaActiva, obtenerHistorialSesiones } from "@/app/alumno/entrenar/data";
import { obtenerResumenComidas } from "@/app/alumno/comer/data";
import { obtenerHistorialSeguimientos } from "@/app/alumno/inicio/data";
import { obtenerDatosPersonales } from "@/app/alumno/perfil/data";
import { obtenerIndicadores } from "@/app/admin/alumnos/data";
import { DetalleEstadoAlumno } from "@/components/admin/IndicadorEstadoAlumno";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function AlumnoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol(["entrenador", "admin"]);
  const { id: alumnoId } = await params;
  const supabase = await createClient();

  const [
    { data: perfil },
    { data: alumnoPerfil },
    { data: notas },
    { data: documentos },
    historialPeso,
    fotos,
    rutinaActiva,
    sesiones,
    resumenComidas,
    seguimientos,
    datosPersonales,
  ] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", alumnoId).single(),
    supabase
      .from("alumno_perfil")
      .select("objetivo, proximo_control_fecha")
      .eq("user_id", alumnoId)
      .maybeSingle(),
    supabase
      .from("notas_entrenador")
      .select(
        "id, texto, fecha_inicio, fecha_fin, importante, marcar_nueva, leida_en, generado_con_ia, autor"
      )
      .eq("alumno_id", alumnoId)
      .order("created_at", { ascending: false }),
    supabase
      .from("documentos")
      .select("id, alumno_id, tipo, nombre_archivo, fecha_carga")
      .eq("alumno_id", alumnoId)
      .eq("activo", true)
      .order("fecha_carga", { ascending: false }),
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerFotosProgreso(supabase, alumnoId),
    obtenerRutinaActiva(alumnoId),
    obtenerHistorialSesiones(supabase, alumnoId),
    obtenerResumenComidas(supabase, alumnoId),
    obtenerHistorialSeguimientos(supabase, alumnoId),
    obtenerDatosPersonales(supabase, alumnoId),
  ]);

  // Marca como vistas las notas que generó la IA para este alumno, ahora que
  // el entrenador abrió su ficha (apaga el aviso de "La IA le dejó nota a").
  const notasIASinVer = (notas ?? []).filter((n) => n.generado_con_ia && !n.leida_en).map((n) => n.id);
  if (notasIASinVer.length > 0) {
    await supabase
      .from("notas_entrenador")
      .update({ leida_en: new Date().toISOString() })
      .in("id", notasIASinVer);
  }

  const indicador = (await obtenerIndicadores(supabase, [alumnoId])).get(alumnoId);

  if (!perfil) {
    return (
      <Card>
        <p className="text-body text-text-secondary">No se encontró este alumno.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/alumnos" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <h1 className="text-h3 text-text">{nombreAlumnoPublicado(perfil.nombre)}</h1>
      </Link>

      {indicador && (
        <Card>
          <p className="text-caption mb-3 text-text-tertiary">ESTADO DEL ALUMNO</p>
          <DetalleEstadoAlumno indicador={indicador} />
        </Card>
      )}

      <form action={entrarComoAlumno}>
        <input type="hidden" name="alumno_id" value={alumnoId} />
        <button
          type="submit"
          className="radius-control flex h-14 w-full items-center justify-center gap-2 bg-vip text-body font-medium text-black"
        >
          <Eye size={18} /> Ver portal completo
        </button>
      </form>

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">NOMBRE</p>
        <NombreEditable perfilId={alumnoId} nombre={perfil.nombre} />
      </Card>

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">PERFIL</p>
        <PerfilAlumnoForm
          alumnoId={alumnoId}
          objetivo={alumnoPerfil?.objetivo ?? null}
          proximoControlFecha={alumnoPerfil?.proximo_control_fecha ?? null}
        />
      </Card>

      <DatosPersonalesSoloLectura datos={datosPersonales} />

      <CredencialesAlumno alumnoId={alumnoId} />

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">CORREO DE ACCESO</p>
        <CambiarCorreoForm
          accion={actualizarCorreoPerfil}
          camposOcultos={{ perfil_id: alumnoId }}
        />
      </Card>

      <NotasManager alumnoId={alumnoId} notasIniciales={notas ?? []} />

      <p className="text-caption pt-2 text-text-tertiary">ACTIVIDAD DEL ALUMNO</p>
      <PesoCorporalSoloLectura historial={historialPeso} />
      <FotosSoloLectura fotos={fotos} />
      <HistorialEntrenamiento rutinaActivaNombre={rutinaActiva?.nombre ?? null} sesiones={sesiones} />
      <ResumenComidas resumen={resumenComidas} />
      <SeguimientoDiarioSoloLectura seguimientos={seguimientos} />

      <p className="text-caption pt-2 text-text-tertiary">RUTINA Y ALIMENTACIÓN</p>
      <ArchivosManager alumnoId={alumnoId} documentos={documentos ?? []} />

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">ZONA DE RIESGO</p>
        <EliminarPerfilBoton
          accion={eliminarAlumno}
          campoId="alumno_id"
          valorId={alumnoId}
          etiqueta="Eliminar alumno"
          advertencia={`Esto borra para siempre la cuenta de ${nombreAlumnoPublicado(
            perfil.nombre
          )}: su acceso, rutinas, comidas, seguimiento, notas y ranking. No se puede deshacer.`}
        />
      </Card>
    </div>
  );
}
