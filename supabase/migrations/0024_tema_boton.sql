-- El tema de botones (espejo/vip/femenino) vivía solo en localStorage del
-- navegador: si el alumno entraba desde otro dispositivo o borraba datos del
-- sitio, la app volvía al tema por defecto aunque él ya hubiera elegido otro.
-- Se persiste también en la cuenta para que sobreviva a eso.
alter table alumno_perfil
  add column tema_boton text check (tema_boton is null or tema_boton in ('espejo', 'vip', 'femenino'));
