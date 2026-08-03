import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Bot, Dumbbell } from "lucide-react";
import { nombrePublicado } from "@/lib/nombre";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: miAlumnoPerfil } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  // Alimentos que crearon los alumnos y todavía nadie miró: pintan el punto
  // rojo en la pestaña Alimentos. Va con `head` para traer solo el número, sin
  // las filas. Si la migración 0030 no está corrida, la consulta falla, `count`
  // queda en null y simplemente no hay punto.
  // Igual que los alimentos: solo el número, y si la migración 0032 todavía no
  // está corrida la consulta falla, queda en null y no se pinta nada.
  const [{ count: alimentosPendientes }, { count: solicitudesPendientes }] = await Promise.all([
    supabase
      .from("alimentos")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", false)
      .eq("activo", true),
    supabase
      .from("solicitudes_registro")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
  ]);

  return (
    /* `fixed inset-0` + el scroll en un hijo (`.pantalla-scroll`, definida en
       globals.css junto con `html, body { overflow: hidden }`): mismo arreglo
       que /alumno (ver el comentario ahí). Sin esto el panel de admin quedaba
       con la página entera trabada — el body ya no scrollea desde ese cambio
       global, y acá no había ningún contenedor interno que lo reemplazara. */
    /* `--escala-texto` es la misma variable que ya usa el ajuste de tamaño de
       letra del alumno (ver globals.css: TODAS las clases text-h1..text-micro
       están escritas como `calc(Npx * var(--escala-texto))`). Pisarla acá, más
       específica que la del :root, achica la letra de TODO el panel de admin
       de una sola vez —sin tocar un componente ni una clase— y las pantallas
       quedan tan compactas como ya se ven las de /alumno. */
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-bg"
      style={{ "--escala-texto": 0.82 } as React.CSSProperties}
    >
      {/* Cabecera clavada: vive FUERA de `.pantalla-scroll`, como hermano flex.
          No es `sticky` a propósito — un sticky queda confinado a su bloque
          contenedor y basta un padding-top en el scroller para que no llegue
          al borde y el contenido desfile por la rendija (es el bug que se
          arregló en /alumno). Siendo hermano no scrollea nunca y el contenido
          queda recortado por el borde del scroller, sin rendija posible. */}
      <div className="mx-auto w-full max-w-md shrink-0 bg-bg px-4 pb-3 pt-8">
        <Logo compact className="mb-3" corner={<ThemeToggle />} />

        <div className="mb-3 flex items-center gap-2">
          <div>
            <p className="text-[10px] text-text-tertiary">PANEL</p>
            <h1 className="text-caption font-semibold text-text">{nombrePublicado(sesion.nombre)}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/admin/asistente"
            className="btn-accion radius-control flex items-center justify-center gap-2 px-3 py-3 text-secondary font-semibold"
          >
            <Bot size={17} /> Asistente VIP
          </Link>
          {miAlumnoPerfil ? (
            <Link
              href="/alumno/inicio"
              className="radius-control flex items-center justify-center gap-2 border border-border px-3 py-3 text-secondary font-medium text-vip"
            >
              <Dumbbell size={16} /> Mi entrenamiento
            </Link>
          ) : (
            <form action={crearMiPerfilAlumno}>
              <button
                type="submit"
                className="radius-control flex h-full w-full items-center justify-center gap-2 border border-dashed border-border px-2 py-3 text-caption text-text-tertiary"
              >
                <Dumbbell size={16} /> Activar alumno
              </button>
            </form>
          )}
        </div>
      </div>

      {/* SIN padding-top: los títulos de cada pestaña se clavan acá con
          `sticky top-0` (ver TituloPestana) y un padding en este contenedor
          les impediría llegar al borde. El aire lo pone cada título. */}
      <div className="pantalla-scroll mx-auto w-full max-w-md px-4 pb-24">
        {children}

        <LogoutButton className="text-caption mt-8 block w-full py-2 text-center text-text-tertiary" />
      </div>
      {/* `fixed` y no `sticky`: en iOS Safari, con el documento scrolleando,
          lo `fixed`/`sticky` se desengancha y se arrastra mientras dura el
          gesto (mismo problema que se resolvió en /alumno). Acá el body ya no
          scrollea (ver arriba), pero mantenerlo `fixed` evita que vuelva a
          pasar si algo dentro de `.pantalla-scroll` rebota. */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md">
        <AdminTabs
          alimentosPendientes={alimentosPendientes ?? 0}
          solicitudesPendientes={solicitudesPendientes ?? 0}
        />
      </div>
    </div>
  );
}
