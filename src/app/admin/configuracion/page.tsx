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
import { obtenerSaldoIA } from "@/lib/asistente/saldo";
import { SaldoIAPanel } from "@/components/admin/SaldoIAPanel";
import { GavetaConfig } from "@/components/admin/GavetaConfig";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import Link from "next/link";
import { Bell, Bot, Bug, ChevronRight, CircleDollarSign, ClipboardCheck, ClipboardList, FileText, Images, LogIn, Megaphone, ShieldAlert, Sparkles, Trash2, Trophy, WandSparkles } from "lucide-react";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { obtenerIngresos } from "@/lib/ingresos/data";
import { obtenerResumenAlertasGastos } from "@/lib/gastos/data";
import { createClient } from "@/lib/supabase/server";

export default async function ConfiguracionAdminPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  // El saldo va aparte del `Promise.all`, no adentro: sumarlo como noveno
  // elemento hacía que TypeScript perdiera la inferencia de la tupla y tratara
  // todo el resultado como `any[]` (el build lo rechaza aunque `tsc --noEmit`
  // lo dejara pasar). Arranca igual antes de esperar al grupo, así que no
  // agrega ni un milisegundo de espera.
  const saldoPromesa = obtenerSaldoIA();
  const [
    config,
    supervision,
    registro,
    asistente,
    hallazgos,
    { resumen: ingresos },
    gastosAlerta,
    { count: solicitudesPendientes },
    { count: reportesPendientes },
    { count: borradosPendientes },
  ] = await Promise.all([
      obtenerConfiguracionReconocimientos(),
      obtenerConfiguracionSupervision(),
      obtenerConfiguracionRegistro(),
      obtenerConfiguracionAsistenteVip(),
      obtenerHallazgosPendientes(),
      obtenerIngresos("semana"),
      obtenerResumenAlertasGastos(),
      supabase
        .from("solicitudes_registro")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente"),
      supabase
        .from("reportes_bugs")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente"),
      supabase
        .from("solicitudes_borrado_sesion")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente"),
    ]);
  const saldoIA = await saldoPromesa;
  const activosAhora = ingresos.filter((r) => r.estado === "en_gimnasio").length;

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
      <Link href="/admin/pendientes" className="block h-full">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip">
            <ClipboardCheck size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Pendientes</span>
            <span className="text-caption block text-text-tertiary">
              Solicitudes, auditoría, errores, borrados y gastos, en un solo lugar
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
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
      <Link href="/admin/gastos" className="block h-full">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#22c55e]">
            <CircleDollarSign size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Gastos de la app</span>
            <span className="text-caption block text-text-tertiary">
              {gastosAlerta.pendientes ? `${gastosAlerta.pendientes} pago${gastosAlerta.pendientes === 1 ? "" : "s"} próximo${gastosAlerta.pendientes === 1 ? "" : "s"} o vencido${gastosAlerta.pendientes === 1 ? "" : "s"}` : "Costos, vencimientos e historial de pagos"}
            </span>
          </span>
          {gastosAlerta.pendientes > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />}
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      {/* En el celular esta pantalla es "Más", y es la única puerta a las
          secciones que no entran en la barra de abajo. Sin esta tarjeta,
          Otorgar puntos solo se alcanzaba escribiendo la URL. */}
      <Link href="/admin/puntos" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip"><Sparkles size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Otorgar puntos</span>
            <span className="text-caption block text-text-tertiary">Reponer puntos perdidos por una falla o premiar algo puntual</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      {/* Mismo motivo que la tarjeta de arriba: en el celular esta es la única
          puerta a lo que no entra en la barra de abajo. */}
      <Link href="/admin/rutinas-generadas" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip"><FileText size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Rutinas hechas</span>
            <span className="text-caption block text-text-tertiary">Abrir una rutina que ya le armaste, cambiarla y volver a publicarla</span>
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
      {/* Antes vivía adentro de una gaveta plegada de acá abajo, sin ninguna
          forma de saber si había algo nuevo sin leer. Pedido explícito: una
          sección propia, con aviso — el contador de "sin ver" vive en la
          navegación (AdminTabs), no acá. */}
      <Link href="/admin/novedades" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]"><Bell size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Actualizaciones</span>
            <span className="text-caption block text-text-tertiary">Qué se arregló o se agregó en la app, en orden</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      {/* Estas cuatro faltaban acá: en el celular "Más" es la única puerta a
          todo lo que no entra en la barra de abajo, y sin tarjeta solo se
          llegaba escribiendo la URL a mano. */}
      <Link href="/admin/solicitudes" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip"><ClipboardList size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Solicitudes</span>
            <span className="text-caption block text-text-tertiary">
              {solicitudesPendientes ? `${solicitudesPendientes} pendiente${solicitudesPendientes === 1 ? "" : "s"} de aprobar` : "Pedidos de inscripción nuevos"}
            </span>
          </span>
          {!!solicitudesPendientes && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />}
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/generador" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vip/15 text-vip"><WandSparkles size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Generador de rutinas</span>
            <span className="text-caption block text-text-tertiary">Armar una rutina nueva por cuestionario/reglas</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/reportes" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-error/15 text-error"><Bug size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Errores reportados</span>
            <span className="text-caption block text-text-tertiary">
              {reportesPendientes ? `${reportesPendientes} sin resolver` : "Lo que los alumnos avisan desde la app"}
            </span>
          </span>
          {!!reportesPendientes && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />}
          <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
        </Card>
      </Link>
      <Link href="/admin/borrados" className="block h-full">
        <Card className="flex h-full items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/15 text-warning"><Trash2 size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block font-semibold text-text">Pedidos de borrado</span>
            <span className="text-caption block text-text-tertiary">
              {borradosPendientes ? `${borradosPendientes} pendiente${borradosPendientes === 1 ? "" : "s"} de revisar` : "Sesiones que un alumno pidió borrar"}
            </span>
          </span>
          {!!borradosPendientes && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />}
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
      {/* Aparte del Asistente VIP: esto cuenta TODO lo que usa IA, no solo el
          chat — la revisión de rutinas es lo más caro y no figuraba en ningún
          lado. */}
      <GavetaConfig titulo="Saldo y consumo de IA" subtitulo="Cuánto queda y en qué se está yendo">
        <SaldoIAPanel saldo={saldoIA} />
      </GavetaConfig>
      <GavetaConfig titulo="Reconocimientos semanales" subtitulo="Felicitaciones automáticas por IA">
        <ConfiguracionReconocimientos config={config} supervision={supervision} />
      </GavetaConfig>
      </section>
    </div>
  );
}
