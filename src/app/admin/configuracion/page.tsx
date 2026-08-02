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

export default async function ConfiguracionAdminPage() {
  await requireRol(["entrenador", "admin"]);
  const [config, supervision, registro] = await Promise.all([
    obtenerConfiguracionReconocimientos(),
    obtenerConfiguracionSupervision(),
    obtenerConfiguracionRegistro(),
  ]);

  return (
    <div className="space-y-4 pb-4">
      <div>
        <p className="text-caption text-text-tertiary">CONTROL DEL PORTAL</p>
        <h1 className="text-h2 text-text">Configuración</h1>
        <p className="text-secondary mt-1 text-text-secondary">
          Automatizaciones útiles que siempre quedan bajo control del entrenador.
        </p>
      </div>
      <CambiarMiPassword />
      <Card className="space-y-3 p-4">
        <p className="text-caption text-text-tertiary">MI CORREO</p>
        <CambiarCorreoForm accion={cambiarMiCorreo} />
      </Card>
      <ConfiguracionRegistro config={registro} />
      <EstadoSistema />
      <ConfiguracionReconocimientos config={config} supervision={supervision} />
    </div>
  );
}
