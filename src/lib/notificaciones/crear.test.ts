import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, pushMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));
vi.mock("@/lib/push/enviar", () => ({ avisarAlEntrenador: pushMock }));

import { crearNotificacionEntrenador } from "./crear";

beforeEach(() => {
  rpcMock.mockReset();
  pushMock.mockReset();
});

describe("crearNotificacionEntrenador", () => {
  it("envía push sólo cuando PostgreSQL insertó la notificación", async () => {
    rpcMock.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000001", error: null });

    const creada = await crearNotificacionEntrenador({
      tipo: "habito_entrenamiento",
      titulo: "Dejó de entrenar",
      cuerpo: "Aviso QA",
      prioridad: "alta",
      claveDedup: "qa:habito",
    });

    expect(creada).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "crear_notificacion_entrenador_dedup",
      expect.objectContaining({ p_clave_dedup: "qa:habito", p_prioridad: "alta" }),
    );
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("no repite el push cuando la función atómica detecta un duplicado", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const creada = await crearNotificacionEntrenador({
      tipo: "habito_comida",
      titulo: "Dejó de registrar",
      cuerpo: "Aviso QA",
      prioridad: "alta",
      claveDedup: "qa:comida",
    });

    expect(creada).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("un fallo de persistencia queda en best-effort y nunca manda push", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "fallo QA" } });

    await expect(crearNotificacionEntrenador({
      tipo: "bug",
      titulo: "Reporte",
      cuerpo: "Detalle",
      prioridad: "alta",
    })).resolves.toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
  });
});

