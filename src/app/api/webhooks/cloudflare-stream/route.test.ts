import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidar, captura, resultadoSelect } = vi.hoisted(() => ({
  revalidar: vi.fn(),
  captura: {
    actualizacion: null as Record<string, unknown> | null,
    eq: [] as unknown[][],
    or: [] as string[],
    not: [] as unknown[][],
    from: [] as string[],
  },
  resultadoSelect: { actual: { data: [{ id: "ejercicio-qa" }], error: null } as { data: { id: string }[]; error: unknown } },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidar }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => {
      captura.from.push(tabla);
      const consulta = {
        update: (valor: Record<string, unknown>) => {
          captura.actualizacion = valor;
          return consulta;
        },
        eq: (...args: unknown[]) => {
          captura.eq.push(args);
          return consulta;
        },
        or: (valor: string) => {
          captura.or.push(valor);
          return consulta;
        },
        not: (...args: unknown[]) => {
          captura.not.push(args);
          return consulta;
        },
        select: async () => resultadoSelect.actual,
      };
      return consulta;
    },
  }),
}));

import { POST } from "./route";

const SECRETO = "webhook-secreto-qa";

function firma(cuerpo: string, segundos = Math.floor(Date.now() / 1000)) {
  const sig1 = createHmac("sha256", SECRETO).update(`${segundos}.${cuerpo}`).digest("hex");
  return `time=${segundos},sig1=${sig1}`;
}

function peticion(cuerpo: string, opciones: { firma?: string; contentLength?: number } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    "Webhook-Signature": opciones.firma ?? firma(cuerpo),
  });
  if (opciones.contentLength !== undefined) headers.set("content-length", String(opciones.contentLength));
  return new Request("https://vipfitness.cl/api/webhooks/cloudflare-stream", { method: "POST", headers, body: cuerpo });
}

beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_STREAM_WEBHOOK_SECRET", SECRETO);
  revalidar.mockReset();
  captura.actualizacion = null;
  captura.eq.length = 0;
  captura.or.length = 0;
  captura.not.length = 0;
  captura.from.length = 0;
  resultadoSelect.actual = { data: [{ id: "ejercicio-qa" }], error: null };
});

afterEach(() => vi.unstubAllEnvs());

describe("webhook de Cloudflare Stream", () => {
  it("falla cerrado sin secreto y rechaza firmas inválidas", async () => {
    vi.stubEnv("CLOUDFLARE_STREAM_WEBHOOK_SECRET", "");
    expect((await POST(peticion("{}"))).status).toBe(503);
    vi.stubEnv("CLOUDFLARE_STREAM_WEBHOOK_SECRET", SECRETO);
    expect((await POST(peticion("{}", { firma: "time=1,sig1=mal" }))).status).toBe(401);
    expect(captura.from).toHaveLength(0);
  });

  it("rechaza el cuerpo sobredimensionado antes de consultar la base", async () => {
    const respuesta = await POST(peticion("{}", { contentLength: 70_000 }));
    expect(respuesta.status).toBe(413);
    expect(captura.from).toHaveLength(0);
  });

  it("actualiza un video listo sin borrar metadatos ausentes", async () => {
    const cuerpo = JSON.stringify({
      uid: "abcdef1234567890",
      readyToStream: true,
      duration: 21.5,
      thumbnail: "https://customer-qa.cloudflarestream.com/uid/thumbnails/thumbnail.jpg",
      input: { width: 1080, height: 1920 },
    });
    const respuesta = await POST(peticion(cuerpo));
    const json = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(json).toEqual({ ok: true, actualizado: true });
    expect(captura.actualizacion).toMatchObject({
      video_cloudflare_estado: "listo",
      video_cloudflare_duracion_seg: 21.5,
      video_cloudflare_ancho: 1080,
      video_cloudflare_alto: 1920,
      video_cloudflare_error: null,
    });
    expect(captura.or[0]).toContain("video_cloudflare_webhook_en.lte.");
    expect(captura.or).toHaveLength(1);
    expect(revalidar).toHaveBeenCalledTimes(2);
  });

  it("un evento de procesamiento no limpia datos y no puede pisar un terminal", async () => {
    resultadoSelect.actual = { data: [], error: null };
    const cuerpo = JSON.stringify({ uid: "abcdef1234567890", status: { state: "inprogress" } });
    const respuesta = await POST(peticion(cuerpo));

    expect(await respuesta.json()).toEqual({ ok: true, actualizado: false });
    expect(captura.actualizacion).toMatchObject({ video_cloudflare_estado: "procesando" });
    expect(captura.actualizacion).not.toHaveProperty("video_cloudflare_duracion_seg");
    expect(captura.actualizacion).not.toHaveProperty("video_cloudflare_miniatura_url");
    expect(captura.actualizacion).not.toHaveProperty("video_cloudflare_error");
    expect(captura.or).toContain("video_cloudflare_estado.is.null,video_cloudflare_estado.not.in.(listo,error)");
    expect(revalidar).not.toHaveBeenCalled();
  });

  it("rechaza JSON y UID inválidos aun cuando la firma sea auténtica", async () => {
    expect((await POST(peticion("{"))).status).toBe(400);
    const cuerpo = JSON.stringify({ uid: "x" });
    expect((await POST(peticion(cuerpo))).status).toBe(400);
    expect(captura.from).toHaveLength(0);
  });
});
