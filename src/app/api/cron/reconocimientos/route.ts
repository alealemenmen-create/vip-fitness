import { generarReconocimientosSemanales } from "@/lib/ai/reconocimientosSemanales";
import { generarMotivacionPeso } from "@/lib/ai/motivacionPeso";
import { generarNotasSemanalesAutomaticas } from "@/lib/ai/notasSemanales";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return Response.json({ ok: false, error: "CRON_SECRET no configurado." }, { status: 503 });
  }

  const autorizacion = request.headers.get("authorization");
  if (autorizacion !== `Bearer ${secreto}`) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const [resultado, motivacion, notas] = await Promise.all([
    generarReconocimientosSemanales(),
    generarMotivacionPeso(),
    generarNotasSemanalesAutomaticas(),
  ]);
  return Response.json(
    { ...resultado, motivacionPeso: motivacion, notasSemanales: notas },
    { status: resultado.ok && motivacion.ok && notas.ok ? 200 : 500 }
  );
}
