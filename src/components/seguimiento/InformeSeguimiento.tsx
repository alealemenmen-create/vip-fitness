import Image from "next/image";
import Link from "next/link";
import { BotonImprimirSeguimiento } from "./BotonImprimirSeguimiento";
import type { SeguimientoIntegral } from "@/lib/seguimiento/tipos";

function fecha(fechaISO: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(new Date(`${fechaISO}T12:00:00`)).replaceAll(".", "");
}

export function InformeSeguimiento({ datos, volverHref }: { datos: SeguimientoIntegral; volverHref?: string }) {
  const r = datos.resumen;
  const revision = datos.revisiones[0];
  return (
    <div className="informe-vip mx-auto max-w-[210mm] bg-white text-[#171717] shadow-2xl">
      <div className="imprimir-oculto flex items-center justify-between gap-3 bg-[#111] px-6 py-3"><div><p className="text-sm text-white">Vista previa del informe VIP Fitness</p>{volverHref && <Link href={volverHref} className="mt-1 inline-block text-xs text-white/65 underline">Volver a Mi avance</Link>}</div><BotonImprimirSeguimiento /></div>
      <article className="informe-vip-pagina p-[14mm]">
        <header className="flex items-start justify-between border-b-2 border-[#f5a800] pb-5">
          <div><Image src="/logo-vip-full.png" alt="VIP Fitness" width={230} height={62} className="h-auto w-[185px]" priority /><p className="mt-2 text-[9px] font-bold uppercase tracking-[0.24em] text-[#777]">Seguimiento integral · Método VIP</p></div>
          <div className="text-right"><p className="text-[9px] uppercase tracking-wider text-[#888]">Período evaluado</p><p className="mt-1 text-sm font-bold">{fecha(datos.desde)} - {fecha(datos.hasta)}</p><p className="text-[10px] text-[#777]">Últimos {datos.diasPeriodo} días</p></div>
        </header>

        <section className="mt-6 grid grid-cols-[1fr_auto] items-end gap-6 rounded-2xl bg-[#111] p-6 text-white">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#f5a800]">Cómo lo ha hecho</p><h1 className="mt-1 text-2xl font-black uppercase">{datos.alumnoNombre}</h1><p className="mt-2 max-w-md text-[11px] leading-relaxed text-white/65">Evaluación basada en sesiones, ejercicios, alimentación registrada, recuperación y evolución corporal.</p></div>
          <div className="text-right"><p className="text-5xl font-black text-[#f5a800]">{r.adherenciaGeneral ?? "—"}{r.adherenciaGeneral === null ? "" : "%"}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Adherencia general</p></div>
        </section>

        <section className="mt-5 grid grid-cols-4 gap-2">
          {[
            ["Entrenamiento", r.entrenamientoPct === null ? "—" : `${r.entrenamientoPct}%`, `${r.sesionesRealizadas}/${r.sesionesEsperadas} sesiones`],
            ["Nutrición", r.nutricionPct === null ? "—" : `${r.nutricionPct}%`, `${r.diasConAlimentacion}/${r.diasPeriodo} días`],
            ["Proteína", r.proteinaPromedio === null ? "—" : `${r.proteinaPromedio} g`, `meta ${r.proteinaObjetivo ?? "—"} g`],
            ["Recuperación", `${r.recuperacionPct}%`, `sueño ${r.suenoPromedio ?? "—"} h`],
          ].map(([titulo, valor, detalle]) => <div key={titulo} className="rounded-xl border border-[#ddd] p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-[#888]">{titulo}</p><p className="mt-1 text-xl font-black">{valor}</p><p className="text-[9px] text-[#777]">{detalle}</p></div>)}
        </section>

        {datos.alertas.length > 0 && <section className="mt-5"><h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#555]">Señales importantes</h2><div className="grid grid-cols-2 gap-2">{datos.alertas.slice(0, 4).map((alerta, i) => <div key={`${alerta.titulo}:${i}`} className={`rounded-xl border-l-4 p-3 ${alerta.prioridad === "positiva" ? "border-l-[#2a9d62] bg-[#eef9f3]" : alerta.prioridad === "alta" ? "border-l-[#d64545] bg-[#fff4f4]" : "border-l-[#f5a800] bg-[#fff9e9]"}`}><p className="text-[10px] font-bold">{alerta.titulo}</p><p className="mt-0.5 text-[9px] leading-relaxed text-[#666]">{alerta.detalle}</p></div>)}</div></section>}

        <section className="mt-5"><h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#555]">Evolución en el período</h2><div className="grid grid-cols-4 gap-2 rounded-xl bg-[#f3f3f3] p-3">{[
          ["Peso actual", datos.evolucion.pesoActual === null ? "—" : `${datos.evolucion.pesoActual} kg`],
          ["Variación", datos.evolucion.variacionPeso === null ? "—" : `${datos.evolucion.variacionPeso > 0 ? "+" : ""}${datos.evolucion.variacionPeso} kg`],
          ["Fotos", String(datos.evolucion.fotosPeriodo)],
          ["Medidas", String(datos.evolucion.medidasPeriodo)],
        ].map(([titulo, valor]) => <div key={titulo}><p className="text-[8px] uppercase text-[#888]">{titulo}</p><p className="mt-1 text-sm font-black">{valor}</p></div>)}</div></section>

        <section className="informe-vip-detalle mt-6"><h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#555]">Detalle diario</h2><table className="w-full border-collapse text-left text-[8.5px]"><thead><tr className="bg-[#171717] text-white"><th>Fecha</th><th>Entrenamiento</th><th>Alimentación</th><th>Recuperación</th><th>Peso</th></tr></thead><tbody>{datos.dias.map((dia) => { const hechos = dia.sesiones.reduce((t,s)=>t+s.ejerciciosCompletados,0); const total = dia.sesiones.reduce((t,s)=>t+s.ejerciciosTotales,0); return <tr key={dia.fecha}><td className="font-bold">{fecha(dia.fecha)}</td><td>{dia.sesiones.length ? `${hechos}/${total} ejercicios` : "Sin sesión"}</td><td>{dia.nutricion ? `${dia.nutricion.kcal} kcal · ${dia.nutricion.proteina} g prot` : "Sin registro"}</td><td>{dia.suenoHoras !== null || dia.aguaLitros !== null ? `${dia.suenoHoras ?? "—"} h · ${dia.aguaLitros ?? "—"} L` : "Sin registro"}</td><td>{dia.pesoKg ? `${dia.pesoKg} kg` : "—"}</td></tr>; })}</tbody></table></section>

        {revision && <section className="mt-6 rounded-2xl border border-[#f5a800] bg-[#fffbef] p-4"><p className="text-[9px] font-black uppercase tracking-wider text-[#a46f00]">Observación del entrenador</p><p className="mt-2 text-[11px] leading-relaxed">{revision.observacion}</p>{revision.decisionSiguientePlan && <p className="mt-2 text-[10px] text-[#555]"><strong>Siguiente paso:</strong> {revision.decisionSiguientePlan}</p>}</section>}

        <footer className="mt-10 flex items-end justify-between border-t border-[#ddd] pt-5"><div><p className="text-sm font-black">Alejandro Mendoza</p><p className="text-[9px] uppercase tracking-wider text-[#777]">Entrenador · VIP Fitness</p></div><div className="text-right"><p className="text-[8px] text-[#999]">Informe generado por Portal VIP Fitness</p><p className="text-[8px] text-[#999]">Los resultados dependen de la información registrada por el alumno.</p></div></footer>
      </article>
    </div>
  );
}
