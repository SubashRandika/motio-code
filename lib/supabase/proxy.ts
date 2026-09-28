import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Everything under these prefixes requires a session.
 *
 * Named as what is protected rather than what is public, which is the less
 * obvious of the two and was originally the other way round. Listing the public
 * routes means every path that matches *no route at all* is treated as
 * protected -- so a signed-out visitor following a stale link was sent to the
 * login form, and after signing in was delivered to the 404 page they were
 * always going to get. The not-found page was unreachable for exactly the
 * people most likely to need it.
 *
 * The usual objection to an allowlist of protected routes is that forgetting to
 * add one makes it public. That is not the failure mode here: every page in the
 * signed-in group renders under a layout that calls `requireUser()`, so the
 * server redirects regardless of what this list says. This gate exists to avoid
 * rendering a page that is about to be thrown away, not to be the only lock --
 * and `e2e/auth-gate.spec.ts` walks every protected route from a browser.
 */
const PROTECTED_PATHS = ["/dashboard", "/projects", "/settings"];

/** Routes a signed-in user should not see. */
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export function isWithin(pathname: string, paths: string[]) {
  return paths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function requiresSession(pathname: string): boolean {
  return isWithin(pathname, PROTECTED_PATHS);
}

/**
 * Refreshes the Supabase session cookie and gates routes.
 *
 * Nothing may run between `createServerClient` and `getClaims()` -- a stray
 * await there is the classic cause of users being randomly signed out.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() verifies the JWT signature against the project's published
  // keys. Never trust getSession() here.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  if (!claims && requiresSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (claims && isWithin(pathname, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Must be returned as-is so the refreshed auth cookies reach the browser.
  return supabaseResponse;
}
