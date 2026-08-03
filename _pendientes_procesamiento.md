# Pendientes para el procesamiento final de fotos

## Grupos con foto duplicada (elegir 1 de las 2) — pendiente de comparar
- remo-mancuerna: 005-remo-con-mancuerna.jpg | Remo con mancuerna.jpg
- elevacion-piernas: 017-elevacion-de-piernas.jpg | Elevación de piernas.jpg
- press-militar: 025-press-militar.jpg | Press militar.jpg
- extension-triceps-sobre-cabeza: 045-extension-sobre-la-cabeza.jpg | Extensión sobre la cabeza.jpg
- hip-thrust: 048-hip-thrust.jpg | Hip Thrust.jpg
- subida-cajon: 084-step-up.jpg | Step Up.jpg
- sentadilla-libre-trasera: Sentadilla libre trasera.jpg | Super squat.jpg

## Match manual (nombre de archivo no calza literal pero es correcto)
- Aducción.jpg -> aductores
- Pulldown unilateral.jpg -> jalon-neutro
- push  up.jpg -> flexiones
- 039-press-de-hombros-con-mancuernas.jpg -> press-hombro-mancuernas (NO es duplicado de Press plano con mancuernas)
- Remo Hammer.jpg -> remo-hammer (NO es duplicado de Remo T-Bar)
- Extensión unilateral.jpg -> extension-triceps-unilateral (NO es duplicado de Extensión de cuádriceps unilateral)


- **Gemelos**: solo hay UNA foto de gemelos. El usuario la renombró con los tres
  nombres a la vez. Al procesar, copiar esa misma imagen final a los tres
  slugs de ilustración:
  - `gemelos` (Gemelos de pie)
  - `gemelos-sentado` (Gemelos sentado)
  - `gemelos-prensa` (Gemelos en prensa)

- **Sentadilla goblet**: las fotos con mancuerna sostenida al pecho (goblet
  hold) NO son "Sentadilla" genérica — son `sentadilla-goblet` (Sentadilla
  goblet), que ya existe en la base. Reasignar esas fotos a ese slug en vez
  del genérico "Sentadilla".

- **Curl femoral sentado / de pie**: solo hay UNA foto ("Curl femoral sentado
  de pie.jpg", mal nombrada, se refiere a las dos). Copiar la misma imagen
  final a los dos slugs:
  - `curl-femoral-sentado` (Curl femoral sentado)
  - `curl-femoral-pie` (Curl femoral de pie)

- **Prensa 45° / Prensa horizontal**: en el gimnasio del usuario NO hay
  prensa horizontal. Usar la foto de "Prensa 45°" también para cualquier
  referencia a "Prensa horizontal" — no crear un ejercicio nuevo separado,
  solo reusar la imagen de `prensa` / `prensa-inclinada` (comparten
  ilustracion_slug 'prensa') para ese caso.

- **Push Press**: no hay foto propia. Reusar "Sentadilla frontal.jpg" también
  para Push Press (mismo patrón que gemelos: una imagen, dos ejercicios).

- **Sentadilla libre trasera**: la foto ex D5F5C083 (que pasó por "Push
  Press" antes de aclararse) en realidad es esta — sentadilla con barra
  trasera. Ya renombrada a "Sentadilla libre trasera.jpg". OJO: ya existía
  otro archivo "Super squat.jpg", que es alias del mismo ejercicio
  (`sentadilla-libre-trasera`) — quedan DOS candidatas para el mismo slug,
  hay que comparar y elegir una en el paso de duplicados.
