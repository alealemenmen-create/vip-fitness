import Link from "next/link";
import { ExternalLink, Images } from "lucide-react";
import { requireControlVipV2 } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerDocumentosEstudioVip } from "@/lib/estudio-vip/data";
import { listarHistorialEstudioVip } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EstudioVipEditorV2 } from "@/components/control-vip-v2/EstudioVipEditorV2";

export const metadata = { title: "Estudio VIP · Control VIP V2" };

/**
 * Estudio VIP en Control VIP V2 (Fase 5): editor de tres paneles, la misma
 * navegación de verdad como vista previa (`BottomNavV2`, no una maqueta), e
 * historial con restauración — lo único que le faltaba al motor ya existente
 * (`publicarEstudioVip` ya guarda un snapshot inmutable en cada publicación,
 * nadie lo leía todavía). Guarda/publica sobre el mismo borrador y
 * publicada.json que ya consume `/admin/estudio-vip` y Portal V2 real: no
 * hay una segunda configuración, ambos editores escriben al mismo lugar.
 */
export default async function ControlVipV2EstudioVipPage() {
  await requireControlVipV2();
  const supabase = await createClient();
  const [{ borrador, publicado }, { count: totalAlumnos }, { count: alumnosV2 }, historial] = await Promise.all([
    obtenerDocumentosEstudioVip(),
    supabase.from("alumno_perfil").select("user_id", { count: "exact", head: true }),
    supabase.from("alumno_perfil").select("user_id", { count: "exact", head: true }).eq("portal_v2_habilitado", true),
    listarHistorialEstudioVip(),
  ]);

  return (
    <div className="space-y-4 pb-10">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Estudio VIP"
        description="Editá, previsualizá con la navegación real, guardá como borrador y publicá — o restaurá una versión anterior."
        actions={
          <>
            <Link href="/control-vip/galeria" className="boton-panel-secundario">
              <Images size={15} /> Fotos y videos
            </Link>
            <Link href="/portal-v2/entrenamiento" target="_blank" className="boton-panel-primario">
              Portal real <ExternalLink size={15} />
            </Link>
          </>
        }
      />
      <EstudioVipEditorV2
        borradorInicial={borrador}
        publicadoInicial={publicado}
        totalAlumnos={totalAlumnos ?? 0}
        alumnosV2={alumnosV2 ?? 0}
        historial={historial}
      />
    </div>
  );
}
