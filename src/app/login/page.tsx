import { LoginForm } from "@/components/LoginForm";
import { obtenerConfiguracionRegistro } from "@/lib/configuracion/registro";

export default async function LoginPage() {
  // El mismo interruptor que pinta el aviso de prueba en /registro decide si
  // acá se invita a "inscribirse a la beta" o simplemente a inscribirse.
  const { betaAviso } = await obtenerConfiguracionRegistro();
  return <LoginForm beta={betaAviso} />;
}
