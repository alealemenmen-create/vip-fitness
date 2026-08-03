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
import { TituloPestana } from "@/components/admin/TituloPestana";

export default async function ConfiguracionAdminPage() {
  await requireRol(["entrenador", "admin"]);
  const [config, supervision, registro, asistente] = await Promise.all([
    obtenerConfiguracionReconocimientos(),
    obtenerConfiguracionSupervision(),
    obtenerConfiguracionRegistro(),
    obtenerConfiguracionAsistenteVip(),
  ]);

  return (
    <div className="space-y-4 pb-4">
      <TituloPestana>
        <p className="text-caption text-text-tertiary">CONTROL DEL PORTAL</p>
        <h1 className="text-h2 text-text">Configuración</h1>
      </TituloPestana>
      <p className="text-secondary text-text-secondary">
        Automatizaciones útiles que siempre quedan bajo control del entrenador.
      </p>
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
    </div>
  );
}
