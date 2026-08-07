import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaWebhookValida } from "./stream";

const SECRETO = "secreto-de-prueba-no-real";

function firmarComoCloudflare(cuerpo: string, time: string, secreto = SECRETO): string {
  const sig1 = createHmac("sha256", secreto).update(`${time}.${cuerpo}`).digest("hex");
  return `time=${time},sig1=${sig1}`;
}

describe("firmaWebhookValida", () => {
  it("acepta una firma calculada correctamente", () => {
    const cuerpo = JSON.stringify({ uid: "abc123", readyToStream: true });
    const header = firmarComoCloudflare(cuerpo, "1700000000");
    expect(firmaWebhookValida(cuerpo, header, SECRETO)).toBe(true);
  });

  it("rechaza si el cuerpo cambió después de firmarlo", () => {
    const header = firmarComoCloudflare('{"uid":"abc123"}', "1700000000");
    expect(firmaWebhookValida('{"uid":"otro"}', header, SECRETO)).toBe(false);
  });

  it("rechaza si el secreto no coincide", () => {
    const cuerpo = '{"uid":"abc123"}';
    const header = firmarComoCloudflare(cuerpo, "1700000000", "otro-secreto");
    expect(firmaWebhookValida(cuerpo, header, SECRETO)).toBe(false);
  });

  it("rechaza sin header de firma", () => {
    expect(firmaWebhookValida('{"uid":"abc123"}', null, SECRETO)).toBe(false);
  });

  it("rechaza un header mal formado (sin sig1)", () => {
    expect(firmaWebhookValida('{"uid":"abc123"}', "time=1700000000", SECRETO)).toBe(false);
  });

  it("rechaza una firma con la longitud correcta pero el valor incorrecto", () => {
    const cuerpo = '{"uid":"abc123"}';
    const real = firmarComoCloudflare(cuerpo, "1700000000");
    const [, sig1Real] = real.split(",");
    // Mismo largo hexadecimal, distinto contenido -- prueba el camino de
    // timingSafeEqual (longitudes iguales) y no solo el de largo distinto.
    const falsa = sig1Real.replace("sig1=", "sig1=").replace(/[0-9a-f]{2}$/, "00");
    expect(firmaWebhookValida(cuerpo, `time=1700000000,${falsa}`, SECRETO)).toBe(false);
  });
});
