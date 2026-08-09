import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaWebhookValida } from "./stream";

const SECRETO = "secreto-de-prueba";
const AHORA = 1_700_000_000_000;

function firma(cuerpo: string, time = "1700000000") {
  const sig1 = createHmac("sha256", SECRETO).update(`${time}.${cuerpo}`).digest("hex");
  return `time=${time},sig1=${sig1}`;
}

describe("firmaWebhookValida", () => {
  it("acepta una firma reciente y correcta", () => {
    const cuerpo = '{"uid":"abc","readyToStream":true}';
    expect(firmaWebhookValida(cuerpo, firma(cuerpo), SECRETO, AHORA)).toBe(true);
  });

  it("rechaza cuerpo alterado, firma ausente y secreto distinto", () => {
    const header = firma('{"uid":"abc"}');
    expect(firmaWebhookValida('{"uid":"otro"}', header, SECRETO, AHORA)).toBe(false);
    expect(firmaWebhookValida("{}", null, SECRETO, AHORA)).toBe(false);
    expect(firmaWebhookValida('{"uid":"abc"}', header, "otro", AHORA)).toBe(false);
  });

  it("rechaza reenvíos con más de cinco minutos", () => {
    const cuerpo = '{"uid":"abc"}';
    expect(firmaWebhookValida(cuerpo, firma(cuerpo), SECRETO, AHORA + 301_000)).toBe(false);
  });
});

