import { describe, expect, it } from "vitest";
import { crearCookiePreview, hashCodigoPreview, resolverAccesoPreview, validarCookiePreview } from "./preview-access";

describe("acceso privado de preview", () => {
  it("identifica una llave autorizada sin almacenar el texto original", () => {
    const config = `propietario:${hashCodigoPreview("VIP-prueba")}`;
    expect(resolverAccesoPreview("VIP-prueba", config)).toBe("propietario");
    expect(resolverAccesoPreview("incorrecta", config)).toBeNull();
  });

  it("firma y valida una cookie sin aceptar alteraciones", () => {
    const cookie = crearCookiePreview("propietario", "secreto-de-prueba");
    expect(validarCookiePreview(cookie, "secreto-de-prueba")).toBe(true);
    expect(validarCookiePreview(`${cookie}x`, "secreto-de-prueba")).toBe(false);
  });
});
