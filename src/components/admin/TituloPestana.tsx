/** Título de pestaña clavado arriba del contenido.
 *
 * Se ancla en `top-0` del contenedor que scrollea (`.pantalla-scroll` en
 * admin/layout.tsx), que arranca justo debajo de la cabecera fija — por eso
 * queda pegado a ella sin números mágicos ni variables de alto que haya que
 * mantener sincronizadas cuando cambie la cabecera.
 *
 * Dos detalles que no son decorativos:
 *
 * - `-mx-4 px-4` cancela el padding lateral del scroller para que la barra
 *   ocupe todo el ancho. Sin eso el contenido asomaría por los costados al
 *   pasar por detrás.
 * - El aire de arriba va en el `pt-3` de ACÁ, nunca como padding-top del
 *   scroller: un `sticky` está confinado a su bloque contenedor (el content
 *   box del padre), así que cualquier padding ahí lo deja a esa distancia del
 *   borde y por esa rendija desfila el contenido al scrollear.
 */
export function TituloPestana({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-transparent bg-bg/95 px-4 pb-3 pt-4 backdrop-blur md:mx-0 md:px-0 md:pb-4 md:pt-6">
      {children}
    </div>
  );
}
