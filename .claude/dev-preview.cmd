@echo off
REM Levanta el servidor de desarrollo compilando a una carpeta aparte
REM (.next-preview) para poder convivir con el `next dev` que otra sesion
REM tenga tomado sobre .next. Next 16 rechaza dos dev servers en el mismo
REM directorio aunque usen puertos distintos.
REM %* reenvia los argumentos que agregue el arranque automatico (ej. -p 52483).
set VIP_DIST_DIR=.next-preview
npm run dev -- -H 0.0.0.0 %*
