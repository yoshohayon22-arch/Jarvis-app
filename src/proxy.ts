/**
 * Proxy Next.js 16 (anciennement « middleware »).
 * 1. Rafraîchit la session Supabase à chaque requête (cookies).
 * 2. Redirige vers /connexion si personne n'est connecté.
 * 3. Déconnecte et refuse tout compte qui n'est pas dans la liste blanche.
 *
 * C'est une vérification « optimiste » : les données privées sont aussi protégées
 * par la Row Level Security de Supabase et par les contrôles des routes serveur.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/connexion", "/auth/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured) {
    // En local, sans Supabase, l'app reste consultable (mode démo, bandeau affiché).
    // En production, on ferme tout tant que la configuration n'est pas faite.
    if (process.env.NODE_ENV !== "production" || isPublic(pathname)) return NextResponse.next();
    return redirectTo(request, "/connexion", { erreur: "config" });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // En-têtes anti-cache fournis par @supabase/ssr lors d'un rafraîchissement de jeton.
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Vérifie le jeton (signature + expiration) et le rafraîchit si besoin.
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;

  const withCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  };

  if (!email) {
    if (isPublic(pathname)) return response;
    return withCookies(redirectTo(request, "/connexion"));
  }

  if (!isEmailAllowed(email)) {
    await supabase.auth.signOut();
    if (pathname === "/connexion") return response;
    return withCookies(redirectTo(request, "/connexion", { erreur: "refuse" }));
  }

  // Déjà connecté : inutile de revoir la page de connexion.
  if (pathname === "/connexion") return withCookies(redirectTo(request, "/"));

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Tout sauf les fichiers statiques, les images optimisées, le manifeste, le service worker et les icônes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|fonts/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|json|txt)$).*)",
  ],
};
