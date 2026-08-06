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
import { PesoCorporalSoloLectura } from "@/components/admin/PesoCorporalSoloLectura";
import { FotosSoloLectura } from "@/components/admin/FotosSoloLectura";
import { HistorialEntrenamiento } from "@/components/admin/HistorialEntrenamiento";
import { HistorialPuntosAlumno } from "@/components/admin/HistorialPuntosAlumno";
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
    <div className="space-y-2">
      <Link href="/admin/alumnos" className="flex items-center gap-1.5">
        <ArrowLeft size={16} className="text-text-secondary" />
        <h1 className="text-caption font-semibold text-text">{nombreAlumnoPublicado(perfil.nombre)}</h1>
      </Link>

      {indicador && (
        <Card padding="p-2">
          <p className="text-[10px] mb-1 text-text-tertiary">ESTADO DEL ALUMNO</p>
          <DetalleEstadoAlumno indicador={indicador} />
        </Card>
      )}

      <AlertasImpulsoVip alumnoId={alumnoId} alertas={alertasImpulso} />

      <form action={entrarComoAlumno}>
        <input type="hidden" name="alumno_id" value={alumnoId} />
        <button
          type="submit"
          className="radius-control flex h-9 w-full items-center justify-center gap-1.5 bg-vip text-caption font-medium text-black"
        >
          <Eye size={13} /> Ver portal completo
        </button>
      </form>

      <Card padding="p-2">
        <p className="text-[10px] mb-1 text-text-tertiary">NOMBRE</p>
        <NombreEditable perfilId={alumnoId} nombre={perfil.nombre} />
      </Card>

      <Card padding="p-2">
        <p className="text-[10px] mb-1 text-text-tertiary">PERFIL</p>
        <PerfilAlumnoForm
          alumnoId={alumnoId}
          objetivo={alumnoPerfil?.objetivo ?? null}
          proximoControlFecha={alumnoPerfil?.proximo_control_fecha ?? null}
        />
      </Card>

      <DatosPersonalesSoloLectura datos={datosPersonales} />

      <NotasManager alumnoId={alumnoId} notasIniciales={notas ?? []} />

      <p className="text-[10px] pt-1 text-text-tertiary">ACTIVIDAD DEL ALUMNO</p>
      <PesoCorporalSoloLectura historial={historialPeso} />
      <FotosSoloLectura fotos={fotos} />
      <HistorialEntrenamiento rutinaActivaNombre={rutinaActiva?.nombre ?? null} sesiones={sesiones} />
      <HistorialPuntosAlumno movimientos={movimientosPuntos} />
      <ResumenComidas resumen={resumenComidas} />
      <SeguimientoDiarioSoloLectura seguimientos={seguimientos} />

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-text-tertiary">SUS DOCUMENTOS</p>
        <Link href="/admin/documentos" className="text-[10px] font-medium text-vip underline">
          Subir o gestionar
        </Link>
      </div>
      <ListaDocumentos
        documentos={documentos}
        mensajeVacio="Todavía no le subiste documentos a este alumno."
      />

      <CredencialesAlumno alumnoId={alumnoId} />

      <Card padding="p-2">
        <p className="text-[10px] mb-1 text-text-tertiary">CORREO DE ACCESO</p>
        <CambiarCorreoForm
          accion={actualizarCorreoPerfil}
          camposOcultos={{ perfil_id: alumnoId }}
        />
      </Card>

      <Card padding="p-2">
        <p className="text-[10px] mb-1 text-text-tertiary">ZONA DE RIESGO</p>
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
