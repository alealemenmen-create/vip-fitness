import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FormularioRegistro } from "@/components/registro/FormularioRegistro";
import type { DatosPago } from "@/components/registro/PasoPago";
import { obtenerConfiguracionRegistro } from "@/lib/configuracion/registro";

export const metadata: Metadata = {
  title: "Inscríbete — VIP Fitness",
  description: "Deja tus datos y tu entrenador de VIP Fitness activa tu cuenta.",
  // Es un link que se pasa por WhatsApp, no una página que deba salir en
  // buscadores: los datos de salud que se piden acá no tienen por qué quedar
  // indexados junto al nombre del gimnasio.
  robots: { index: false, follow: false },
};

/** Página pública (no pasa por requireRol): cualquiera con el link entra. Lo
 * único que puede hacer desde acá es dejar una solicitud, que no da acceso a
 * nada hasta que el entrenador la acepta. */
export default async function RegistroPage() {
  const config = await obtenerConfiguracionRegistro();

  // Con el cobro apagado se le pasa `null` al formulario y la pantalla de pago
  // no existe para quien se inscribe. Es el estado por defecto (ver migración
  // 0033) y el de la beta.
  const pago: DatosPago | null = config.pagoActivo
    ? {
        monto: config.pagoMonto,
        banco: config.banco,
        tipoCuenta: config.tipoCuenta,
        numeroCuenta: config.numeroCuenta,
        rut: config.rut,
        titular: config.titular,
        correo: config.correo,
        instrucciones: config.instrucciones,
        whatsapp: config.whatsapp,
      }
    : null;

  return (
    // `h-dvh overflow-y-auto` y no `min-h-screen`: desde que `html`/`body`
    // dejaron de scrollear globalmente (ver globals.css, arreglo del salto de
    // iOS en /alumno), cualquier página fuera de esos dos layouts necesita su
    // propio contenedor con scroll — si no, un formulario más largo que la
    // pantalla queda trabado, sin forma de bajar a ver el resto.
    <div className="flex h-dvh justify-center overflow-y-auto bg-bg px-4 py-8 [-webkit-overflow-scrolling:touch]">
      <div className="radius-card w-full max-w-sm bg-surface p-6">
        <div className="mb-3 flex justify-end">
          <ThemeToggle />
        </div>
        <Logo height={72} className="mb-6" />

        <h1 className="text-h2 text-text">Inscríbete</h1>
        <p className="text-body mt-2 text-text-secondary">
          Completa tus datos y tu entrenador activa tu cuenta.
        </p>

        {config.betaAviso && (
          <div className="radius-control mt-4 flex gap-3 bg-vip/10 p-4">
            <FlaskConical size={18} className="mt-0.5 shrink-0 text-vip" />
            <div>
              <p className="text-secondary font-medium text-text">Esto es una prueba</p>
              <p className="text-caption mt-1 text-text-secondary">
                Estamos estrenando la app del gimnasio y te toca probarla. Si algo se ve raro o no
                funciona, avísale a tu entrenador — para eso es.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <FormularioRegistro pago={pago} />
        </div>
      </div>
    </div>
  );
}
