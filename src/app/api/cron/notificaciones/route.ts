import { detectarHabitosRotos } from "@/lib/notificaciones/habitos";

export const dynamic = "force-dynamic";

/** Corre una vez al día (ver vercel.json): compara el patrón propio de cada
 * alumno contra su última semana y avisa al entrenador — con push — cuando
 * un hábito real se cortó de golpe. */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return Response.json({ ok: false, error: "CRON_SECRET no configurado." }, { status: 503 });
  }

  const autorizacion = request.headers.get("authorization");
  if (autorizacion !== `Bearer ${secreto}`) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const resultado = await detectarHabitosRotos();
  return Response.json(resultado, { status: resultado.ok ? 200 : 500 });
}
