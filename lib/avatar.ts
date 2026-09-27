import { createHash } from "node:crypto";

/**
 * An avatar derived from an email address, via Gravatar.
 *
 * Gravatar is the only thing that turns an email into a picture: people upload
 * an image there once and it follows them between services. Nothing is derived
 * from the address itself -- it is a lookup, and most addresses have no entry.
 *
 * Two things are worth being deliberate about.
 *
 * **The address is never sent.** Gravatar keys on a SHA-256 of the lowercased,
 * trimmed address. That is not anonymity -- a hash of a common email is
 * recoverable from a wordlist -- but it does mean we are not handing a
 * third party a list of our users' addresses in plain text.
 *
 * **The lookup happens on our server, not in the visitor's browser.** The
 * header renders these through `next/image`, so the browser asks our origin for
 * the picture and our origin asks Gravatar. Gravatar therefore learns nothing
 * about who is looking or from where. A bare `<img>` pointing at gravatar.com
 * would report every signed-in user's IP address to Automattic on every page
 * view, which is a meaningful difference for a feature nobody asked to opt into.
 *
 * This module runs server-side: `node:crypto` is not available in a client
 * bundle, and importing it into one is a build error rather than a silent
 * fallback, which is the failure mode worth having.
 */

/** Requested at twice the 32px display size, so it stays sharp on a 2x screen. */
const SIZE = 64;

export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * The Gravatar URL for an address, or null if there is nothing to hash.
 *
 * `d=404` is what makes the fallback possible. Gravatar's default is to return
 * a generated placeholder for an unknown address, which would mean every user
 * without a Gravatar silently gets a stranger's abstract pattern instead of
 * their own initial. Asking for a 404 instead lets the caller tell "no picture"
 * apart from "a picture", which is the whole distinction this feature turns on.
 */
export function gravatarUrl(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  return `https://www.gravatar.com/avatar/${emailHash(email)}?s=${SIZE}&d=404`;
}

/**
 * The picture to try for a user, in order of how much it was chosen.
 *
 * An uploaded avatar always wins: it is an explicit choice, where Gravatar is
 * an inference from their address. `useGravatar` is what makes that inference
 * declinable -- when it is off, no request is made and no hash leaves the
 * server, which is the point of the setting rather than a side effect of it.
 */
export function avatarSourceFor(user: {
  email: string | null;
  avatarUrl: string | null;
  useGravatar: boolean;
}): string | null {
  if (user.avatarUrl) return user.avatarUrl;
  return user.useGravatar ? gravatarUrl(user.email) : null;
}

/** The letter shown when there is no picture, and behind one while it loads. */
export function avatarInitial(displayName: string | null, email: string | null): string {
  return (displayName ?? email ?? "?").trim().charAt(0).toUpperCase() || "?";
}
