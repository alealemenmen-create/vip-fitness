# Propuesta técnica: integración VIP Fitness (portal) ↔ VIP Fitness Gestión (cntrolvip)

Fecha: 29 de julio de 2026
Estado: **PROPUESTA — no implementada.** No se ha escrito ni modificado código de
producto para este documento. Requiere aprobación explícita de Alejandro antes
de tocar cualquiera de los dos proyectos.

---

## 0. Resumen ejecutivo

Son dos aplicaciones completamente independientes, en nubes distintas, sin base
de datos ni red compartida:

| | VIP Fitness (portal) | VIP Fitness Gestión (cntrolvip) |
|---|---|---|
| Ruta | `C:\Users\aleja\OneDrive\Escritorio\VIP` | `C:\Users\aleja\OneDrive\Escritorio\cntrolvip` |
| Rol | Experiencia del alumno + panel de entrenador (entrenar, comer, progreso, ranking, torneos) | Administración interna del gimnasio (alumnos, planes, pagos, caja, evaluaciones, acceso físico) |
| Stack | Next.js 16 + Supabase (Postgres/RLS/Auth/Storage) | Next.js sobre `vinext`+Vite + Drizzle + Cloudflare D1/R2 |
| Hosting | Vercel (**aún no desplegado**, Fase 2 de su roadmap en pausa) | Sites de ChatGPT/OpenAI, ya publicado |
| Identidad de "alumno" | Usuario real con login (Supabase Auth, uuid) | Fila de datos sin login propio (id entero, sin autenticación de alumno) |
| Git | remoto disponible | **sin remoto**, todo vive local + ZIP de respaldo |

No hay forma de compartir base de datos ni sesión. La única integración
razonable es **API-a-API sobre HTTP, con autenticación por secreto
compartido**, siguiendo exactamente el patrón que cntrolvip ya usa para su
puente físico F19 (`db/access-auth.ts`, header `x-bridge-token` verificado
contra un hash). No se propone ninguna infraestructura nueva (sin colas, sin
VPN, sin base de datos compartida): ambos proyectos ya son apps Next.js con
Route Handlers, así que "agregar un endpoint más" es exactamente el tipo de
cambio que cada proyecto ya sabe hacer.

**Prerrequisito bloqueante:** todo flujo donde cntrolvip llama al portal
necesita que VIP Fitness tenga una URL pública estable. Hoy VIP solo corre en
`localhost`. La Fase 2 de su propio roadmap ("subir a GitHub + deploy en
Vercel", hoy en pausa) debe completarse **antes** de activar cualquier fase de
esta integración. No se propone adelantarla aquí — es una decisión aparte que
ya está anotada como pendiente del propio proyecto.

---

## 1. Qué se integra (y qué se deja fuera a propósito)

Elegí estos cuatro flujos porque son los que generan valor real sin tocar
partes ya afinadas y validadas por el usuario (ranking, gamificación,
seguridad RLS). Cada uno es independiente — se puede aprobar/implementar uno
sin los demás.

1. **Alta de cuenta sin doble tipeo.** Hoy: reception crea al alumno en
   cntrolvip (`students`) y, por separado, el entrenador lo vuelve a crear a
   mano en VIP (`crearAlumnoYEnviarCorreo`). Propuesta: un botón en la ficha
   del alumno en cntrolvip dispara la creación de su cuenta de portal.
2. **Estado de membresía visible en el portal.** Hoy el alumno no sabe en el
   portal si su plan está vigente, cuántas sesiones le quedan o cuándo vence.
   Esa información ya existe en cntrolvip (`cycles`, `payments`) y no se
   duplica su lógica de negocio (cálculo de vencimiento, convenio, etc.) —
   solo se refleja como dato de solo lectura.
3. **Marcado automático de "plan entregado".** `cycles.trainingPlanDelivered`
   / `nutritionPlanDelivered` son hoy checkboxes manuales en cntrolvip. Cuando
   el entrenador publica una rutina o un plan de alimentación en el portal, ya
   sabemos con certeza que se entregó — se propone que el portal avise a
   cntrolvip en vez de que el staff marque la casilla dos veces.
4. **Evaluaciones profesionales visibles en Progreso.** cntrolvip tiene
   evaluaciones mensuales con fórmula US Navy (perímetros, % grasa) que hoy
   están encerradas en la app interna. Se propone mostrarlas como panel de
   solo lectura en `/alumno/progreso`, sin mezclarlas con el peso
   autoreportado (son mediciones de rigor y frecuencia distintos).

**Explícitamente fuera de alcance de esta propuesta:**

- **Asistencia / control de acceso F19 como fuente de la racha o el ranking.**
  El propio HANDOFF de cntrolvip dice que el F19 está "pendiente de validación
  física" — no está en producción todavía. Además mezclar "entró al gimnasio"
  con "registró un entrenamiento en el portal" cambia el significado de
  métricas de gamificación que el usuario ya está afinando en vivo (umbrales
  de `IndicadorEstadoAlumno`). Se deja como fase futura, condicionada a que el
  F19 esté validado y a que el usuario decida explícitamente mezclar ambas
  señales.
- **Single sign-on real (un solo login para las dos apps).** Los roles de
  staff de cntrolvip (Administrador/Recepción/Entrenador/Consulta) y los
  roles de VIP (alumno/entrenador/admin) no son el mismo concepto ni tienen la
  misma superficie de permisos. Unificar login sería un cambio de arquitectura
  mucho más grande, con beneficio dudoso (son dos audiencias distintas: staff
  de mesón vs. alumno en su celular).
- **Pagos o caja disparados desde el portal.** El portal nunca debe poder
  escribir montos, medios de pago o sesiones — esa lógica financiera se queda
  100% en cntrolvip. La integración es de lectura hacia el portal, nunca al
  revés en temas de dinero.

---

## 2. Arquitectura propuesta

```
┌────────────────────────┐                          ┌──────────────────────────┐
│  VIP Fitness (portal)  │                          │  cntrolvip (Gestión)     │
│  Vercel + Supabase      │                          │  Cloudflare D1/R2 (Sites) │
│                         │                          │                          │
│  Route Handlers nuevos  │  ── HTTP + secreto ──►   │  Route Handlers nuevos   │
│  /api/integraciones/... │  ◄── HTTP + secreto ──   │  /api/integrations/...   │
│                         │                          │                          │
│  tabla nueva:           │                          │  columnas nuevas en      │
│  membresia_gestion      │                          │  students, tabla nueva   │
│                         │                          │  integration_sync_log    │
└────────────────────────┘                          └──────────────────────────┘
```

- **Transporte:** HTTPS simple, sin librerías nuevas (`fetch` nativo, como ya
  hace `src/lib/email/resend.ts` en VIP).
- **Autenticación:** un secreto compartido por dirección (dos variables de
  entorno, una por cada app llamando a la otra), verificado con comparación de
  tiempo constante — se reutiliza literalmente la función `timingSafeEqual`
  que ya existe en `db/auth.ts` de cntrolvip, y se replica su patrón (no una
  tabla de tokens por dispositivo como el F19, porque acá solo hay **un**
  interlocutor, no varios equipos físicos).
- **Vínculo de identidad:** se guarda en ambos lados para no depender de un
  round-trip de red cuando cada app necesita el id del otro lado:
  - cntrolvip: `students.vip_portal_user_id` (uuid del alumno en
    `auth.users`/`perfiles`).
  - VIP: `alumno_perfil.gestion_student_id` (id entero de `students`).
- **Resiliencia:** cada llamada saliente debe fallar en silencio hacia el
  usuario final (mostrar "sin datos de membresía por ahora", nunca romper la
  pantalla). Ninguna pantalla del portal ni de cntrolvip debe depender de que
  la otra app esté arriba en ese instante.
- **Reconciliación:** además del push en el momento del evento, un cron diario
  en VIP (mismo mecanismo que `vercel.json` ya usa para
  `/api/cron/reconocimientos`) vuelve a pedir el estado completo de membresía
  para corregir cualquier webhook perdido.

---

## 3. Flujo completo de datos, por caso

### 3.1 Alta de cuenta de portal (cntrolvip → VIP)

1. Staff (Recepción/Admin) abre la ficha del alumno en cntrolvip y pulsa
   "Invitar al Portal VIP".
2. Server Action nueva en cntrolvip llama
   `POST {VIP_URL}/api/integraciones/gestion/alumnos` con
   `{ nombre, email, studentId, vipCode }`, firmado con
   `PORTAL_INTEGRATION_SECRET`.
3. VIP recibe la petición, reutiliza **exactamente** la lógica ya validada de
   `crearAlumnoYEnviarCorreo` (`src/app/admin/alumnos/actions.ts`): crea el
   usuario en Supabase Auth (`admin.auth.admin.createUser` / `inviteUserByEmail`),
   inserta en `perfiles` y `alumno_perfil`, manda el correo de invitación vía
   `enviarCorreo` (Resend). Guarda `gestion_student_id = studentId` en la fila
   nueva de `alumno_perfil`.
4. VIP responde `{ portalUserId }`.
5. cntrolvip guarda `vip_portal_user_id = portalUserId` en `students`.
6. Si el alumno ya tenía cuenta manual en VIP (caso de los alumnos reales de
   hoy, creados a mano) o ya existía como `students` en cntrolvip sin cuenta de
   portal: pantalla de **vinculación manual** en cntrolvip que busca por email
   (`POST {VIP_URL}/api/integraciones/gestion/alumnos/vincular`) en vez de
   crear una cuenta nueva — evita duplicar alumnos.

### 3.2 Estado de membresía (cntrolvip → VIP)

1. Disparadores en cntrolvip: alta de `payments`, cambio de `cycles.status`,
   cierre/renovación de ciclo, y un cron propio (o el mismo endpoint invocado
   por el cron de reconciliación de VIP).
2. `POST {VIP_URL}/api/integraciones/gestion/membresia` con
   `{ portalUserId, plan, sesionesRestantes, vigenciaHasta, estado }`.
3. VIP hace upsert en la tabla nueva `membresia_gestion` (una fila por
   alumno).
4. `/alumno/inicio` y el panel del entrenador leen `membresia_gestion` igual
   que hoy leen `alumno_perfil` — solo lectura, con RLS idéntico al resto del
   proyecto.
5. **Red de seguridad:** cron diario en VIP
   (`/api/cron/sincronizar-membresias`) que llama
   `GET {CNTROLVIP_URL}/api/integrations/portal/membresias` (bulk, todos los
   alumnos vinculados) y corrige cualquier fila desincronizada.

### 3.3 Plan entregado (VIP → cntrolvip)

1. El entrenador publica una rutina (flujo de Etapa 4, importación por IA o
   editor manual) o un plan de alimentación (Tarea 5 del roadmap).
2. Al confirmar la publicación, VIP llama
   `POST {CNTROLVIP_URL}/api/integrations/portal/delivery` con
   `{ studentId, tipo: 'rutina' | 'alimentacion', entregadoEn }` (usa
   `gestion_student_id` ya guardado, sin necesidad de buscarlo).
3. cntrolvip marca `cycles.trainingPlanDelivered` /
   `cycles.nutritionPlanDelivered = true` en el ciclo activo de ese alumno.
4. Si el alumno no tiene `gestion_student_id` (no vinculado), VIP simplemente
   no llama nada — no es un error, es el caso normal para alumnos sin
   contraparte en cntrolvip todavía.

### 3.4 Evaluaciones profesionales (VIP ← cntrolvip, on-demand)

1. Al abrir `/alumno/progreso` (o el entrenador la ficha del alumno), VIP hace
   `GET {CNTROLVIP_URL}/api/integrations/portal/evaluaciones?studentId=...`
   en el server component, con timeout corto.
2. Se muestra un panel nuevo "Controles profesionales" (fecha, peso, % grasa
   estimado) **separado** de la gráfica de peso autoreportado — nunca se
   mezclan las series.
3. Sin caché ni tabla nueva en VIP: si cntrolvip no responde a tiempo, el
   panel se omite sin afectar el resto de la página. Es de bajo tráfico (solo
   se pide cuando alguien mira esa pantalla), así que no justifica
   sincronización activa.

---

## 4. Tablas y columnas — nuevas o modificadas

### VIP Fitness (Supabase — nueva migración `0025_integracion_gestion.sql`)

| Tabla | Cambio | Notas |
|---|---|---|
| `alumno_perfil` | `+ gestion_student_id integer` (nullable, unique) | id de `students` en cntrolvip. Nullable: la mayoría de alumnos hoy no tendrán valor hasta que se vinculen. |
| `membresia_gestion` (nueva) | `alumno_id uuid PK/FK → perfiles(id) on delete cascade`, `plan text`, `sesiones_restantes int`, `vigencia_hasta date`, `estado text check (estado in ('activo','por_vencer','vencido'))`, `actualizado_en timestamptz` | RLS igual que el resto: `alumno_id = auth.uid() or es_entrenador_de(alumno_id)` para `select`; **sin política de `insert`/`update` para alumno ni entrenador** — solo lo escribe el endpoint del webhook usando `createAdminClient()` (mismo patrón que `obtenerRankingSemanal`). |
| `integration_sync_log` (nueva, opcional) | `id uuid`, `direccion text`, `evento text`, `alumno_id uuid`, `ok boolean`, `detalle text`, `created_at timestamptz` | Solo para depurar la integración misma; no bloqueante, se puede omitir en Fase 1 si se prefiere menos superficie. |

**Recordatorio obligatorio** (ya es un riesgo conocido y documentado del
proyecto): cualquier columna/tabla nueva debe reflejarse a mano en
`src/lib/supabase/types.ts` en el mismo cambio, o el build pasa "limpio" con
tipos mentirosos — exactamente el bug que ya pasó con las migraciones 0018/0019/0023.

### cntrolvip (Drizzle — nueva migración generada con `npm run db:generate` tras editar `db/schema.ts`)

| Tabla | Cambio | Notas |
|---|---|---|
| `students` | `+ vipPortalUserId text` (nullable, unique), `+ vipPortalLinkedAt text` (nullable) | uuid del alumno en Supabase Auth. |
| `integration_sync_log` (nueva, opcional) | espejo de la de VIP, para depurar desde el lado de cntrolvip | Mismo criterio: opcional en Fase 1. |

No se toca ninguna tabla existente de `access-bridge`/F19 — esta integración
es completamente ajena a ese subsistema.

---

## 5. Endpoints y funciones nuevas

### En VIP (`src/app/api/integraciones/...`, Route Handlers nuevos)

| Endpoint | Método | Quién lo llama | Qué hace |
|---|---|---|---|
| `/api/integraciones/gestion/alumnos` | `POST` | cntrolvip | Crea cuenta de portal reutilizando `crearAlumnoYEnviarCorreo`. |
| `/api/integraciones/gestion/alumnos/vincular` | `POST` | cntrolvip | Busca alumno existente por email, vincula sin crear cuenta nueva. |
| `/api/integraciones/gestion/membresia` | `POST` | cntrolvip | Upsert en `membresia_gestion`. |
| `/api/cron/sincronizar-membresias` | `GET` (cron) | Vercel Cron | Reconciliación diaria, pide bulk a cntrolvip. |

Funciones nuevas de soporte: `src/lib/integraciones/gestion.ts` (cliente HTTP
hacia cntrolvip: `entregarPlan()`, `pedirEvaluaciones()`) y
`src/lib/integraciones/auth.ts` (verificación del secreto entrante, calcada de
`timingSafeEqual` de cntrolvip).

### En cntrolvip (`app/api/integrations/portal/...`, Route Handlers nuevos)

| Endpoint | Método | Quién lo llama | Qué hace |
|---|---|---|---|
| `/api/integrations/portal/delivery` | `POST` | VIP | Marca `trainingPlanDelivered`/`nutritionPlanDelivered`. |
| `/api/integrations/portal/membresias` | `GET` | VIP (cron) | Bulk de estado de membresía de todos los alumnos vinculados. |
| `/api/integrations/portal/evaluaciones` | `GET` | VIP (on-demand) | Evaluaciones de un alumno por `studentId`. |

Función nueva de soporte: `db/portal-auth.ts` (mismo patrón que
`db/access-auth.ts`, pero para el secreto compartido con VIP, no para
dispositivos F19).

Server Action nueva en cntrolvip: botón "Invitar al Portal VIP" /
"Vincular cuenta existente" en la ficha del alumno (`app/api/students` o la
página de detalle, según dónde viva hoy esa ficha).

---

## 6. Cambios necesarios en cada proyecto

**VIP Fitness:**
- Migración `supabase/migrations/0025_integracion_gestion.sql` + reflejo manual
  en `src/lib/supabase/types.ts`.
- 4 Route Handlers nuevos bajo `src/app/api/integraciones/`.
- `src/lib/integraciones/` (cliente + verificación de secreto).
- Nuevas env vars en `.env.local` / `.env.local.example`:
  `PORTAL_INTEGRATION_SECRET` (secreto que cntrolvip usa para llamar a VIP),
  `GESTION_INTEGRATION_SECRET` (secreto que VIP usa para llamar a cntrolvip),
  `GESTION_API_URL=https://vip-fitness-gestion.alealemenmen.chatgpt.site`.
- `vercel.json`: agregar el cron de reconciliación (revisar límites del plan
  de Vercel — Hobby restringe la frecuencia de crons adicionales).
- Cambios chicos en `src/app/admin/alumnos/actions.ts` para exponer
  `crearAlumnoYEnviarCorreo` de forma invocable también desde el endpoint de
  integración (misma función, no reescribirla).
- Botón/llamada nueva en el flujo de publicar rutina y plan de alimentación
  para disparar 3.3.
- Panel nuevo (solo lectura) en `/alumno/progreso` para 3.4.

**cntrolvip:**
- Editar `db/schema.ts` (columnas en `students`) + `npm run db:generate` →
  nueva migración en `drizzle/` (nunca editar una ya aplicada).
- 3 Route Handlers nuevos bajo `app/api/integrations/portal/`.
- `db/portal-auth.ts` nuevo.
- Botón "Invitar al Portal VIP" / "Vincular cuenta existente" en la ficha del
  alumno + Server Action que la respalda.
- Nuevas variables de entorno: `.dev.vars` en local y secreto equivalente en
  Sites (mismo mecanismo que ya usan para `ACCESS_BRIDGE_KEY`):
  `PORTAL_INTEGRATION_SECRET`, `GESTION_INTEGRATION_SECRET`, `PORTAL_API_URL`.
- Actualizar `HANDOFF.md` con la nueva integración (ya es la fuente de verdad
  del proyecto).

---

## 7. Riesgos

1. **Acoplamiento entre nubes distintas.** Una llamada de Vercel a Cloudflare
   (o viceversa) puede fallar por cold start, límite de rate o caída temporal
   de cualquiera de las dos plataformas gratuitas/hobby. Mitigación: cada
   llamada saliente con timeout corto (2-3s) y **degradación silenciosa**
   (nunca romper la pantalla del usuario final por esto).
2. **cntrolvip no tiene remoto Git.** Cualquier cambio ahí solo existe en esta
   máquina hasta el próximo ZIP de respaldo o publicación a Sites. Si se
   pierde el ZIP entre el cambio de schema y el respaldo, se pierde el
   trabajo. Mitigación: respaldo inmediato después de cada fase implementada
   ahí, como ya es regla del proyecto.
3. **VIP aún no está desplegado.** Toda esta propuesta asume que se completa
   primero el deploy (Fase 2 del roadmap de VIP, hoy en pausa). Si eso se
   demora, la integración completa queda bloqueada — no hay forma de que
   cntrolvip llame a `localhost:3001` del usuario.
4. **Clave de emparejamiento débil.** cntrolvip permite `email` vacío/duplicado
   en `students` (`text().notNull().default("")`, sin `unique`). El
   emparejamiento automático por email puede fallar o cruzar dos personas
   distintas si hay datos sucios. Mitigación: la vinculación automática de la
   Fase 1 (alta nueva) no tiene este problema porque el email se escribe una
   sola vez, en el momento de crear ambas cuentas a la vez; el problema real
   es solo al vincular alumnos **ya existentes** — por eso esa pantalla debe
   pedir confirmación humana explícita (mostrar nombre + email de ambos lados
   antes de vincular), nunca auto-vincular en silencio por coincidencia.
5. **Datos sensibles cruzando de sistema.** Peso, % de grasa corporal y
   condición médica son datos delicados. Cruzarlos entre dos sistemas
   duplica la superficie de exposición si un secreto se filtra. Mitigación:
   principio de mínima información — no se sincroniza `condicion_medica` ni
   `restriccion_alimenticia` a cntrolvip (no hay caso de uso ahí), y las
   evaluaciones de cntrolvip se piden on-demand en vez de guardarse
   duplicadas en VIP.
6. **Doble mantenimiento de tipos/esquema.** Cada lado tiene su propia forma
   de reflejar el esquema a mano (`types.ts` en VIP, generación de Drizzle en
   cntrolvip) — ya es una fuente de bugs documentada en este mismo proyecto
   (memoria: migraciones 0018/0019/0023 nunca aplicadas pese a que `types.ts`
   sí las declaraba). El riesgo se multiplica al agregar un tercer contrato
   (el HTTP entre ambos): un cambio de forma en un lado sin avisar al otro
   rompe la integración sin que ningún `tsc` lo detecte (son proyectos
   separados, no hay tipos compartidos). Mitigación: versionar el "shape" del
   payload en el propio JSON (`{ version: 1, ... }`) desde el día uno.
7. **Vercel Cron en plan Hobby.** Puede tener límites de frecuencia/cantidad
   de crons — revisar antes de asumir que el cron diario de reconciliación
   corre exactamente a la hora esperada.

---

## 8. Estrategia de despliegue

- **Todo aditivo, nunca destructivo.** Ninguna columna existente cambia de
  tipo ni se borra; todo lo nuevo es nullable o tiene default seguro.
- **Interruptor de apagado inmediato en ambos lados**, por variable de
  entorno (`INTEGRACION_GESTION_HABILITADA`): si algo falla en producción, se
  apaga la integración sin rollback de base de datos ni redeploy urgente —
  los endpoints simplemente responden 503 "integración deshabilitada" y cada
  app sigue funcionando exactamente como hoy.
- **Fases independientes.** Ninguna fase depende de que la siguiente exista;
  se puede aprobar y usar solo 3.1, o solo 3.1+3.2, indefinidamente.
- **Alumno por alumno, no todo o nada.** Como el vínculo vive en
  `gestion_student_id` / `vip_portal_user_id` (nullable), se puede vincular
  de a un alumno de prueba primero, confirmar que todo funciona, y recién
  después ofrecer el botón al resto del staff.
- **Nunca tocar datos reales para probar** — regla ya vigente en ambos
  proyectos (memoria de VIP y regla explícita del `HANDOFF.md` de cntrolvip):
  probar primero con alumnos de prueba (`@vipfitness.test` en VIP,
  alumno ficticio en cntrolvip) antes de vincular una cuenta real.

---

## 9. Plan de rollback

Como todo es aditivo y con interruptor, el rollback nunca requiere una
migración "hacia atrás":

| Si falla... | Rollback |
|---|---|
| Un endpoint nuevo (cualquiera) | Apagar `INTEGRACION_GESTION_HABILITADA` en esa app. El resto sigue funcionando. |
| El cron de reconciliación | Quitar la entrada de `vercel.json` (o dejarlo fallar silenciosamente — no escribe nada si cntrolvip no responde). |
| Una migración de columna nueva | No hace falta down-migration: se deja la columna sin usar (ya hay precedente aceptado en este mismo proyecto — columna `autor` de notas quedó sin usar tras revertir esa feature). |
| Vinculación incorrecta de un alumno | Poner `gestion_student_id` / `vip_portal_user_id` de vuelta en `null` para esa fila puntual — no afecta a nadie más. |
| Toda la integración deja de tener sentido | Ambos proyectos quedan exactamente como están hoy; las tablas/columnas nuevas quedan huérfanas pero inofensivas, igual que ya pasó antes. |

---

## 10. Orden recomendado de implementación

**Fase 0 — Preparación (bloqueante para todo lo demás)**
- Confirmar y completar el deploy de VIP a producción (Fase 2 de su propio
  roadmap).
- Generar y guardar los secretos compartidos en ambos entornos.
- Migraciones aditivas en ambos lados (columnas de vínculo).
- Respaldo de cntrolvip antes de tocar `db/schema.ts` (regla ya vigente ahí).

**Fase 1 — Alta de cuenta sin doble tipeo (3.1)**
- Menor riesgo, mayor beneficio inmediato (elimina el trabajo duplicado de
  cada alta nueva). Probar primero con un alumno de prueba.

**Fase 2 — Estado de membresía en el portal (3.2)**
- El flujo más visible para el alumno. Empezar solo con push (sin cron) para
  validar el contrato, agregar el cron de reconciliación después.

**Fase 3 — Plan entregado automático (3.3)**
- Bajo riesgo (solo mueve un booleano informativo en cntrolvip), buen ahorro
  de trabajo manual para el staff.

**Fase 4 — Evaluaciones profesionales en Progreso (3.4)**
- Última porque es la que menos urge y toca una pantalla ya sensible
  (Progreso) que el usuario validó recientemente.

**Fase futura (condicionada, no planificada aún)**
- Asistencia/F19 como señal de constancia — solo después de que el F19 esté
  validado físicamente en cntrolvip y el usuario decida explícitamente
  mezclar esa señal con el ranking actual.

---

## Preguntas abiertas para Alejandro antes de aprobar

1. ¿Los 4 flujos (3.1–3.4) son los que quiere, o prioriza solo alguno?
2. ¿Confirma que el deploy de VIP a Vercel (Fase 2 de su roadmap) se hace
   antes de empezar esta integración, o prefiere probar la Fase 1 en un túnel
   temporal (ngrok/similar) mientras tanto?
3. ¿Quiere la tabla `integration_sync_log` (auditoría de la integración misma)
   desde la Fase 1, o prefiere agregarla más adelante si hace falta depurar
   algo?
