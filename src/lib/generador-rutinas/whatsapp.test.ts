import { describe, expect, it } from "vitest";
import { linkWhatsApp } from "./whatsapp";

describe("linkWhatsApp", () => {
  it("arma el link solo con los dígitos del teléfono", () => {
    expect(linkWhatsApp("+56 9 1234 5678")).toBe("https://wa.me/56912345678");
  });

  it("no abre nada si no hay teléfono registrado", () => {
    expect(linkWhatsApp("")).toBeNull();
    expect(linkWhatsApp("sin número")).toBeNull();
  });

  it("no lleva mensaje predeterminado: el entrenador escribe a mano", () => {
    expect(linkWhatsApp("56912345678")).not.toContain("text=");
  });
});
