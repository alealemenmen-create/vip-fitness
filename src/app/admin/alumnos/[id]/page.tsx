import Link from "next/link";
import { Activity, ArrowLeft, Eye } from "lucide-react";
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
import { PesoCorporalSoloLectura } from "@/components/admin/PesoCorporalSoloLectura";
import { FotosSoloLectura } from "@/components/admin/FotosSoloLectura";
import { HistorialEntrenamiento } from "@/components/admin/HistorialEntrenamiento";
import { HistorialPuntosAlumno } from "@/components/admin/HistorialPuntosAlumno";
import { CopiarRutinaAlumno } from "@/components/admin/CopiarRutinaAlumno";
import { AplicarRutinaAOtrosAlumnos } from "@/components/admin/AplicarRutinaAOtrosAlumnos";
import { FichaAlumnoAdmin } from "@/components/admin/FichaAlumnoAdmin";
import { leerFicha } from "@/lib/perfil-alumno/datos";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ResumenComidas } from "@/components/admin/ResumenComidas";
import { SeguimientoDiarioSoloLectura } from "@/components/admin/SeguimientoDiarioSoloLectura";
import { obtenerHistorialPeso, obtenerFotosProgreso } from "@/app/alumno/progreso/data";
import { obtenerRutinaActiva, obtenerHistorialSesiones } from "@/app/alumno/entrenar/data";
import { obtenerResumenComidas } from "@/app/alumno/comer/data";
import { obtenerHistorialSeguimientos } from "@/app/alumno/inicio/data";
import { obtenerDatosPersonales } from "@/app/alumno/perfil/data";
import { obtenerDocumentos } from "@/app/alumno/documentos/data";
import { ListaDocumentos } from "@/components/student/ListaDocumentos";
import { obtenerIndicadores } from "@/app/admin/alumnos/data";
import { obtenerMovimientosAlumno } from "@/lib/ranking/data";
import { DetalleEstadoAlumno } from "@/components/admin/IndicadorEstadoAlumno";
import { AlertasImpulsoVip } from "@/components/admin/AlertasImpulsoVip";
import { obtenerAlertasPendientes } from "@/lib/impulso-vip/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerPanelIndicacionesAle } from "@/lib/impulso-vip/manual-data";
import { IndicacionesAlePanel } from "@/components/admin/IndicacionesAlePanel";
import { FichaAlumnoTabs } from "@/components/admin/FichaAlumnoTabs";
import { PencilRuler } from "lucide-react";
import { AccesoPortalV2Alumno } from "@/components/admin/AccesoPortalV2Alumno";

export default async function AlumnoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const { id: alumnoId } = await params;
  const supabase = await createClient();

  const [
    { data: perfil },
    { data: alumnoPerfil },
    { data: notas },
    historialPeso,
    fotos,
    rutinaActiva,
    sesiones,
    resumenComidas,
    seguimientos,
    datosPersonales,
    documentos,
    alertasImpulso,
    movimientosPuntos,
    ficha,
    panelIndicaciones,
  ] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", alumnoId).single(),
    supabase
      .from("alumno_perfil")
      .select("objetivo, proximo_control_fecha, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana, plan_entrenamiento_pausado, temporizador_descanso, acceso_bloqueado, acceso_bloqueado_motivo, portal_v2_habilitado")
      .eq("user_id", alumnoId)
      .maybeSingle(),
    supabase
      .from("notas_entrenador")
      .select(
        "id, texto, fecha_inicio, fecha_fin, importante, marcar_nueva, leida_en, generado_con_ia, autor"
      )
      .eq("alumno_id", alumnoId)
      .order("created_at", { ascending: false }),
    obtenerHistorialPeso(supabase, alumnoId),
    obtenerFotosProgreso(supabase, alumnoId),
    obtenerRutinaActiva(alumnoId),
    obtenerHistorialSesiones(supabase, alumnoId),
    obtenerResumenComidas(supabase, alumnoId),
    obtenerHistorialSeguimientos(supabase, alumnoId),
    obtenerDatosPersonales(supabase, alumnoId),
    obtenerDocumentos(supabase, alumnoId),
    obtenerAlertasPendientes(supabase, alumnoId),
    obtenerMovimientosAlumno(alumnoId, 1000),
    leerFicha(supabase as unknown as SupabaseClient, alumnoId),
    obtenerPanelIndicacionesAle(supabase, alumnoId),
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
    <div className="space-y-4 pb-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0 md:py-5">
        <Link href="/admin/alumnos" className="flex min-w-0 items-center gap-2 text-text-secondary hover:text-text">
          <ArrowLeft size={18} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-text-tertiary">Volver a alumnos</span>
            <span className="block truncate text-base font-semibold text-text">{nombreAlumnoPublicado(perfil.nombre)}</span>
          </span>
        </Link>
        <div className="flex gap-2">
          <Link href="/admin/armar-rutina" className="radius-control flex h-9 shrink-0 items-center gap-1.5 border border-vip/40 px-3 text-caption font-semibold text-vip"><PencilRuler size={14} /> <span className="hidden sm:inline">Armar rutina</span></Link>
          <Link href={`/admin/alumnos/${alumnoId}/seguimiento`} className="radius-control flex h-9 shrink-0 items-center gap-1.5 border border-vip/40 px-3 text-caption font-semibold text-vip"><Activity size={14} /> <span className="hidden sm:inline">Seguimiento</span></Link>
          <form action={entrarComoAlumno}>
            <input type="hidden" name="alumno_id" value={alumnoId} />
            <button type="submit" className="radius-control flex h-9 shrink-0 items-center gap-1.5 bg-vip px-3 text-caption font-semibold text-black">
              <Eye size={14} /> <span className="hidden sm:inline">Ver portal</span>
            </button>
          </form>
        </div>
      </div>

      <FichaAlumnoTabs
        secciones={{
          resumen: (
            <>
              {sesion.rol === "admin" ? (
                <AccesoPortalV2Alumno
                  alumnoId={alumnoId}
                  habilitado={alumnoPerfil?.portal_v2_habilitado === true}
                />
              ) : null}
              {indicador && (
                <Card padding="p-3">
                  <p className="text-[10px] mb-1 text-text-tertiary">ESTADO DEL ALUMNO</p>
                  <DetalleEstadoAlumno indicador={indicador} />
                </Card>
              )}
              <AlertasImpulsoVip alumnoId={alumnoId} alertas={alertasImpulso} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Card padding="p-3">
                  <p className="text-[10px] mb-1 text-text-tertiary">NOMBRE</p>
                  <NombreEditable perfilId={alumnoId} nombre={perfil.nombre} />
                </Card>
                <Card padding="p-3">
                  <p className="text-[10px] mb-1 text-text-tertiary">PERFIL</p>
                  <PerfilAlumnoForm
                    alumnoId={alumnoId}
                    objetivo={alumnoPerfil?.objetivo ?? null}
                    proximoControlFecha={alumnoPerfil?.proximo_control_fecha ?? null}
                    planEntrenamiento={alumnoPerfil?.plan_entrenamiento ?? null}
                    sesionesMensuales={alumnoPerfil?.sesiones_mensuales ?? null}
                    diasSemana={alumnoPerfil?.dias_entrenamiento_semana ?? null}
                    planPausado={alumnoPerfil?.plan_entrenamiento_pausado ?? false}
                    temporizadorDescanso={alumnoPerfil?.temporizador_descanso ?? true}
                    accesoBloqueado={alumnoPerfil?.acceso_bloqueado ?? false}
                    accesoBloqueadoMotivo={alumnoPerfil?.acceso_bloqueado_motivo ?? null}
                  />
                </Card>
              </div>
            </>
          ),
          plan: (
            <>
              <FichaAlumnoAdmin alumnoId={alumnoId} nombre={perfil?.nombre ?? "este alumno"} ficha={ficha} />
              <HistorialEntrenamiento rutinaActivaNombre={rutinaActiva?.nombre ?? null} sesiones={sesiones} />
              {rutinaActiva && (
                <>
                  <AplicarRutinaAOtrosAlumnos rutinaId={rutinaActiva.id} nombreRutina={rutinaActiva.nombre} />
                  <CopiarRutinaAlumno rutinaId={rutinaActiva.id} nombreRutina={rutinaActiva.nombre} />
                </>
              )}
            </>
          ),
          actividad: (
            <>
              <PesoCorporalSoloLectura historial={historialPeso} />
              <FotosSoloLectura fotos={fotos} />
              <HistorialPuntosAlumno movimientos={movimientosPuntos} />
              <SeguimientoDiarioSoloLectura seguimientos={seguimientos} />
            </>
          ),
          nutricion: <ResumenComidas resumen={resumenComidas} />,
          comunicacion: (
            <>
              <IndicacionesAlePanel alumnoId={alumnoId} objetivos={panelIndicaciones.objetivos} pendientes={panelIndicaciones.pendientes} />
              <NotasManager alumnoId={alumnoId} notasIniciales={notas ?? []} />
            </>
          ),
          documentos: (
            <>
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] text-text-tertiary">SUS DOCUMENTOS</p>
                <Link href="/admin/documentos" className="text-[10px] font-medium text-vip underline">Subir o gestionar</Link>
              </div>
              <ListaDocumentos documentos={documentos} mensajeVacio="Todavía no le subiste documentos a este alumno." />
            </>
          ),
          cuenta: (
            <>
              <DatosPersonalesSoloLectura datos={datosPersonales} />
              <CredencialesAlumno alumnoId={alumnoId} />
              <Card padding="p-3">
                <p className="text-[10px] mb-1 text-text-tertiary">CORREO DE ACCESO</p>
                <CambiarCorreoForm accion={actualizarCorreoPerfil} camposOcultos={{ perfil_id: alumnoId }} />
              </Card>
              <Card padding="p-3">
                <p className="text-[10px] mb-1 text-text-tertiary">ZONA DE RIESGO</p>
                <EliminarPerfilBoton
                  accion={eliminarAlumno}
                  campoId="alumno_id"
                  valorId={alumnoId}
                  etiqueta="Eliminar alumno"
                  advertencia={`Esto borra para siempre la cuenta de ${nombreAlumnoPublicado(perfil.nombre)}: su acceso, rutinas, comidas, seguimiento, notas y ranking. No se puede deshacer.`}
                />
              </Card>
            </>
          ),
        }}
      />
    </div>
  );
}
