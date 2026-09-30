import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readPublicEnv } from "@/lib/env";
import { persistentSessionCookieOptions } from "@/lib/supabase/session-cookie";

function redirectWithSessionCookies(response: NextResponse, request: NextRequest, pathname: string) {
  const redirect = NextResponse.redirect(new URL(pathname, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const env = readPublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, persistentSessionCookieOptions(options));
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!data?.claims?.sub) {
    if (isLoginPage) return response;
    return redirectWithSessionCookies(response, request, "/login");
  }

  if (isLoginPage) {
    return redirectWithSessionCookies(response, request, "/dashboard");
  }

  return response;
}
