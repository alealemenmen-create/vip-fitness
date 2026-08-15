# Pendientes para el procesamiento final de fotos

Estado al 14/08: todos los ítems de este documento fueron revisados y
aplicados (o ya estaban correctos de una sesión anterior). Detalle abajo.

## Grupos con foto duplicada — resuelto
- remo-mancuerna: ya tenía una foto correcta (una tercera toma distinta a
  las dos candidatas). No se tocó.
- elevacion-piernas: los archivos de staging ya no existen; asumido resuelto
  en una sesión previa.
- press-militar: **corregido** — el recorte cuadrado cortaba cabeza y barra.
  Reprocesado desde `025-press-militar.jpg`.
- extension-triceps-sobre-cabeza (slug real: `triceps-sobre-cabeza`): ya
  estaba correcto.
- hip-thrust: ya estaba correcto. El candidato perdedor ya estaba marcado
  `DESCARTADA-hip-thrust-barra.jpg` de una sesión previa.
- subida-cajon (Step Up): **corregido** — tenía la foto de otro ejercicio.
  Reprocesado desde `Step Up.jpg`. El candidato perdedor ya estaba marcado
  `DESCARTADA-step-up-cajon.jpg`.
- sentadilla-libre-trasera: ya estaba correcto. El candidato perdedor ya
  estaba marcado `DESCARTADA-super-squat-maquina.jpg`.

## Match manual — resuelto (reprocesados desde staging)
- Aducción.jpg -> aductores ✓
- Pulldown unilateral.jpg -> jalon-neutro ✓ (estaba MAL: tenía una foto de
  curl con mancuernas)
- push up.jpg -> flexiones ✓
- 039-press-de-hombros-con-mancuernas.jpg -> press-hombro-mancuernas ✓
- Remo Hammer.jpg -> remo-hammer ✓
- Extensión unilateral.jpg -> extension-triceps-unilateral ✓

## Casos especiales — ya estaban todos resueltos, sin cambios
- Gemelos (gemelos / gemelos-sentado / gemelos-prensa): mismo archivo
  copiado a los 3 slugs, confirmado por hash idéntico.
- Sentadilla goblet: la genérica "Sentadilla" no usa la foto goblet: correcto.
- Curl femoral sentado/pie: mismo archivo en ambos slugs, confirmado por hash.
- Prensa 45° / horizontal: `ilustracion_slug` compartido ya en la base.
- Push Press: `ilustracion_slug` ya apunta a `sentadilla-frontal` en la base.

## Herramienta nueva
Se agregó `scripts/procesar-foto-ejercicio.mjs` para repetir este proceso
(staging -> `public/ejercicios-completas/<slug>.webp` + recorte cuadrado en
`public/ejercicios/<slug>.webp`) si aparecen más fotos para asignar.
