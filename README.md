# VIP Fitness — Portal del alumno y panel de entrenador

Next.js (App Router) + Supabase (Postgres, Auth y Storage). Ver el plan completo de
etapas y la especificación funcional en las instrucciones del proyecto.

Estado actual: **Etapa 2 completada** — login real, Inicio del alumno conectado a
datos reales, notas del entrenador, objetivo y próximo control gestionables desde el
panel de administración. Entrenar / Comer / Progreso / Documentos son pantallas
"en construcción" hasta sus etapas correspondientes (3, 5, 6 y 7).

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta y un proyecto nuevo
   (elige la región más cercana, por ejemplo São Paulo).
2. En **Project Settings → API**, copia:
   - `Project URL`
   - `anon public key`
3. Crea el archivo `.env.local` en la raíz del proyecto (mismo nivel que
   `package.json`) copiando `.env.local.example` y pegando esos dos valores:

   ```bash
   cp .env.local.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```

   Este archivo nunca se sube a git (ya está en `.gitignore`).

## 2. Aplicar el esquema de base de datos

En el panel de Supabase, abre **SQL Editor** y ejecuta, en este orden:

1. `supabase/migrations/0001_init.sql` — todas las tablas y las políticas de
   seguridad (RLS): cada alumno ve solo sus datos, cada entrenador ve solo a sus
   alumnos asignados.
2. `supabase/migrations/0002_storage.sql` — crea los buckets privados `documentos`
   y `fotos-progreso` con sus políticas de acceso.
3. `supabase/seed.sql` — carga el catálogo inicial de ~37 alimentos (el mismo del
   prototipo), para que Etapa 5 (Comer) tenga datos reales desde el día uno.

(Si prefieres usar la CLI de Supabase en vez de pegar el SQL a mano, `supabase db
push` con estos mismos archivos en `supabase/migrations/` funciona igual.)

## 3. Crear tu primer usuario entrenador/admin

Supabase Auth no permite insertar contraseñas por SQL directo, así que el primer
usuario se crea desde el dashboard:

1. **Authentication → Users → Add user** → ingresa tu correo y una contraseña.
2. Copia el `User UID` que se generó.
3. En **SQL Editor**, ejecuta (reemplazando el UID y tu nombre):

   ```sql
   insert into perfiles (id, nombre, rol)
   values ('EL-UID-QUE-COPIASTE', 'Tu Nombre', 'entrenador');
   ```

Repite el mismo proceso para cada alumno, usando `rol = 'alumno'`. Para vincular un
alumno a su entrenador y asignarle un objetivo:

```sql
insert into alumno_perfil (user_id, entrenador_id, objetivo)
values ('UID-DEL-ALUMNO', 'UID-DEL-ENTRENADOR', 'Recomposición corporal');
```

Desde ahí, todo lo demás (notas, próximo control) ya se gestiona desde la interfaz
en `/admin/alumnos`.

## 4. Correr el proyecto

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — redirige automáticamente a
`/login`. Entra con las credenciales del usuario que creaste en el paso 3.

## Estructura relevante

- `supabase/migrations/` — esquema SQL y políticas de seguridad (fuente de verdad
  de la base de datos).
- `src/lib/supabase/` — clientes de Supabase (browser, server, middleware) y el
  tipado manual del esquema (`types.ts`).
- `src/lib/auth.ts` — verificación de sesión y rol **en el servidor** (no solo se
  ocultan botones en la interfaz).
- `src/app/alumno/` — portal del alumno.
- `src/app/admin/` — panel de entrenador/administrador.

## Notas de seguridad

- Row Level Security está activo en todas las tablas: aunque alguien obtenga la
  `anon key` (es pública por diseño), Postgres rechaza cualquier consulta que no
  cumpla las políticas definidas en `0001_init.sql`.
- Los buckets de Storage son privados; el acceso a fotos y PDFs pasa por las mismas
  políticas de Postgres aplicadas a `storage.objects`.
- No hay ninguna clave de IA (Anthropic) integrada todavía — se agrega recién en la
  Etapa 4, en un endpoint del servidor, nunca en el navegador.
