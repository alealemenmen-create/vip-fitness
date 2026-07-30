import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();

  if (!perfil) redirect("/login");

  redirect(perfil.rol === "alumno" ? "/alumno/inicio" : "/admin/alumnos");
}
