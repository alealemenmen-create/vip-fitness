import { NextResponse, type NextRequest } from "next/server";
import { crearCookiePreview, PREVIEW_ACCESS_COOKIE, resolverAccesoPreview } from "@/lib/preview-access";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const identificador = resolverAccesoPreview(String(form.get("codigo") ?? ""));
  if (!identificador) return NextResponse.redirect(new URL("/preview-acceso?error=1", request.url), 303);

  const response = NextResponse.redirect(new URL("/portal-v2/entrenamiento", request.url), 303);
  response.cookies.set(PREVIEW_ACCESS_COOKIE, crearCookiePreview(identificador), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
