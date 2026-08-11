import { describe, expect, it } from "vitest";
import { crearNovedadDesdeDespliegue, leerDespliegueActual } from "./novedades-deploy";

describe("novedades automáticas de despliegue", () => {
  it("ignora localhost y previews", () => {
    expect(leerDespliegueActual({ VERCEL_ENV: "development" })).toBeNull();
    expect(
      leerDespliegueActual({
        VERCEL_ENV: "preview",
        VERCEL_DEPLOYMENT_ID: "dpl_preview",
        VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      }),
    ).toBeNull();
  });

  it("lee la referencia exacta de un despliegue de producción", () => {
    expect(
      leerDespliegueActual({
        VERCEL_ENV: "production",
        VERCEL_DEPLOYMENT_ID: "dpl_123",
        VERCEL_GIT_COMMIT_SHA: "01225abb1d95cd63ba9dfd78159d99b0dd8622e3",
        VERCEL_GIT_COMMIT_MESSAGE: "feat(novedades): registra cada publicación",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toEqual({
      deploymentId: "dpl_123",
      sha: "01225abb1d95cd63ba9dfd78159d99b0dd8622e3",
      mensaje: "feat(novedades): registra cada publicación",
      rama: "main",
    });
  });

  it("convierte el commit en una novedad legible y estable", () => {
    const despliegue = {
      deploymentId: "dpl_123",
      sha: "01225abb1d95cd63ba9dfd78159d99b0dd8622e3",
      mensaje: "fix(deploy): corrige la publicación\n\nDetalle interno",
      rama: "main",
    };

    const primera = crearNovedadDesdeDespliegue(despliegue);
    const segunda = crearNovedadDesdeDespliegue(despliegue);

    expect(primera).toEqual(segunda);
    expect(primera.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(primera.titulo).toBe("Corrige la publicación");
    expect(primera.categoria).toBe("arreglo");
    expect(primera.resumen).toContain("Versión 01225ab");
    expect(primera.resumen).toContain("despliegue dpl_123");
  });
});
