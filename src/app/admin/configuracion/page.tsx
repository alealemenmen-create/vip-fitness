import { requireAdmin } from "@/lib/auth";
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
import { ControlVipV2BetaPanel } from "@/components/admin/ControlVipV2BetaPanel";
import { obtenerCuentasBetaControlVipV2 } from "@/lib/control-vip-v2/beta";
import Link from "next/link";

export default async function ConfiguracionAdminPage() {
  await requireAdmin();
  // El saldo va aparte del `Promise.all`, no adentro: sumarlo como quinto
  // elemento hacía que TypeScript perdiera la inferencia de la tupla y tratara
  // todo el resultado como `any[]` (el build lo rechaza aunque `tsc --noEmit`
  // lo dejara pasar). Arranca igual antes de esperar al grupo, así que no
  // agrega ni un milisegundo de espera.
  const saldoPromesa = obtenerSaldoIA();
  const [config, supervision, registro, asistente, cuentasBetaControlVipV2] = await Promise.all([
    obtenerConfiguracionReconocimientos(),
    obtenerConfiguracionSupervision(),
    obtenerConfiguracionRegistro(),
    obtenerConfiguracionAsistenteVip(),
    obtenerCuentasBetaControlVipV2(),
  ]);
  const saldoIA = await saldoPromesa;

  return (
    <div className="space-y-4 pb-4">
      <AdminPageHeader
        eyebrow="Ajustes del sistema"
        title="Configuración"
        description="Cómo se comporta la app: registro, automatizaciones, IA y tu cuenta."
        actions={
          <Link href="/admin/mas" className="boton-panel-secundario">
            Ver todo el panel
          </Link>
        }
      />
      {/* Acá vivía una reja de dieciséis atajos de colores. Se mudó entera a
          `/admin/mas` (instructivo §4.3): esta pantalla hacía dos trabajos
          incompatibles — ser el destino de la pestaña "Más" del celular y ser
          los ajustes del sistema — y como directorio se quedaba corta (diez
          atajos de diecinueve destinos). Configuración conserva lo segundo;
          el mapa completo, con buscador y contadores, vive en Más. */}
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
      <GavetaConfig titulo="Control VIP V2 (beta)" subtitulo="Quién puede probar el panel nuevo en /control-vip">
        <ControlVipV2BetaPanel cuentas={cuentasBetaControlVipV2} />
      </GavetaConfig>
      </section>
    </div>
  );
}
