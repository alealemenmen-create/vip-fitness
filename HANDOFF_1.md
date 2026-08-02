# HANDOFF 1 — Registro público de alumnos + pago de inscripción

**Fecha:** 2 de agosto de 2026
**Estado:** funcionando en local, sin commitear, sin desplegar.

---

## PUNTO DE REGRESO

| | |
|---|---|
| Rama | `main` |
| Último commit | `978ab85` — "Correcciones de nutricion y entrenamiento" |
| Trabajo nuevo | **sin commitear**, todo en el árbol de trabajo |
| Migración 0032 | ✅ **aplicada** en Supabase (2/8/2026) |
| Migración 0033 | ❌ **pendiente**, y así está bien por ahora (ver abajo) |

Para volver a este punto exacto: el trabajo está en archivos sin commitear sobre
`978ab85`. Si se commitea, anotar el hash acá antes de seguir.

```bash
git status --short
```

Archivos tocados en este trabajo:

**Nuevos**
```
supabase/migrations/0032_solicitudes_registro.sql
supabase/migrations/0033_registro_pago.sql
src/app/registro/                          (page.tsx, actions.ts)
src/app/admin/solicitudes/                 (page.tsx, actions.ts)
src/components/registro/                   (FormularioRegistro.tsx, PasoPago.tsx)
src/components/LoginForm.tsx
src/components/admin/AvisoSolicitudes.tsx
src/components/admin/ConfiguracionRegistro.tsx
src/components/admin/LinkRegistro.tsx
src/components/admin/SolicitudCard.tsx
src/lib/configuracion/registro.ts
src/lib/cuenta/password.ts
src/lib/solicitudes/campos.ts
```

**Modificados**
```
src/app/admin/alumnos/actions.ts           (generarPassword salió a lib/cuenta/password.ts)
src/app/admin/alumnos/page.tsx             (aviso de solicitudes pendientes)
src/app/admin/configuracion/actions.ts     (actualizarConfiguracionRegistro)
src/app/admin/configuracion/page.tsx       (tarjeta ConfiguracionRegistro)
src/app/admin/layout.tsx                   (conteo de solicitudes → punto rojo)
src/app/alumno/perfil/actions.ts           (teléfono, sexo, estatura)
src/app/alumno/perfil/data.ts              (teléfono, sexo)
src/app/login/page.tsx                     (pasó a Server Component; el form vive en LoginForm.tsx)
src/components/admin/AdminTabs.tsx         (punto rojo en Alumnos)
src/components/admin/DatosPersonalesSoloLectura.tsx (teléfono con link a WhatsApp, sexo)
src/components/student/DatosPersonalesForm.tsx      (teléfono, sexo, estatura)
src/lib/supabase/types.ts                  (tabla nueva + columnas nuevas)
```

---

## QUÉ SE CONSTRUYÓ

### 1. Registro público (`/registro`) — ACTIVO

Link fijo que el entrenador comparte por WhatsApp. Página pública, sin login.

- Pide: nombre, correo, teléfono/WhatsApp (obligatorios); fecha de nacimiento,
  sexo, estatura, peso, objetivo, condición médica, condición alimenticia y un
  campo libre (opcionales).
- **No crea cuenta de Auth.** Guarda una fila en `solicitudes_registro` con
  estado `pendiente`. Sin aprobación no hay acceso a nada.
- Escribe con el cliente admin (service_role) desde una Server Action. La tabla
  **no tiene política de insert** a propósito: esa acción es la única puerta.
- Anti-spam: campo trampa (`sitio_web`), 5 envíos/hora por IP (en memoria), e
  índice único por correo mientras la solicitud esté pendiente.

### 2. Panel del entrenador (`/admin/solicitudes`) — ACTIVO

- Se llega desde *Alumnos*: tarjeta ámbar "N personas quieren inscribirse"
  cuando hay pendientes, o un renglón discreto con el link cuando no hay.
  También pinta un punto rojo en la pestaña Alumnos (`AdminTabs`).
- Cada solicitud muestra todos los datos, botón de WhatsApp al número que dejó,
  **Corregir** (correo y teléfono), **Aceptar y crear cuenta** y **Rechazar**.
- Al aceptar: crea la cuenta de Auth, `perfiles`, `alumno_perfil` con todos los
  datos de salud, el peso declarado como primera medición en
  `pesos_corporales`, la noticia de bienvenida, y manda las credenciales por
  correo. Si el correo no sale, muestra la contraseña en pantalla para pasarla
  por WhatsApp (mismo criterio que el alta manual).
- `LinkRegistro` arma la URL con el host de la petición (o
  `NEXT_PUBLIC_SITE_URL` si está definida), con botones de copiar y WhatsApp.

### 3. Modo beta — ACTIVO

- `/login` muestra **"Regístrate para la beta"** con el texto de que la app se
  está estrenando.
- `/registro` muestra el recuadro "Esto es una prueba".
- Se apaga desde Configuración → *Registro de alumnos* → "Avisar que la app está
  en prueba". Con eso apagado, el botón queda como un "Regístrate" normal.
- **Por defecto viene encendido**, así que funciona aunque la 0033 no esté
  aplicada.

### 4. Pago de inscripción — CONSTRUIDO PERO APAGADO

Decisión del dueño: durante la beta los alumnos se inscriben sin pagar.

- Interruptor "Pedir el pago de la inscripción" en Configuración, **apagado de
  fábrica** (`pago_registro_activo` default false en la 0033).
- Con el cobro apagado, `/registro` termina en la confirmación de siempre: no
  se muestran datos bancarios ni se pide comprobante. Es el estado actual.
- Al encenderlo aparece el paso 2: datos bancarios con botón de copiar por
  campo, monto, subida del comprobante (imagen o PDF, máx. 12 MB, bucket
  privado `comprobantes`) y envío por WhatsApp.
- En el panel, cada solicitud muestra *Sin comprobante* / *Por revisar* /
  *Verificado*, con el capture visible y el botón "Marcar pago verificado".
  Aceptar sin verificar sigue siendo posible (pago en efectivo), pero avisa.
- Los datos bancarios se guardan estén o no encendidos: se puede dejar todo
  cargado y encender el cobro el día que corresponda.

**Límite conocido de WhatsApp:** una web no puede adjuntar archivos a WhatsApp
por link (`wa.me` solo lleva texto). El botón usa `navigator.share` con el
archivo, que en celular sí puede entregárselo a WhatsApp; en computador cae a
abrir el chat con el mensaje escrito para adjuntar a mano. Por eso el
comprobante se sube a la app: WhatsApp es el aviso, no el registro.

---

## LO QUE FALTA

1. **Desplegar.** Todo esto está solo en local. Sin desplegar, los alumnos no
   pueden usar el link.
2. **Commitear** (no se hizo, faltaba el visto bueno).
3. **Correr la migración 0033** — solo cuando se quiera encender el cobro. Crea
   el bucket `comprobantes` y las columnas de configuración. Se copia entera en
   el SQL editor de Supabase; es idempotente. Hasta entonces la tarjeta de
   Configuración se ve, pero al guardar avisa que falta la 0033.
4. **Probar aceptar/rechazar con sesión de entrenador.** Nunca se probó: hace
   falta la sesión real y no se ingresan credenciales del usuario.

---

## SOLICITUD REAL PENDIENTE

Hay una en la base, sin tocar:

```
jose  mendoza — {alealemenmne@gmail.com — 933001622 — pendiente
```

El correo trae una llave `{` al inicio y dice `alealemenmne` (posible dedazo de
`alealemenmen`). **Con ese correo la aceptación falla**: Supabase rechaza el
formato. Se arregla con el botón **Corregir** de la tarjeta.

De ahí salieron dos cambios: la validación estricta de correo
(`EMAIL_RE` en `src/lib/solicitudes/campos.ts`) y el botón de corregir. Ninguna
validación puede detectar un `gmial.com`, así que conviene mirar el correo antes
de aceptar a cada uno.

---

## VERIFICADO

- `npx tsc --noEmit` y `npx eslint` limpios en todo lo tocado.
- Envío del formulario contra la base real: guarda todos los campos correctos.
- Reenvío con el mismo correo en otras mayúsculas → lo detecta como duplicado.
- Correo inválido (`{...@gmail.com`) → rechazado, no guarda nada.
- Con el cobro apagado, el registro termina en la confirmación, sin paso de pago.
- `/login`, `/registro`, `/admin/solicitudes` y `/admin/configuracion` responden
  200 y se ven bien en móvil (375 px).
- Las filas de prueba se borraron. La única que queda es la de jose mendoza.

**Errores de consola preexistentes** (no son de este trabajo, salen también en
pantallas que no se tocaron): "Can't perform a React state update on a component
that hasn't mounted yet", y errores de lint en
`src/components/student/SesionEjercicioCard.tsx` y `src/lib/noticias/data.ts`.

---

## DECISIONES QUE CONVIENE NO PERDER

- **La solicitud no crea cuenta de Auth.** Si fuera una cuenta bloqueada, un
  link público dejaría a cualquiera creando usuarios en el proyecto de Supabase.
- **El comprobante nunca bloquea el envío.** Alguien puede pagar después o
  mandar el capture por WhatsApp; esa solicitud tiene que llegar igual.
- **Solicitudes no tiene pestaña propia**: cuelga de Alumnos. Seis pestañas es el
  máximo que entra en un celular angosto (ver comentario en `AdminTabs.tsx`).
- **La solicitud original se conserva** al aceptar: es el historial de lo que la
  persona declaró el día que se inscribió, aunque después edite su perfil.
- **El id de la solicitud (uuid v4) es la credencial** para subir el comprobante:
  quien se inscribe todavía no es usuario de la app.

---

## CONVENCIÓN DE HANDOFFS

Este es **HANDOFF 1**. Los siguientes van `HANDOFF_1.1.md`, `HANDOFF_1.2.md`, y
así. Cuando el dueño pida "lee el handoff", se lee **el último** (el de número
más alto).
