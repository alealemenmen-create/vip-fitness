import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { habitos, reconocimientos, motivacion, notas } = vi.hoisted(() => ({
  habitos: vi.fn(),
  reconocimientos: vi.fn(),
  motivacion: vi.fn(),
  notas: vi.fn(),
}));

vi.mock("@/lib/notificaciones/habitos", () => ({ detectarHabitosRotos: habitos }));
vi.mock("@/lib/ai/reconocimientosSemanales", () => ({ generarReconocimientosSemanales: reconocimientos }));
vi.mock("@/lib/ai/motivacionPeso", () => ({ generarMotivacionPeso: motivacion }));
vi.mock("@/lib/ai/notasSemanales", () => ({ generarNotasSemanalesAutomaticas: notas }));

import { GET as cronNotificaciones } from "./notificaciones/route";
import { GET as cronReconocimientos } from "./reconocimientos/route";

function request(autorizacion?: string) {
  return new Request("https://vipfitness.cl/api/cron/qa", {
    headers: autorizacion ? { authorization: autorizacion } : {},
  });
}

beforeEach(() => {
  habitos.mockReset();
  reconocimientos.mockReset();
  motivacion.mockReset();
  notas.mockReset();
  vi.stubEnv("CRON_SECRET", "cron-secreto-qa");
});

afterEach(() => vi.unstubAllEnvs());

describe("autenticación de crons", () => {
  it("falla cerrado cuando CRON_SECRET no está configurado", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cronNotificaciones(request())).status).toBe(503);
    expect((await cronReconocimientos(request())).status).toBe(503);
    expect(habitos).not.toHaveBeenCalled();
    expect(reconocimientos).not.toHaveBeenCalled();
  });

  it("rechaza un Bearer incorrecto sin ejecutar trabajo", async () => {
    expect((await cronNotificaciones(request("Bearer incorrecto"))).status).toBe(401);
    expect((await cronReconocimientos(request("Bearer incorrecto"))).status).toBe(401);
    expect(habitos).not.toHaveBeenCalled();
    expect(reconocimientos).not.toHaveBeenCalled();
  });

  it("ejecuta una vez el cron diario cuando el secreto coincide", async () => {
    habitos.mockResolvedValue({ ok: true, avisos: 0 });
    const respuesta = await cronNotificaciones(request("Bearer cron-secreto-qa"));
    expect(respuesta.status).toBe(200);
    expect(habitos).toHaveBeenCalledTimes(1);
  });

  it("espera los tres trabajos semanales y expone una falla parcial", async () => {
    reconocimientos.mockResolvedValue({ ok: true, publicados: 0 });
    motivacion.mockResolvedValue({ ok: false, generadas: 0 });
    notas.mockResolvedValue({ ok: true, generadas: 0 });

    const respuesta = await cronReconocimientos(request("Bearer cron-secreto-qa"));

    expect(respuesta.status).toBe(500);
    expect(reconocimientos).toHaveBeenCalledTimes(1);
    expect(motivacion).toHaveBeenCalledTimes(1);
    expect(notas).toHaveBeenCalledTimes(1);
  });
});

