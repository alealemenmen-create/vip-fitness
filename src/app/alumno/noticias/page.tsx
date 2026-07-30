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
          Lo más destacado del gimnasio, mes a mes.
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
          <Card>
            <p className="text-caption mb-3 flex items-center gap-1.5 text-text-tertiary">
              <Newspaper size={14} className="text-vip" /> {nombreMes(mesActual).toUpperCase()}
            </p>
            <div className="space-y-3">
              {porMes.get(mesActual)!.map((noticia, i) => (
                <NoticiaItem key={noticia.id} noticia={noticia} destacada={i === 0} />
              ))}
            </div>
          </Card>

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
