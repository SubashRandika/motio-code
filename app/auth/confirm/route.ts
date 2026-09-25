import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/site";

/**
 * Lands every emailed auth link: confirmations, magic links and password
 * recovery.
 *
 * Supabase sends either a `token_hash` (when the email template uses
 * `{{ .TokenHash }}`) or a PKCE `code` (the stock template). Both are handled
 * so the flow works whichever template the project is configured with.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = next;

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(redirectTo);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = "/login";
  redirectTo.search = "?error=link-expired";
  return NextResponse.redirect(redirectTo);
}
