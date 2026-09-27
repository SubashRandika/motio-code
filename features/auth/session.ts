import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Whether to fall back to Gravatar when no avatar has been uploaded. */
  useGravatar: boolean;
}

/**
 * The signed-in user, or null.
 *
 * Uses `getClaims()`, which verifies the JWT signature against the project's
 * published keys. `getSession()` is never trusted on the server.
 */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, use_gravatar")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    // Defaults to true for a profile row that has not loaded, matching the
    // column default -- the header should not silently change behaviour on a
    // transient read failure.
    useGravatar: profile?.use_gravatar ?? true,
  };
}

/** Same, but sends anonymous visitors to the login page. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (user) return user;

  const search = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  redirect(`/login${search}`);
}
