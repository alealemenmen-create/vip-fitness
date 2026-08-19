import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(import.meta.dirname, "../../supabase/migrations/0116_portal_v2_piloto.sql"),
  "utf8",
).toLowerCase();

describe("0116_portal_v2_piloto", () => {
  it("mantiene a todos los alumnos en la vista clásica hasta una autorización individual", () => {
    expect(sql).toContain("add column if not exists portal_v2_habilitado");
    expect(sql).toContain("not null default false");
  });
});
