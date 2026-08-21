import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firmaWebhookValida, tiempoFirmaWebhookCloudflare, urlMiniaturaFirmada, urlPosterVideoFirmado } from "./stream";

const SECRETO = "secreto-de-prueba";
const AHORA = 1_700_000_000_000;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

describe("urlMiniaturaFirmada", () => {
  it("usa el token privado en lugar del UID y lo reutiliza durante su vigencia", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cuenta-qa");
    vi.stubEnv("CLOUDFLARE_STREAM_API_TOKEN", "token-api-qa");
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_CODE", "cliente-qa");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { token: "token-firmado-qa" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const primera = await urlMiniaturaFirmada("video-privado-qa");
    const segunda = await urlMiniaturaFirmada("video-privado-qa");

    expect(primera).toBe(
      "https://customer-cliente-qa.cloudflarestream.com/token-firmado-qa/thumbnails/thumbnail.jpg"
    );
    expect(segunda).toBe(primera);
    expect(primera).not.toContain("video-privado-qa");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("genera una portada privada desde el primer fotograma", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cuenta-qa");
    vi.stubEnv("CLOUDFLARE_STREAM_API_TOKEN", "token-api-qa");
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_CODE", "cliente-qa");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { token: "poster-firmado-qa" } }),
    }));

    expect(await urlPosterVideoFirmado("video-poster-qa")).toBe(
      "https://customer-cliente-qa.cloudflarestream.com/poster-firmado-qa/thumbnails/thumbnail.jpg?time=0s&height=1080"
    );
  });

  it("extrae sólo un tiempo firmado bien formado", () => {
    expect(tiempoFirmaWebhookCloudflare("time=1700000000,sig1=abc")).toBe(AHORA);
    expect(tiempoFirmaWebhookCloudflare("time=no,sig1=abc")).toBeNull();
    expect(tiempoFirmaWebhookCloudflare(null)).toBeNull();
  });
});

