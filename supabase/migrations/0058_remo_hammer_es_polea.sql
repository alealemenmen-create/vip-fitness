-- "Remo Hammer" no es una máquina: es un montaje.
--
-- El entrenador lo hace con un banco de hombros puesto de frente a la polea,
-- pecho apoyado contra el respaldo, tirando con agarre hammer. Estaba cargado
-- como `equipo = 'maquina'`, y eso hacía creer —al motor y sobre todo al
-- filtro de IA, que ve el equipo de cada ejercicio— que el gimnasio tiene una
-- máquina de remo Hammer además del remo con pecho apoyado. No la tiene: son
-- dos cosas distintas y esta se arma con lo que ya está en la sala.
--
-- La descripción no es decorativa: el alumno lee esta rutina y tiene que
-- saber cómo montar el ejercicio, porque no hay una máquina rotulada que se
-- lo diga.

update ejercicios
set equipo = 'polea',
    descripcion_corta = 'Banco de hombros de frente a la polea, pecho apoyado en el respaldo. Tira con agarre hammer (palmas enfrentadas), llevando los codos hacia atrás y pegados al cuerpo.',
    aliases = array['remo hammer', 'remo con agarre hammer', 'remo en polea con pecho apoyado']
where nombre = 'Remo Hammer';
