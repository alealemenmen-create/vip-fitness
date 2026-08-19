import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const raiz = process.cwd();
const directorios = [
  path.join(raiz, "src", "app", "portal-v2"),
  path.join(raiz, "src", "components", "v2"),
];

function archivosTsx(directorio) {
  if (!fs.existsSync(directorio)) return [];
  return fs.readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return archivosTsx(ruta);
    return entrada.isFile() && ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

function nombreEtiqueta(nodo) {
  return nodo.tagName?.getText() ?? "";
}

function atributos(nodo) {
  return nodo.attributes?.properties ?? [];
}

function tieneAtributo(nodo, nombre) {
  return atributos(nodo).some((atributo) => ts.isJsxAttribute(atributo) && atributo.name.getText() === nombre);
}

function valorLiteral(nodo, nombre) {
  const atributo = atributos(nodo).find((item) => ts.isJsxAttribute(item) && item.name.getText() === nombre);
  return atributo && ts.isJsxAttribute(atributo) && atributo.initializer && ts.isStringLiteral(atributo.initializer)
    ? atributo.initializer.text
    : null;
}

function formularioContenedor(nodo) {
  let actual = nodo.parent;
  while (actual) {
    if (ts.isJsxElement(actual) && nombreEtiqueta(actual.openingElement) === "form") return actual.openingElement;
    actual = actual.parent;
  }
  return null;
}

const hallazgos = [];
const totales = { botones: 0, enlaces: 0, formularios: 0 };

for (const archivo of directorios.flatMap(archivosTsx)) {
  const contenido = fs.readFileSync(archivo, "utf8");
  const fuente = ts.createSourceFile(archivo, contenido, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function reportar(nodo, mensaje) {
    const posicion = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
    hallazgos.push(`${path.relative(raiz, archivo)}:${posicion.line + 1} · ${mensaje}`);
  }

  function visitar(nodo) {
    if (ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      const etiqueta = nombreEtiqueta(nodo);
      if (etiqueta === "form") {
        totales.formularios += 1;
        if (!tieneAtributo(nodo, "onSubmit") && !tieneAtributo(nodo, "action")) {
          reportar(nodo, "formulario sin onSubmit ni action");
        }
      }

      if (etiqueta === "button") {
        totales.botones += 1;
        const tieneAccion = tieneAtributo(nodo, "onClick") || tieneAtributo(nodo, "formAction");
        if (!tieneAccion) {
          const tipo = valorLiteral(nodo, "type") ?? "submit";
          const formulario = formularioContenedor(nodo);
          const formularioConectado = formulario
            && (tieneAtributo(formulario, "onSubmit") || tieneAtributo(formulario, "action"));
          if (tipo !== "submit" || !formularioConectado) {
            reportar(nodo, `botón ${tipo === "submit" ? "submit" : `type=${tipo}`} sin acción verificable`);
          }
        }
      }

      if (etiqueta === "Link" || etiqueta === "a") {
        totales.enlaces += 1;
        if (!tieneAtributo(nodo, "href")) reportar(nodo, `${etiqueta} sin href`);
      }
    }
    ts.forEachChild(nodo, visitar);
  }

  visitar(fuente);
}

if (hallazgos.length) {
  console.error("Interacciones V2 sin conexión explícita:");
  for (const hallazgo of hallazgos) console.error(`- ${hallazgo}`);
  process.exitCode = 1;
} else {
  console.log(`Interacciones V2 verificadas: ${totales.botones} botones, ${totales.enlaces} enlaces y ${totales.formularios} formularios con acción o destino explícito.`);
}
