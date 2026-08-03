import {
  Newspaper,
  Scale,
  Trophy,
  TrendingUp,
  ChevronDown,
  Megaphone,
  Sparkles,
  UserPlus,
  PartyPopper,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { MarcarNoticiasVistas } from "@/components/student/MarcarNoticiasVistas";
import {
  obtenerNoticias,
  obtenerAnuncios,
  contarNoticiasSinVer,
  type Noticia,
  type TipoNoticia,
} from "@/lib/noticias/data";

const ICONOS: Record<TipoNoticia, typeof Scale> = {
  peso: Scale,
  torneo: Trophy,
  rango: TrendingUp,
  asistencia: TrendingUp,
  reconocimiento: Sparkles,
  bienvenida: UserPlus,
  cumpleanos: PartyPopper,
};

const COLORES: Record<TipoNoticia, string> = {
  peso: "var(--color-success)",
  torneo: "var(--color-vip)",
  rango: "var(--color-acento-fuerte)",
  asistencia: "var(--color-success)",
  reconocimiento: "var(--color-vip)",
  bienvenida: "var(--color-text-secondary)",
  cumpleanos: "var(--color-vip)",
};

function nombreMes(anioMes: string): string {
  const [anio, mes] = anioMes.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lunes de la semana calendario que contiene `fechaISO` ("YYYY-MM-DD"),
 * como clave para agrupar. Todo en UTC a propósito: tratar la fecha como
 * aritmética de calendario pura, no como un instante con huso horario, es lo
 * único que evita que un `new Date(...).toISOString()` corra la fecha un día
 * según dónde corra el servidor. */
function lunesDeSemanaISO(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const diasDesdeLunes = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diasDesdeLunes);
  return fecha.toISOString().slice(0, 10);
}

/** "Semana del 28 jul al 3 ago" — o "Esta semana" si el lunes calculado es el
 * de la semana calendario en curso, para que la más reciente se distinga sin
 * tener que leer las dos fechas. */
function nombreSemana(lunesISO: string): string {
  const [anio, mes, dia] = lunesISO.split("-").map(Number);
  const lunes = new Date(Date.UTC(anio, mes - 1, dia));
  if (lunesISO === lunesDeSemanaISO(new Date().toISOString().slice(0, 10))) return "Esta semana";
  const domingo = new Date(lunes);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  const formato = (d: Date) =>
    d.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
  return `Semana del ${formato(lunes)} al ${formato(domingo)}`;
}

/** Agrupa una lista de noticias (ya de un mismo mes) por semana calendario,
 * de la más reciente a la más vieja. El orden DENTRO de cada semana no se
 * toca: viene de `obtenerNoticias`, por relevancia. */
function agruparPorSemana(noticias: Noticia[]): [string, Noticia[]][] {
  const porSemana = new Map<string, Noticia[]>();
  for (const noticia of noticias) {
    const lunes = lunesDeSemanaISO(noticia.fecha);
    const lista = porSemana.get(lunes) ?? [];
    lista.push(noticia);
    porSemana.set(lunes, lista);
  }
  return [...porSemana.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default async function NoticiasPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const [porMes, anuncios, sinVer] = await Promise.all([
    obtenerNoticias(supabase),
    obtenerAnuncios(supabase),
    contarNoticiasSinVer(supabase, alumnoId),
  ]);
  const meses = [...porMes.keys()];
  const mesActual = meses[0];
  const anteriores = meses.slice(1);

  return (
    <div className="space-y-6 pb-8">
      {/* Marcar como vistas va del lado del cliente para poder refrescar el
          layout y apagar el globito sin recargar la página. */}
      {!soloLectura && <MarcarNoticiasVistas sinVer={sinVer} />}

      <div>
        <h1 className="text-h2 text-text">
          Noticias <span className="text-vip">VIP</span>
        </h1>
        <p className="text-secondary mt-1 text-text-secondary">
          Lo más destacado del gimnasio, semana a semana.
        </p>
      </div>

      {anuncios.length > 0 && (
        <div className="space-y-2">
          {anuncios.map((a) => (
            <div key={a.id} className="panel-vip-espejo radius-card flex gap-3 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vip/15 text-vip">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-card-title text-text">{a.titulo}</p>
                <p className="text-secondary mt-0.5 text-text-secondary">{a.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {meses.length === 0 ? (
        anuncios.length === 0 && (
          <Card>
            <p className="text-body text-text-secondary">
              Todavía no hay noticias. Las nuevas incorporaciones, logros semanales, torneos y
              avances importantes aparecerán acá.
            </p>
          </Card>
        )
      ) : (
        <>
          {/* Mes en curso: partido semana a semana, la más reciente arriba —
              es la parte que el alumno realmente revisa seguido, y una lista
              plana de todo el mes se volvía larga de recorrer. Los meses ya
              cerrados no se tocan: siguen colapsados enteros más abajo. */}
          <div className="space-y-3">
            <p className="text-caption flex items-center gap-1.5 text-text-tertiary">
              <Newspaper size={14} className="text-vip" /> {nombreMes(mesActual).toUpperCase()}
            </p>
            {agruparPorSemana(porMes.get(mesActual)!).map(([lunes, noticiasSemana], i) => (
              <Card key={lunes}>
                <p className="text-caption mb-3 font-semibold text-text-secondary">
                  {nombreSemana(lunes).toUpperCase()}
                </p>
                <div className="space-y-3">
                  {noticiasSemana.map((noticia, j) => (
                    <NoticiaItem key={noticia.id} noticia={noticia} destacada={i === 0 && j === 0} />
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {anteriores.length > 0 && (
            <div className="space-y-2">
              <p className="text-caption text-text-tertiary">MESES ANTERIORES</p>
              {anteriores.map((mes) => (
                <details key={mes} className="radius-card group border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
                    <span className="text-body font-medium text-text">{nombreMes(mes)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-caption text-text-tertiary">
                        {porMes.get(mes)!.length}{" "}
                        {porMes.get(mes)!.length === 1 ? "noticia" : "noticias"}
                      </span>
                      <ChevronDown
                        size={18}
                        className="text-text-tertiary transition-transform duration-200 group-open:rotate-180"
                      />
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-border p-4">
                    {porMes.get(mes)!.map((noticia) => (
                      <NoticiaItem key={noticia.id} noticia={noticia} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoticiaItem({ noticia, destacada = false }: { noticia: Noticia; destacada?: boolean }) {
  const Icono = ICONOS[noticia.tipo];
  const color = COLORES[noticia.tipo];

  return (
    <div
      className="radius-control flex gap-3 p-3"
      style={{
        background: destacada ? `${color}14` : "transparent",
        border: destacada ? `1px solid ${color}66` : "1px solid var(--color-border)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}22`, color }}
      >
        <Icono size={18} />
      </span>
      <div className="min-w-0">
        <p className={`text-text ${destacada ? "text-card-title" : "text-body font-medium"}`}>
          {noticia.titular}
        </p>
        <p className="text-caption mt-0.5 text-text-secondary">{noticia.detalle}</p>
      </div>
    </div>
  );
}
