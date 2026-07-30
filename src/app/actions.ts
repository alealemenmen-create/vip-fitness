"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_VISTA_ALUMNO } from "@/lib/auth";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(COOKIE_VISTA_ALUMNO);
  redirect("/login");
}
