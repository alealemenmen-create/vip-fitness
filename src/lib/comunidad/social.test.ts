import { describe, expect, it } from "vitest";
import { seleccionarComentariosRecientes } from "./social";

describe("seleccionarComentariosRecientes", () => {
  const comentarios = Array.from({ length: 9 }, (_, indice) => ({
    id: `c-${indice + 1}`,
    publicacion_id: indice === 8 ? "otra" : "post-1",
    created_at: `2026-08-${String(indice + 1).padStart(2, "0")}T12:00:00Z`,
  }));

  it("conserva los seis más recientes de la publicación en orden de lectura", () => {
    expect(seleccionarComentariosRecientes(comentarios, "post-1").map((item) => item.id))
      .toEqual(["c-3", "c-4", "c-5", "c-6", "c-7", "c-8"]);
  });

  it("no mezcla comentarios de otras publicaciones", () => {
    expect(seleccionarComentariosRecientes(comentarios, "otra").map((item) => item.id))
      .toEqual(["c-9"]);
  });

  it("permite cerrar por completo la vista previa", () => {
    expect(seleccionarComentariosRecientes(comentarios, "post-1", 0)).toEqual([]);
  });
});
