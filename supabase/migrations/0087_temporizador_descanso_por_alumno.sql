-- Temporizador de descanso apagable por alumno.
--
-- A varios alumnos el reloj entre series les estorba: entrenan mirando el
-- número en vez de la máquina. Hasta ahora la única salida era aguantarlo,
-- porque el descanso está programado ejercicio por ejercicio.
--
-- El interruptor es del entrenador, no del alumno: apagarlo también apaga el
-- descuento de Puntos VIP por descanso excedido (cobrar por un reloj que el
-- alumno no ve sería una trampa), y esa regla no puede quedar a decisión de
-- cada uno. Los segundos programados no se tocan: siguen ahí, visibles como
-- referencia, y vuelven a correr apenas se reactive.

alter table public.alumno_perfil
  add column if not exists temporizador_descanso boolean not null default true;

comment on column public.alumno_perfil.temporizador_descanso is
  'Cuenta regresiva entre series. En false el descanso solo se muestra como referencia y no descuenta Puntos VIP.';
