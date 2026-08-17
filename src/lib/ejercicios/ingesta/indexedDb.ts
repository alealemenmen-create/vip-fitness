/**
 * Persistencia local de la cola de "Subir y organizar" (instructivo de
 * galería multimedia, Fase 2, §12.1). Vive en IndexedDB y no en
 * `localStorage` porque acá SÍ hay que guardar los bytes del archivo (un
 * `File` completo, no solo texto) — es lo único que sobrevive a un refresh,
 * un corte de conexión o el teléfono cerrando la pestaña por accidente
 * mientras el entrenador todavía no aplicó nada.
 *
 * El servidor (`ejercicio_ingestas`/`ejercicio_ingesta_items`, migración
 * 0100) guarda el ESTADO de la ingesta; acá se guarda el ARCHIVO. Los dos
 * se enlazan por el mismo `id` (la clave idempotente que ve el servidor).
 */

const DB_NOMBRE = "vip-fitness-ingesta";
const DB_VERSION = 1;
const STORE_ITEMS = "items";
const STORE_META = "meta";

export type EstadoItemIngesta = "local" | "subiendo" | "procesando" | "listo" | "error" | "aplicado";
export type TipoItemIngesta = "imagen" | "video";

export type ItemIngestaLocal = {
  /** Generado una sola vez al elegir el archivo — es también la
   * `clave_idempotente` que ve el servidor. */
  id: string;
  ingestaId: string;
  archivo: File;
  tipo: TipoItemIngesta;
  nombreCandidato: string;
  ejercicioId: string | null;
  /** Mismo vocabulario de 3 niveles que usa la cola desde Fase 1 — no el de
   * 5 niveles del §9.1 del instructivo (ese es del motor de coincidencias
   * ampliado, todavía no construido). */
  confianza: "alta" | "revisar" | "sin_match";
  estado: EstadoItemIngesta;
  progreso: number;
  error: string | null;
  creadoEn: number;
};

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: "id" });
        store.createIndex("porIngesta", "ingestaId");
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "clave" });
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

/** `false` en SSR, Safari privado viejo, o cualquier entorno sin IndexedDB —
 * la cola sigue funcionando, simplemente no sobrevive a un refresh. */
export function indexedDbDisponible(): boolean {
  return typeof indexedDB !== "undefined";
}

async function conStore<T>(
  storeName: string,
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, modo);
    const store = tx.objectStore(storeName);
    const solicitud = fn(store);
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function guardarIngestaActual(ingestaId: string): Promise<void> {
  await conStore(STORE_META, "readwrite", (store) => store.put({ clave: "ingestaActual", valor: ingestaId }));
}

export async function obtenerIngestaActual(): Promise<string | null> {
  const registro = await conStore<{ clave: string; valor: string } | undefined>(STORE_META, "readonly", (store) =>
    store.get("ingestaActual")
  );
  return registro?.valor ?? null;
}

export async function guardarItem(item: ItemIngestaLocal): Promise<void> {
  await conStore(STORE_ITEMS, "readwrite", (store) => store.put(item));
}

export async function actualizarItem(id: string, cambios: Partial<ItemIngestaLocal>): Promise<void> {
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, "readwrite");
    const store = tx.objectStore(STORE_ITEMS);
    const solicitud = store.get(id);
    solicitud.onsuccess = () => {
      const actual = solicitud.result as ItemIngestaLocal | undefined;
      if (!actual) {
        resolve();
        return;
      }
      store.put({ ...actual, ...cambios });
    };
    solicitud.onerror = () => reject(solicitud.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function eliminarItem(id: string): Promise<void> {
  await conStore(STORE_ITEMS, "readwrite", (store) => store.delete(id));
}

export async function obtenerItemsDeIngesta(ingestaId: string): Promise<ItemIngestaLocal[]> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, "readonly");
    const indice = tx.objectStore(STORE_ITEMS).index("porIngesta");
    const solicitud = indice.getAll(IDBKeyRange.only(ingestaId));
    solicitud.onsuccess = () => resolve(solicitud.result as ItemIngestaLocal[]);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

/** Borra todos los items de una ingesta — al aplicarla del todo, al
 * cancelarla, o al descartar una recuperación que el entrenador no quiere
 * continuar. */
export async function limpiarIngesta(ingestaId: string): Promise<void> {
  const items = await obtenerItemsDeIngesta(ingestaId);
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS, STORE_META], "readwrite");
    const store = tx.objectStore(STORE_ITEMS);
    for (const item of items) store.delete(item.id);
    tx.objectStore(STORE_META).delete("ingestaActual");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
