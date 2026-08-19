export function seleccionarComentariosRecientes<T extends {
  publicacion_id: string;
  created_at: string;
}>(comentarios: T[], publicacionId: string, limite = 6): T[] {
  if (limite <= 0) return [];
  return comentarios
    .filter((comentario) => comentario.publicacion_id === publicacionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite)
    .reverse();
}
