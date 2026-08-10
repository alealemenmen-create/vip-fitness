import { requireRol } from "@/lib/auth";
import { obtenerConfiguracionReconocimientos } from "@/lib/ai/reconocimientosSemanales";
import { obtenerConfiguracionSupervision } from "@/lib/configuracion/supervision";
import { obtenerConfiguracionRegistro } from "@/lib/configuracion/registro";
import { ConfiguracionRegistro } from "@/components/admin/ConfiguracionRegistro";
import { ConfiguracionReconocimientos } from "@/components/admin/ConfiguracionReconocimientos";
import { EstadoSistema } from "@/components/admin/EstadoSistema";
import { CambiarMiPassword } from "@/components/admin/CambiarMiPassword";
import { CambiarCorreoForm } from "@/components/admin/CambiarCorreoForm";
import { Card } from "@/components/ui/Card";
import { cambiarMiCorreo } from "./actions";
import { obtenerConfiguracionAsistenteVip } from "@/lib/asistente/configuracion";
import { ConfiguracionAsistenteVip } from "@/components/admin/ConfiguracionAsistenteVip";
import { GavetaConfig } from "@/components/admin/GavetaConfig";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import Link from "next/link";
import { Bot, ChevronRight, Images, LogIn, Megaphone, ShieldAlert, Trophy } from "lucide-react";
import { obtenerNovedades } from "@/lib/novedades";
import { Novedades } from "@/components/admin/Novedades";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { obtenerIngresos } from "@/lib/ingresos/data";

export default async function ConfiguracionAdminPage() {
  await requireRol(["entrenador", "admin"]);
  const [config, supervision, registro, asistente, novedades, hallazgos, { resumen: ingresos }] =
    await Promise.all([
      obtenerConfiguracionReconocimientos(),
      obtenerConfiguracionSupervision(),
      obtenerConfiguracionRegistro(),
      obtenerConfiguracionAsistenteVip(),
      obtenerNovedades(),
      obtenerHallazgosPendientes(),
      obtenerIngresos("semana"),
    ]);
  const activosAhora = ingresos.filter((r) => r.estado === "activo_ahora").length;

  return (
    <div className="space-y-4 pb-4">
      <AdminPageHeader
        eyebrow="Control del portal"
        title="Configuración"
        description="Herramientas, automatizaciones y accesos organizados bajo el control del entrenador."
      />
      <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-text">Accesos y herramientas</h2>
        <p className="text-[11px] text-text-tertiary">Atajos a las áreas de control más utilizadas.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
      <Link href="/admin/ejercicios" className="block h-full">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#a78bfa]/15 text-[#a78bfa]">
            <Images size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">
              Galería de ejercicios
            </span>
            <span className="text-caption block text-text-tertiary">
              Fotos de cada ejercicio — subir, cambiar o agregar nuevas
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/auditoria" className="block h-full">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-error/15 text-error">
            <ShieldAlert size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Auditoría de Puntos VIP</span>
            <span className="text-caption block text-text-tertiary">
              {hallazgos.length === 0
                ? "Sin sospechas pendientes"
                : `${hallazgos.length} ${hallazgos.length === 1 ? "hallazgo pendiente" : "hallazgos pendientes"} de revisar`}
            </span>
          </span>
          {hallazgos.length > 0 && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
          )}
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/ingresos" className="block h-full">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#3b82f6]/15 text-[#60a5fa]">
            <LogIn size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Ingresos a la app</span>
            <span className="text-caption block text-text-tertiary">
              {activosAhora === 0
                ? "Nadie en el gimnasio ahora"
                : `${activosAhora} ${activosAhora === 1 ? "alumno" : "alumnos"} en el gimnasio ahora`}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/asistente" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip"><Bot size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Asistente VIP</span>
            <span className="text-caption block text-text-tertiary">Consulta y apoyo de IA para el entrenador</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/torneos" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f59e0b]/15 text-[#f59e0b]"><Trophy size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Arena</span>
            <span className="text-caption block text-text-tertiary">Retos y competencias de la comunidad</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/noticias" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#22c55e]"><Megaphone size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Noticias</span>
            <span className="text-caption block text-text-tertiary">Publicaciones y novedades para los alumnos</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      </div>
      </section>
      <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-text">Ajustes del sistema</h2>
        <p className="text-[11px] text-text-tertiary">Abre únicamente el bloque que necesites modificar.</p>
      </div>
      <GavetaConfig titulo="Mi cuenta" subtitulo="Contraseña y correo">
        <CambiarMiPassword />
        <Card className="space-y-3 p-4">
          <p className="text-caption text-text-tertiary">MI CORREO</p>
          <CambiarCorreoForm accion={cambiarMiCorreo} />
        </Card>
      </GavetaConfig>
      <GavetaConfig titulo="Registro de alumnos" subtitulo="Link de inscripción y cobro">
        <ConfiguracionRegistro config={registro} />
      </GavetaConfig>
      <GavetaConfig titulo="Estado del sistema" subtitulo="Salud de la app y sus integraciones">
        <EstadoSistema />
      </GavetaConfig>
      <GavetaConfig titulo="Asistente VIP" subtitulo="El chat de IA para los alumnos">
        <ConfiguracionAsistenteVip config={asistente} />
      </GavetaConfig>
      <GavetaConfig titulo="Reconocimientos semanales" subtitulo="Felicitaciones automáticas por IA">
        <ConfiguracionReconocimientos config={config} supervision={supervision} />
      </GavetaConfig>
      <GavetaConfig titulo="Novedades de la app" subtitulo="Qué se arregló o se agregó, en orden">
        <Novedades novedades={novedades} />
      </GavetaConfig>
      </section>
    </div>
  );
}
