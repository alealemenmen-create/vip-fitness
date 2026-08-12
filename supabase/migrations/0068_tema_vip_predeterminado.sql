-- VIP es la experiencia oficial y predeterminada. Espejo pasa a ser un modo
-- compacto opt-in: solo se activa cuando el alumno lo elige expresamente.
alter table alumno_perfil
  alter column tema_boton set default 'vip';

update alumno_perfil
set tema_boton = 'vip'
where tema_boton is null;
