import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarPathFor,
  avatarPathFromUrl,
  avatarPublicUrl,
  extensionForMimeType,
  isOwnAvatarPath,
} from "@/lib/avatar-storage";

const USER = "3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

/**
 * The browser uploads straight to Storage and then tells the server which path
 * it wrote, so this string crosses a trust boundary. RLS already stops a write
 * outside the user's own folder; what is left for these rules to stop is a user
 * *claiming* an object they did not write.
 */
describe("isOwnAvatarPath", () => {
  it("accepts a path in the caller's own folder", () => {
    expect(isOwnAvatarPath(`${USER}/${OTHER}.png`, USER)).toBe(true);
    expect(isOwnAvatarPath(`${USER}/${OTHER}.jpg`, USER)).toBe(true);
    expect(isOwnAvatarPath(`${USER}/${OTHER}.webp`, USER)).toBe(true);
  });

  it("refuses a path in someone else's folder", () => {
    // The whole point. A well-formed path is not automatically the caller's.
    expect(isOwnAvatarPath(`${OTHER}/${USER}.png`, USER)).toBe(false);
  });

  it("refuses traversal out of the folder", () => {
    for (const path of [
      `${USER}/../${OTHER}/x.png`,
      `${USER}/../../etc/passwd.png`,
      `../${USER}/x.png`,
      `${USER}/sub/dir/x.png`,
    ]) {
      expect(isOwnAvatarPath(path, USER), path).toBe(false);
    }
  });

  it("refuses a prefix that merely starts with the user id", () => {
    // `${USER}-evil/x.png` starts with the id as a string but is a different
    // folder, which a naive startsWith check would wave through.
    expect(isOwnAvatarPath(`${USER}-evil/${OTHER}.png`, USER)).toBe(false);
  });

  it("refuses types the bucket does not allow", () => {
    // SVG especially: it is a document that can carry script, and the bucket is
    // public, so serving one would be stored XSS.
    for (const extension of ["svg", "html", "js", "gif", "php"]) {
      expect(isOwnAvatarPath(`${USER}/${OTHER}.${extension}`, USER), extension).toBe(false);
    }
  });

  it("refuses a name that is not the shape we generate", () => {
    for (const path of [`${USER}/avatar.png`, `${USER}/.png`, `${USER}/`, USER, ""]) {
      expect(isOwnAvatarPath(path, USER), path || "(empty)").toBe(false);
    }
  });
});

describe("avatarPathFor", () => {
  it("puts the file in the user's own folder, with the right extension", () => {
    const path = avatarPathFor(USER, "image/png");

    expect(path).not.toBeNull();
    expect(path!.startsWith(`${USER}/`)).toBe(true);
    expect(path!.endsWith(".png")).toBe(true);
    expect(isOwnAvatarPath(path!, USER)).toBe(true);
  });

  it("generates a path the validator accepts, for every allowed type", () => {
    // These two have to agree. If the generator emits something the validator
    // rejects, every upload would succeed and then be refused on the way back.
    for (const mimeType of AVATAR_MIME_TYPES) {
      const path = avatarPathFor(USER, mimeType);
      expect(path, mimeType).not.toBeNull();
      expect(isOwnAvatarPath(path!, USER), mimeType).toBe(true);
    }
  });

  it("never reuses a name, so a replacement is not served from cache", () => {
    const first = avatarPathFor(USER, "image/png");
    const second = avatarPathFor(USER, "image/png");

    expect(first).not.toBe(second);
  });

  it("refuses a type the bucket would reject anyway", () => {
    expect(avatarPathFor(USER, "image/svg+xml")).toBeNull();
    expect(avatarPathFor(USER, "text/html")).toBeNull();
    expect(extensionForMimeType("image/svg+xml")).toBeNull();
  });
});

describe("avatarPublicUrl and avatarPathFromUrl", () => {
  it("round-trips a path it built itself", () => {
    const path = `${USER}/${OTHER}.png`;
    expect(avatarPathFromUrl(avatarPublicUrl(path))).toBe(path);
  });

  it("does not recognise a URL pointing somewhere else", () => {
    // This value drives a delete, so anything unrecognised must return null
    // rather than a best guess at a path.
    for (const url of [
      "https://evil.example/storage/v1/object/public/avatars/x.png",
      "https://example.supabase.co/storage/v1/object/public/project-renders/x.mp4",
      "https://www.gravatar.com/avatar/abc",
      "not a url",
      null,
    ]) {
      expect(avatarPathFromUrl(url), String(url)).toBeNull();
    }
  });

  it("does not recognise a malformed path inside a URL that otherwise matches", () => {
    expect(
      avatarPathFromUrl("https://example.supabase.co/storage/v1/object/public/avatars/../x.png"),
    ).toBeNull();
  });
});

describe("the limits", () => {
  it("matches what the bucket enforces, since the UI only repeats them", () => {
    // Drift here is the dangerous kind: the form would promise something the
    // server does not honour, and the upload would fail after the wait.
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect([...AVATAR_MIME_TYPES]).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });

  it("excludes SVG, which a public bucket must never serve from users", () => {
    expect(AVATAR_MIME_TYPES as readonly string[]).not.toContain("image/svg+xml");
  });
});
