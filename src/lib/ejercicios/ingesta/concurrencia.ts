/**
 * Corre `tareas` con como máximo `limite` en simultáneo — instructivo de
 * galería multimedia §12.4: ni todo en paralelo (satura la conexión del
 * entrenador sin ganar nada) ni todo secuencial (con 100 archivos es
 * innecesariamente lento). Cada tarea se dispara recién cuando un "carril"
 * queda libre, no todas de una.
 */
export async function ejecutarConLimite<T>(tareas: Array<() => Promise<T>>, limite: number): Promise<void> {
  let indice = 0;
  async function carril() {
    while (indice < tareas.length) {
      const propia = indice++;
      await tareas[propia]();
    }
  }
  const carriles = Math.max(1, Math.min(limite, tareas.length));
  await Promise.all(Array.from({ length: carriles }, carril));
}
