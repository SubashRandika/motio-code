import { publicEnv } from "@/lib/env";

/**
 * Where an uploaded avatar lives, and what counts as a legitimate one.
 *
 * The browser uploads the file straight to Storage and then tells the server
 * which path it wrote. That is the right shape -- it keeps image bytes out of a
 * server action, whose body limit is 1MB, and it lets Storage enforce the size
 * and type limits itself -- but it means the path arrives from the client, and
 * a path from a client is an untrusted string.
 *
 * Two rules make it safe:
 *
 * 1. The path must sit inside the caller's own folder. The RLS policy on
 *    `storage.objects` already prevents writing anywhere else, so the only
 *    thing left to stop is a user pointing their `avatar_url` at an object
 *    belonging to someone else.
 * 2. The URL is built here from the path, never accepted from the caller.
 *    Taking a URL would let anyone set their avatar to any address on the
 *    internet, which turns the header into an open redirect for image
 *    requests and a way to have every viewer's browser call a chosen server.
 */
export const AVATAR_BUCKET = "avatars";

/** Mirrors `allowed_mime_types` on the bucket. SVG is excluded: it can carry script. */
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Mirrors `file_size_limit` on the bucket. Storage rejects anything larger. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const EXTENSION_FOR: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extensionForMimeType(mimeType: string): string | null {
  return EXTENSION_FOR[mimeType] ?? null;
}

/**
 * A fresh path for a user's avatar.
 *
 * The filename is random rather than derived from the upload, for two reasons:
 * a user-supplied filename is a path-traversal question we would rather not
 * have, and a stable name would be served from cache after a replacement --
 * the new picture would not appear until the cache expired.
 */
export function avatarPathFor(userId: string, mimeType: string): string | null {
  const extension = extensionForMimeType(mimeType);
  if (!extension) return null;
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

/** `{uuid}/{uuid}.{ext}` and nothing else -- no traversal, no nesting, no surprises. */
const PATH_SHAPE =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/;

export function isOwnAvatarPath(path: string, userId: string): boolean {
  if (!PATH_SHAPE.test(path)) return false;
  return path.startsWith(`${userId}/`);
}

/** The public URL for a stored avatar, built server-side from a validated path. */
export function avatarPublicUrl(path: string): string {
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/**
 * The storage path behind a stored avatar URL, or null if it is not one of ours.
 *
 * Used to delete the previous picture when a new one replaces it. Returning
 * null for anything unrecognised is what keeps a delete from being aimed at an
 * arbitrary object by a value that predates this code.
 */
export function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null;

  const prefix = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/`;
  if (!url.startsWith(prefix)) return null;

  const path = url.slice(prefix.length);
  return PATH_SHAPE.test(path) ? path : null;
}
