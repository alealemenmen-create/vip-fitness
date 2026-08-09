# Mensaje listo para copiar y pegar en Claude

Claude, eres el agente principal del proyecto VIP Fitness. Necesito que tomes control del trabajo local ubicado en `C:\dev\vip-fitness`, lo revises completamente, confirmes que está correcto y lo respaldes en GitHub para poder descargarlo y continuar desde otro computador.

No empieces escribiendo código ni subiendo archivos. Sigue este procedimiento completo y en este orden.

## 1. Lee primero todo el contexto obligatorio

Lee completamente, sin omitir secciones:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md`
4. `docs/GENERADOR_RUTINAS_VIP.md`
5. `supabase/migrations/0051_generador_rutinas.sql`
6. `src/lib/generador-rutinas/tipos.ts`
7. `src/lib/generador-rutinas/motor.ts`
8. `src/lib/generador-rutinas/motor.test.ts`
9. `src/app/admin/generador/page.tsx`
10. `src/app/admin/generador/actions.ts`
11. `src/components/admin/GeneradorRutinasPanel.tsx`
12. `src/app/alumno/mi-entrenamiento/page.tsx`
13. `src/app/alumno/mi-entrenamiento/actions.ts`
14. `src/components/student/PerfilEntrenamientoForm.tsx`
15. Los cambios en `src/app/admin/archivos/actions.ts`, `src/lib/ai/extraerRutina.ts`, `src/components/admin/AdminTabs.tsx` y `src/components/student/MenuAlumno.tsx`.

Este proyecto utiliza Next.js 16.2.12 y `AGENTS.md` exige consultar la documentación correspondiente dentro de `node_modules/next/dist/docs/` antes de modificar código Next.js.

## 2. Comprende el resultado esperado

El Generador de Rutinas debe permanecer dentro del portal VIP Fitness, no como una aplicación separada.

- El alumno completa su objetivo, disponibilidad, experiencia, preferencias y antecedentes en `/alumno/mi-entrenamiento`.
- El entrenador trabaja desde `/admin/generador`.
- El alumno nunca genera ni publica rutinas.
- El motor solamente selecciona ejercicios reales y activos mediante `ejercicioId`.
- La IA puede proponer en el futuro, pero nunca puede inventar ejercicios, relajar prohibiciones ni publicar.
- El entrenador revisa el borrador y tiene la última palabra.
- El flujo histórico de PDF debe seguir funcionando.
- Cardio va al final según la metodología VIP.
- Los antecedentes de salud generan alertas; el sistema no diagnostica ni prescribe rehabilitación.

## 3. Audita el repositorio antes de tocar Git

Ejecuta:

```powershell
git status -sb
git branch --show-current
git log --oneline --decorate -20
git remote -v
git diff --check
git diff -- src/app/admin/archivos/actions.ts src/components/admin/AdminTabs.tsx src/components/student/MenuAlumno.tsx src/lib/ai/extraerRutina.ts CLAUDE.md
```

Luego revisa todos los archivos nuevos del generador.

Información conocida que debes verificar:

- La rama local `main` aparecía 13 commits por delante de `origin/main`.
- Existen cambios nuevos sin commit correspondientes al generador.
- Existe `respaldo-cloud-ia-2026-08-09.bundle` como archivo sin seguimiento. No fue creado por este trabajo.
- No debes borrar, modificar ni agregar automáticamente ese `.bundle` al commit.
- No incluyas `.env.local`, credenciales, tokens, instaladores, archivos temporales, `.next`, `.next-preview` ni secretos.
- No uses `git add -A` mientras existan archivos ajenos o no confirmados.
- No uses `git reset --hard`, `git checkout --`, `git clean` ni operaciones destructivas.

## 4. Revisa técnicamente la implementación

Comprueba como mínimo:

- Que la migración 0051 sea SQL válido y siga el estilo de las migraciones anteriores.
- Que las políticas RLS permitan al alumno editar solamente su perfil y al entrenador gestionar únicamente a sus alumnos.
- Que ninguna Server Action confíe únicamente en la interfaz para autorización.
- Que `ejercicioId` se valide contra la biblioteca activa antes de publicar.
- Que el emparejamiento por nombre siga disponible para PDFs antiguos.
- Que prohibidos, obligatorios, preferidos, nivel, máquinas, saltos y cardio se respeten.
- Que cardio también respete la exclusión de saltos e impacto alto.
- Que el editor conserve `ejercicioId` al modificar un borrador.
- Que la rutina publicada siga creando la configuración de Impulso VIP.
- Que las rutas nuevas aparezcan correctamente en el build.
- Que no haya diagnósticos médicos ni decisiones clínicas automáticas.
- Que el código no dependa de que 0051 ya esté aplicada durante el build.

Si encuentras un defecto real, corrígelo antes de publicar. No amplíes el alcance con funciones nuevas salvo que sean imprescindibles para que este MVP funcione y compile.

## 5. Ejecuta todas las verificaciones

Usa los ejecutables compatibles con PowerShell de Windows:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd eslint src/lib/generador-rutinas src/app/admin/generador src/app/alumno/mi-entrenamiento src/components/admin/GeneradorRutinasPanel.tsx src/components/student/PerfilEntrenamientoForm.tsx src/components/admin/AdminTabs.tsx src/components/student/MenuAlumno.tsx src/lib/ai/extraerRutina.ts
npm.cmd run build
git diff --check
```

Estado anterior conocido:

- 113 pruebas aprobadas.
- TypeScript aprobado.
- Lint focalizado aprobado.
- Build de producción aprobado.

El lint global puede entrar en `.next-preview`, que contiene código generado previamente. Si sucede, documenta esa causa y usa lint focalizado sobre el código fuente. No edites código compilado dentro de `.next-preview`.

Si el build falla solamente porque Next.js no puede descargar Inter desde Google Fonts, repítelo con acceso de red. No cambies la arquitectura de fuentes únicamente por una restricción temporal del entorno.

## 6. Prepara un respaldo seguro en una rama nueva

No trabajes directamente sobre `main`. Como la rama local contiene commits todavía no publicados, crea una rama de respaldo desde el estado local actual para conservarlos junto con el generador:

```powershell
git switch -c claude/respaldo-generador-rutinas-vip
```

Si esa rama ya existe, inspecciónala antes de reutilizarla. No la sobrescribas ni hagas force push.

La rama nueva debe partir del `main` local actual, de modo que incluya los 13 commits locales anteriores además del nuevo trabajo del generador.

## 7. Agrega solamente los archivos correctos

Agrega explícitamente estos archivos y carpetas:

```powershell
git add -- CLAUDE.md HANDOFF_GENERADOR_RUTINAS_CLAUDE.md MENSAJE_PARA_CLAUDE_GITHUB.md docs/GENERADOR_RUTINAS_VIP.md supabase/migrations/0051_generador_rutinas.sql src/lib/generador-rutinas src/app/admin/generador src/app/alumno/mi-entrenamiento src/components/admin/GeneradorRutinasPanel.tsx src/components/student/PerfilEntrenamientoForm.tsx src/app/admin/archivos/actions.ts src/components/admin/AdminTabs.tsx src/components/student/MenuAlumno.tsx src/lib/ai/extraerRutina.ts
```

Después ejecuta:

```powershell
git status --short
git diff --cached --check
git diff --cached --stat
```

Confirma expresamente que `respaldo-cloud-ia-2026-08-09.bundle` NO esté staged. Si aparece staged, sácalo solamente del staging sin borrarlo del disco:

```powershell
git restore --staged -- respaldo-cloud-ia-2026-08-09.bundle
```

También confirma que no exista ningún secreto o `.env.local` staged.

## 8. Crea el commit

Si las verificaciones son correctas, crea un commit claro:

```powershell
git commit -m "Agregar generador de rutinas VIP con reglas y perfiles"
```

No modifiques ni reescribas los 13 commits locales anteriores. No hagas squash, rebase o amend de trabajo ajeno salvo autorización explícita.

## 9. Autentica GitHub solamente si hace falta

GitHub CLI portátil quedó instalado y agregado al PATH del usuario. En una nueva ventana de PowerShell debería funcionar:

```powershell
gh --version
```

Si `gh` todavía no se reconoce en la sesión actual, usa la ruta completa:

```powershell
& "C:\Users\vipfi\AppData\Local\Programs\GitHub CLI Portable\bin\gh.exe" --version
```

Si no hay sesión iniciada:

```powershell
gh auth login
```

o:

```powershell
& "C:\Users\vipfi\AppData\Local\Programs\GitHub CLI Portable\bin\gh.exe" auth login
```

Permite que el usuario complete la autorización web. Nunca pidas que pegue un token dentro del repositorio o en un archivo.

Verifica:

```powershell
gh auth status
gh repo view --json nameWithOwner,defaultBranchRef
```

El remoto conocido es:

```text
https://github.com/alealemenmen-create/vip-fitness.git
```

Confirma que la cuenta autenticada tenga acceso a ese repositorio antes de empujar.

## 10. Sube la rama sin sobrescribir nada

Ejecuta:

```powershell
git push -u origin claude/respaldo-generador-rutinas-vip
```

No uses `--force`, `--force-with-lease` ni empujes directamente a `main`.

Después verifica que la rama remota exista:

```powershell
git ls-remote --heads origin claude/respaldo-generador-rutinas-vip
gh repo view --web
```

## 11. Crea un Pull Request de respaldo y revisión

Crea un PR en modo borrador desde `claude/respaldo-generador-rutinas-vip` hacia la rama predeterminada remota, normalmente `main`.

Título sugerido:

```text
Agregar generador de rutinas VIP con reglas y perfiles
```

El cuerpo debe explicar:

- Nueva pestaña Generar para el entrenador.
- Nuevo perfil de entrenamiento para el alumno.
- Motor determinista con IDs reales.
- Compatibilidad con PDFs.
- Migración 0051 pendiente de aplicar en pruebas.
- Alertas de salud sin diagnóstico automático.
- Pruebas, TypeScript, lint y build ejecutados.
- Funciones avanzadas que siguen pendientes según el handoff.

Usa:

```powershell
gh pr create --draft --base main --head claude/respaldo-generador-rutinas-vip --title "Agregar generador de rutinas VIP con reglas y perfiles" --body-file RUTA_A_UN_ARCHIVO_TEMPORAL_FUERA_DEL_REPOSITORIO
```

Si la rama predeterminada no es `main`, usa la que devuelva `gh repo view`.

No fusiones el PR automáticamente. El propósito inmediato es respaldar y permitir revisión.

## 12. No apliques todavía cambios externos

Aunque el archivo SQL esté en GitHub:

- No apliques 0051 en producción.
- No despliegues a producción.
- No publiques rutinas a alumnos reales.
- No cambies variables de entorno.
- No elimines datos existentes.

La migración se aplicará primero en Supabase de pruebas cuando el usuario lo autorice.

## 13. Entrega un informe final al usuario

Al terminar, responde con:

1. Rama local y remota creada.
2. Hash y mensaje del commit nuevo.
3. Confirmación de que los 13 commits locales quedaron contenidos en la rama remota.
4. URL exacta del Pull Request borrador.
5. Resultado de pruebas, TypeScript, lint y build.
6. Confirmación de que el `.bundle`, `.env.local` y secretos no se subieron.
7. Confirmación de que no se aplicó ninguna migración ni despliegue.
8. Cualquier corrección técnica que hayas realizado.
9. Instrucciones para el otro computador.

Para un clon nuevo en el otro computador:

```powershell
git clone https://github.com/alealemenmen-create/vip-fitness.git
cd vip-fitness
git fetch origin
git switch --track origin/claude/respaldo-generador-rutinas-vip
npm.cmd install
```

Para un repositorio que ya existe en el otro computador:

```powershell
cd RUTA_DEL_PROYECTO
git status
git fetch origin
git switch --track origin/claude/respaldo-generador-rutinas-vip
npm.cmd install
```

Si ya existe una rama local con ese nombre, no la sobrescribas. Inspecciona su estado y explica al usuario qué comando seguro corresponde.

Finalmente, indícale al usuario con claridad: **“El respaldo ya está en GitHub y puedes cambiar de computador”** solamente después de confirmar que el push remoto y el PR se crearon correctamente.

