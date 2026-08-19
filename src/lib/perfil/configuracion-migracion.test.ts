import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(import.meta.dirname, "../../../supabase/migrations/0112_perfil_v2_consistente.sql"),
  "utf8",
).toLowerCase();

describe("0112_perfil_v2_consistente", () => {
  it("limita el RPC al usuario autenticado y conserva RLS", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("grant execute on function public.actualizar_mi_perfil_personal_v2");
  });

  it("valida nuevamente en la frontera SQL los campos expuestos", () => {
    expect(sql).toContain("char_length(btrim(p_nombre)) not between 2 and 80");
    expect(sql).toContain("p_fecha_nacimiento > current_date");
    expect(sql).toContain("p_estatura_cm not between 80 and 260");
    expect(sql).toContain("char_length(p_telefono) not between 8 and 20");
    expect(sql).toContain("char_length(coalesce(p_condicion_medica, '')) > 2000");
    expect(sql).toContain("char_length(coalesce(p_restriccion_alimenticia, '')) > 2000");
    expect(sql).toContain("p_sexo not in ('femenino', 'masculino', 'otro')");
  });

  it("actualiza ambas tablas dentro de la misma función y exige una fila por tabla", () => {
    expect(sql).toContain("update public.alumno_perfil");
    expect(sql).toContain("update public.perfiles");
    expect(sql.match(/get diagnostics v_filas = row_count;/g)).toHaveLength(2);
    expect(sql.match(/if v_filas <> 1 then/g)).toHaveLength(2);
  });
});
