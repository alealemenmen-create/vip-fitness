import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const rutaProyecto = path.join(raiz, ".vercel", "project.json");

function git(...argumentos) {
  return execFileSync("git", argumentos, { cwd: raiz, encoding: "utf8" }).trim();
}

assert(fs.existsSync(rutaProyecto), "Falta .vercel/project.json: enlaza el repositorio antes de preparar una preview.");
const proyecto = JSON.parse(fs.readFileSync(rutaProyecto, "utf8"));
const rama = git("branch", "--show-current");
const cambios = git("status", "--porcelain");
const commit = git("rev-parse", "--short", "HEAD");

assert.equal(rama, "portal-v2", `La preview V2 sólo se prepara desde portal-v2; rama actual: ${rama || "desconocida"}.`);
assert.equal(proyecto.projectName, "vip-fitness-center", `Proyecto Vercel inesperado: ${proyecto.projectName ?? "sin nombre"}.`);
assert.equal(proyecto.projectId, "prj_e6nibIY20d8dxiqjevmqADr8GflR", "El enlace local no corresponde al proyecto Vercel auditado.");
assert.equal(cambios, "", "Hay cambios sin confirmar. La preview debe corresponder a un commit reproducible.");

console.log(JSON.stringify({
  listoParaPreview: true,
  rama,
  commit,
  proyecto: proyecto.projectName,
  objetivoPermitido: "preview",
  produccionPermitida: false,
}, null, 2));
console.log("Preflight completado. Este comando no creó ningún deployment.");
