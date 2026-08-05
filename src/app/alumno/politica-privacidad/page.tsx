import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-1.5">
      <h2 className="text-caption font-semibold uppercase tracking-wide text-vip">{titulo}</h2>
      <div className="text-micro space-y-1.5 leading-relaxed text-text-secondary">{children}</div>
    </Card>
  );
}

/**
 * Borrador propio, no una plantilla externa ni asesoría legal — pensado para
 * cubrir lo que el gimnasio pidió (datos sensibles, riesgos del uso de la
 * app, autoría) pero conviene que lo revise alguien con matrícula antes de
 * darle valor legal real, sobre todo por los datos de salud/alimentación
 * que maneja la app. El aviso queda explícito abajo, en la propia página.
 */
export default function PoliticaPrivacidadPage() {
  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/inicio" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <span className="text-h3 text-text">Política de uso y privacidad</span>
      </Link>

      <Card className="border border-vip/40 bg-vip/5">
        <p className="text-caption text-text-secondary">
          Este documento es un borrador redactado para VIP Fitness Center a partir de lo que la
          app efectivamente hace. No fue revisado por un abogado y no reemplaza asesoría legal
          profesional — se recomienda que un profesional con matrícula lo revise antes de tratarlo
          como un documento legal definitivo, especialmente por los datos de salud y alimentación
          que la app maneja.
        </p>
      </Card>

      <p className="text-micro text-text-tertiary">Última actualización: agosto de 2026.</p>

      <Seccion titulo="1. Quiénes somos y a qué aplica esto">
        <p>
          Esta política aplica al uso de la aplicación de VIP Fitness Center (el &quot;Portal&quot;)
          por parte de sus socios (&quot;el alumno&quot;, &quot;tú&quot;) y describe qué información
          se recolecta, para qué se usa, y qué responsabilidades existen entre el gimnasio y quien
          usa la app.
        </p>
        <p>
          Al crear una cuenta o usar el Portal, aceptas los términos descritos aquí. Si no estás de
          acuerdo con algún punto, puedes solicitar la eliminación de tu cuenta contactando
          directamente a tu entrenador o al gimnasio.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué datos recolectamos">
        <p>Para poder prestar el servicio, el Portal guarda:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Datos de contacto y de cuenta: nombre, correo electrónico, contraseña (cifrada).</li>
          <li>
            Datos físicos y de salud que tú mismo cargas: peso corporal, estatura, edad, sexo,
            objetivo de entrenamiento, condición médica y alergias o condiciones alimenticias que
            declares.
          </li>
          <li>Fotos de progreso físico que subas voluntariamente.</li>
          <li>
            Registros de entrenamiento: rutinas asignadas, series, repeticiones, pesos usados,
            duración de las sesiones y comentarios que escribas.
          </li>
          <li>
            Registros de alimentación: comidas y alimentos que registres, con sus calorías y
            macronutrientes estimados.
          </li>
          <li>
            Actividad dentro de la app: puntos VIP ganados, rango, participación en torneos,
            conversaciones con el Asistente VIP (chat con inteligencia artificial) y notas que tu
            entrenador te deje.
          </li>
          <li>Documentos que el gimnasio te asigne (rutinas y planes de alimentación en PDF).</li>
        </ul>
        <p>
          Los datos de salud, alimentación y las fotos de progreso son especialmente sensibles: se
          usan únicamente para el propósito de acompañamiento deportivo y nutricional que ofrece el
          gimnasio, nunca se venden ni se ceden a terceros con fines comerciales.
        </p>
      </Seccion>

      <Seccion titulo="3. Para qué usamos tus datos">
        <ul className="list-disc space-y-1 pl-4">
          <li>Para que tu entrenador pueda armar y ajustar tu rutina y tu plan de alimentación.</li>
          <li>
            Para mostrarte tu propio progreso: peso a lo largo del tiempo, fotos, constancia,
            puntos VIP y rango.
          </li>
          <li>
            Para el ranking y las competencias (Arena VIP): otros alumnos pueden ver tu nombre,
            posición y puntos totales, y — si tocan tu nombre en el ranking — en qué categorías
            ganaste puntos (por ejemplo &quot;entrenamiento&quot; o &quot;alimentación&quot;), pero
            nunca el detalle de qué comiste ni tus datos médicos.
          </li>
          <li>
            Para generar mensajes motivacionales automáticos por inteligencia artificial cuando tu
            entrenador no alcanzó a escribirte esa semana (ver sección 4).
          </li>
          <li>Para el Asistente VIP, el chat con inteligencia artificial disponible en la app.</li>
          <li>Para enviarte notificaciones de novedades del gimnasio (noticias, torneos, anuncios).</li>
        </ul>
      </Seccion>

      <Seccion titulo="4. Uso de inteligencia artificial">
        <p>
          El Portal usa inteligencia artificial (modelos de Anthropic, familia Claude) en dos
          casos: el Asistente VIP, que conversa directamente contigo, y la generación automática de
          notas motivacionales cuando tu entrenador no te dejó una nota manual durante la semana.
        </p>
        <p>
          Para las notas automáticas, la IA nunca recibe tu nombre, tus cifras de peso, tus
          calorías ni datos médicos — solo una categoría general de cómo viene tu semana. Tu
          entrenador siempre puede editar o eliminar cualquier nota generada por IA, y las notas
          escritas por él mismo tienen prioridad sobre las automáticas.
        </p>
      </Seccion>

      <Seccion titulo="5. Con quién compartimos tus datos">
        <ul className="list-disc space-y-1 pl-4">
          <li>Con tu entrenador y el personal autorizado del gimnasio, que administran la app.</li>
          <li>
            Con otros alumnos, únicamente lo que ya es visible por diseño de la app: tu nombre y
            puntos en el ranking, y las categorías de puntos si alguien toca tu fila (ver sección
            3).
          </li>
          <li>
            Con proveedores de infraestructura necesarios para operar la app (hosting, base de
            datos, envío de correos e inteligencia artificial), bajo sus propios términos de
            confidencialidad, y solo en la medida necesaria para prestar el servicio.
          </li>
        </ul>
        <p>No vendemos tus datos a terceros ni los usamos con fines publicitarios ajenos al gimnasio.</p>
      </Seccion>

      <Seccion titulo="6. Seguridad y conservación">
        <p>
          Guardamos tus datos con controles de acceso: cada alumno solo puede ver su propia
          información detallada (peso, comidas, fotos, notas), salvo el entrenador y el personal
          autorizado. Las contraseñas se guardan cifradas, nunca en texto plano.
        </p>
        <p>
          Conservamos tus datos mientras tengas una cuenta activa en el gimnasio. Si dejas de ser
          socio y solicitas la eliminación de tu cuenta, eliminamos o anonimizamos tu información
          personal dentro de un plazo razonable, salvo lo que estemos obligados a conservar por ley
          (por ejemplo, registros contables).
        </p>
      </Seccion>

      <Seccion titulo="7. Tus derechos sobre tus datos">
        <p>Puedes solicitarle a tu entrenador o al gimnasio, en cualquier momento:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Acceder a los datos que tenemos sobre ti.</li>
          <li>Corregir datos que estén desactualizados o incorrectos.</li>
          <li>Eliminar tu cuenta y tus datos personales.</li>
          <li>Retirar tu consentimiento para el uso de fotos de progreso.</li>
        </ul>
      </Seccion>

      <Seccion titulo="8. Riesgos del entrenamiento físico y responsabilidad">
        <p>
          El ejercicio físico conlleva riesgos inherentes, incluyendo lesiones. Al usar el Portal y
          entrenar según las rutinas asignadas, reconoces que:
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Es tu responsabilidad informar a tu entrenador cualquier condición médica, lesión previa
            o limitación física relevante antes de comenzar o continuar un programa de
            entrenamiento.
          </li>
          <li>
            Se recomienda contar con autorización médica antes de iniciar cualquier programa de
            ejercicio o cambio significativo en tu alimentación, en especial si tienes una condición
            de salud preexistente.
          </li>
          <li>
            Las estimaciones de calorías y macronutrientes son orientativas, no un diagnóstico ni un
            reemplazo de indicación nutricional profesional en casos de condiciones médicas
            específicas.
          </li>
          <li>
            El gimnasio y su personal ponen a disposición las herramientas y el acompañamiento
            razonable, pero el resultado del entrenamiento depende de múltiples factores fuera de su
            control (constancia, condición previa, factores médicos no informados, entre otros).
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="9. Propiedad intelectual y contenido">
        <p>
          El logo, el nombre &quot;VIP Fitness Center&quot;, las rutinas, los planes de alimentación
          y el diseño de la app son propiedad del gimnasio o de sus licenciantes, y no pueden
          reproducirse ni redistribuirse sin autorización.
        </p>
        <p>
          Las fotos de progreso que subas siguen siendo tuyas: el gimnasio no las usa con fines
          publicitarios ni las comparte fuera de la app sin tu autorización expresa y por separado.
        </p>
      </Seccion>

      <Seccion titulo="10. Cambios a esta política">
        <p>
          Podemos actualizar esta política cuando cambie algo relevante en cómo funciona la app. Los
          cambios importantes se avisarán dentro del Portal (por ejemplo, en Noticias).
        </p>
      </Seccion>

      <Seccion titulo="11. Contacto">
        <p>
          Para cualquier consulta sobre tus datos o esta política, el canal directo es tu
          entrenador o el personal del gimnasio a través de los medios de contacto habituales de
          VIP Fitness Center.
        </p>
      </Seccion>
    </div>
  );
}
