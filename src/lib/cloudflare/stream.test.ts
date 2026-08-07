import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaWebhookValida } from "./stream";

const SECRETO = "secreto-de-prueba-no-real";
// Mismo instante que usan los headers de prueba (time="1700000000") pero en
// milisegundos, para que la ventana de frescura no rechace estos tests por
// motivos ajenos a lo que cada uno prueba de verdad.
const AHORA_MS_DE_PRUEBA = 1_700_000_000_000;

function firmarComoCloudflare(cuerpo: string, time: string, secreto = SECRETO): string {
  const sig1 = createHmac("sha256", secreto).update(`${time}.${cuerpo}`).digest("hex");
  return `time=${time},sig1=${sig1}`;
}

describe("firmaWebhookValida", () => {
  it("acepta una firma calculada correctamente", () => {
    const cuerpo = JSON.stringify({ uid: "abc123", readyToStream: true });
    const header = firmarComoCloudflare(cuerpo, "1700000000");
    expect(firmaWebhookValida(cuerpo, header, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(true);
  });

  it("rechaza si el cuerpo cambió después de firmarlo", () => {
    const header = firmarComoCloudflare('{"uid":"abc123"}', "1700000000");
    expect(firmaWebhookValida('{"uid":"otro"}', header, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
  });

  it("rechaza si el secreto no coincide", () => {
    const cuerpo = '{"uid":"abc123"}';
    const header = firmarComoCloudflare(cuerpo, "1700000000", "otro-secreto");
    expect(firmaWebhookValida(cuerpo, header, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
  });

  it("rechaza sin header de firma", () => {
    expect(firmaWebhookValida('{"uid":"abc123"}', null, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
  });

  it("rechaza un header mal formado (sin sig1)", () => {
    expect(firmaWebhookValida('{"uid":"abc123"}', "time=1700000000", SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
  });

  it("rechaza una firma con la longitud correcta pero el valor incorrecto", () => {
    const cuerpo = '{"uid":"abc123"}';
    const real = firmarComoCloudflare(cuerpo, "1700000000");
    const [, sig1Real] = real.split(",");
    // Mismo largo hexadecimal, distinto contenido -- prueba el camino de
    // timingSafeEqual (longitudes iguales) y no solo el de largo distinto.
    const falsa = sig1Real.replace("sig1=", "sig1=").replace(/[0-9a-f]{2}$/, "00");
    expect(firmaWebhookValida(cuerpo, `time=1700000000,${falsa}`, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
  });

  describe("protección contra replay", () => {
    it("rechaza una firma válida pero con más de 5 minutos de antigüedad", () => {
      const cuerpo = '{"uid":"abc123"}';
      const header = firmarComoCloudflare(cuerpo, "1700000000");
      const seisMinutosDespues = AHORA_MS_DE_PRUEBA + 6 * 60 * 1000;
      expect(firmaWebhookValida(cuerpo, header, SECRETO, seisMinutosDespues)).toBe(false);
    });

    it("rechaza una firma con timestamp en el futuro lejano", () => {
      const cuerpo = '{"uid":"abc123"}';
      const header = firmarComoCloudflare(cuerpo, "1700000000");
      const seisMinutosAntes = AHORA_MS_DE_PRUEBA - 6 * 60 * 1000;
      expect(firmaWebhookValida(cuerpo, header, SECRETO, seisMinutosAntes)).toBe(false);
    });

    it("acepta dentro de la ventana de tolerancia (justo antes de 5 minutos)", () => {
      const cuerpo = '{"uid":"abc123"}';
      const header = firmarComoCloudflare(cuerpo, "1700000000");
      const cuatroMinutos = AHORA_MS_DE_PRUEBA + 4 * 60 * 1000;
      expect(firmaWebhookValida(cuerpo, header, SECRETO, cuatroMinutos)).toBe(true);
    });

    it("rechaza un time que no es un número", () => {
      const cuerpo = '{"uid":"abc123"}';
      const header = firmarComoCloudflare(cuerpo, "no-es-un-numero");
      expect(firmaWebhookValida(cuerpo, header, SECRETO, AHORA_MS_DE_PRUEBA)).toBe(false);
    });
  });
});
