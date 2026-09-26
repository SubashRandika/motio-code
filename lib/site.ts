import { headers } from "next/headers";

/**
 * Absolute origin for links inside transactional emails.
 * Falls back to the forwarded request host so preview deployments work
 * without extra configuration.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

/**
 * An origin no one can own, used only to resolve a candidate path against
 * something. `.invalid` is reserved by RFC 2606 for exactly this.
 */
const PROBE_ORIGIN = "https://motiocode.invalid";

/**
 * Only allow redirects to paths inside this app, so a crafted `next` parameter
 * cannot bounce a user to another origin.
 *
 * Checking the string for a leading `/` is not enough, because browsers and URL
 * parsers rewrite a path before following it:
 *
 * - `/\evil.com` -- a backslash is normalised to a forward slash, turning it
 *   into `//evil.com`, which is protocol-relative and therefore another origin.
 * - `/..//evil.com` -- traversal collapses to `//evil.com` after parsing, so a
 *   check on the *input* passes while the thing actually followed is off-site.
 * - `/<tab>evil` -- control characters are stripped during parsing, so they can
 *   smuggle characters past a naive check.
 *
 * So rather than enumerating tricks, the candidate is resolved the way a browser
 * would and the result is judged: the origin must not have moved, and what comes
 * back must still be a single-slash path. Both halves are needed -- traversal
 * keeps the origin but yields a protocol-relative path.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/")) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }

  if (resolved.origin !== PROBE_ORIGIN) return fallback;

  // Normalised, so what is returned is what a browser would have followed.
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;

  return path;
}
