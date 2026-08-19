import Link from "next/link";
import { ArrowLeft, FileCheck2, Scale } from "lucide-react";
import styles from "@/components/v2/PortalV2.module.css";

const SECCIONES = [
  {
    titulo: "1. Servicio y acceso",
    contenido: [
      "Portal VIP Fitness complementa el acompañamiento contratado con el gimnasio. El acceso es personal: no compartas tus credenciales ni utilices la cuenta de otra persona.",
      "Las funciones disponibles pueden variar según el plan, el perfil asignado y el estado de la membresía.",
    ],
  },
  {
    titulo: "2. Entrenamiento y salud",
    contenido: [
      "Las rutinas, técnicas de intensidad y sugerencias de Impulso VIP se apoyan en tu historial, pero no reemplazan una evaluación médica ni permiten ignorar dolor, mareos o una lesión.",
      "Debes mantener actualizados tus antecedentes y avisar al entrenador si cambia tu condición de salud. Detén el ejercicio y solicita orientación ante síntomas inesperados.",
    ],
  },
  {
    titulo: "3. Alimentación",
    contenido: [
      "Las calorías y nutrientes son estimaciones basadas en la información disponible para cada alimento. Verifica siempre la etiqueta del producto, especialmente si tienes alergias o una indicación clínica.",
      "El buscador y los objetivos nutricionales son herramientas de seguimiento; no constituyen diagnóstico ni tratamiento nutricional.",
    ],
  },
  {
    titulo: "4. Puntos, ranking y premios",
    contenido: [
      "Los puntos se conceden por actividad válida y verificable. Registros duplicados, manipulados o incompatibles con la actividad real pueden anularse.",
      "El stock, la vigencia y las condiciones de cada premio se muestran antes del canje. Un canje sólo se considera entregado cuando lo confirma el administrador.",
    ],
  },
  {
    titulo: "5. Comunidad",
    contenido: [
      "Publica sólo contenido propio y respetuoso. No se permite acosar, discriminar, suplantar identidades, divulgar datos privados ni promover conductas peligrosas.",
      "El equipo puede moderar contenido reportado y limitar cuentas cuando sea necesario para proteger a la comunidad.",
    ],
  },
  {
    titulo: "6. Datos y contenido",
    contenido: [
      "Tus fotos y registros siguen vinculados a tu cuenta y se usan para el servicio descrito en la Política de privacidad. El contenido, marca, rutinas y diseño de VIP Fitness no pueden redistribuirse sin autorización.",
    ],
  },
  {
    titulo: "7. Disponibilidad y cambios",
    contenido: [
      "Trabajamos para mantener el portal disponible y seguro, aunque pueden existir interrupciones por mantenimiento, conectividad o proveedores externos. Los cambios relevantes se comunicarán dentro del portal.",
    ],
  },
  {
    titulo: "8. Contacto",
    contenido: [
      "Para dudas sobre tu plan, una corrección de datos, una falla o una solicitud relacionada con tu cuenta, utiliza Soporte VIP o contacta directamente al equipo del gimnasio.",
    ],
  },
] as const;

export default function TerminosV2Page() {
  return (
    <section className={styles.v2LegalPage}>
      <header>
        <Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link>
        <div><span>DOCUMENTOS</span><h1>Términos de uso</h1></div>
      </header>

      <article className={styles.v2LegalNotice}>
        <Scale size={21} />
        <div><strong>Borrador operativo</strong><p>Describe cómo funciona hoy Portal VIP Fitness V2. Requiere revisión jurídica antes del lanzamiento comercial definitivo.</p></div>
      </article>
      <p className={styles.v2LegalUpdated}>Última actualización: 19 de agosto de 2026.</p>

      <div className={styles.v2LegalSections}>
        {SECCIONES.map((seccion) => (
          <article key={seccion.titulo}>
            <h2>{seccion.titulo}</h2>
            {seccion.contenido.map((parrafo) => <p key={parrafo}>{parrafo}</p>)}
          </article>
        ))}
      </div>

      <div className={styles.v2LegalActions}>
        <Link href="/portal-v2/privacidad"><FileCheck2 size={17} />Política de privacidad</Link>
        <Link href="/portal-v2/soporte">Contactar soporte</Link>
      </div>
    </section>
  );
}
