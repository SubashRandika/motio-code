import { describe, expect, it } from "vitest";

import { avatarInitial, avatarSourceFor, emailHash, gravatarUrl } from "@/lib/avatar";

/**
 * The hash has to be exactly what Gravatar expects, because the failure mode is
 * silent: a wrong hash is a well-formed URL for an address nobody has ever
 * registered, so every lookup 404s and every user falls back to their initial.
 * The feature would look like it worked and do nothing.
 */
describe("emailHash", () => {
  it("is SHA-256, pinned to a published test vector", () => {
    // The canonical SHA-256 of "abc", from FIPS 180-4. Asserting against a
    // constant nobody here chose is the only way this test can fail if the
    // digest is ever swapped for MD5 -- which Gravatar also accepts, so the
    // URLs would still look plausible while resolving to nothing.
    expect(emailHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("produces a 64-character hex digest for an address", () => {
    expect(emailHash("help@gravatar.com")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lowercases and trims, because Gravatar hashes the normalised address", () => {
    const canonical = emailHash("someone@example.com");

    expect(emailHash("SomeOne@Example.com")).toBe(canonical);
    expect(emailHash("  someone@example.com  ")).toBe(canonical);
    expect(emailHash("SOMEONE@EXAMPLE.COM\n")).toBe(canonical);
  });

  it("distinguishes different addresses", () => {
    expect(emailHash("a@example.com")).not.toBe(emailHash("b@example.com"));
  });
});

describe("gravatarUrl", () => {
  it("asks for a 404 rather than a generated placeholder", () => {
    // Without `d=404` Gravatar invents an abstract pattern for an unknown
    // address, and every user without a Gravatar would get a stranger's
    // geometry instead of their own initial. The fallback depends on this.
    const url = new URL(gravatarUrl("someone@example.com")!);

    expect(url.searchParams.get("d")).toBe("404");
  });

  it("requests twice the display size, for a 2x screen", () => {
    const url = new URL(gravatarUrl("someone@example.com")!);
    expect(url.searchParams.get("s")).toBe("64");
  });

  it("points at the avatar endpoint on the host the config allows", () => {
    // If these drift apart, next/image refuses the URL at runtime and every
    // avatar 400s -- so the two are asserted together here.
    const url = new URL(gravatarUrl("someone@example.com")!);

    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.gravatar.com");
    expect(url.pathname).toBe(`/avatar/${emailHash("someone@example.com")}`);
  });

  it("never puts the address in the URL", () => {
    // The point of hashing. A regression here would leak addresses to a third
    // party in a query string, where they would also land in access logs.
    const url = gravatarUrl("someone@example.com")!;

    expect(url).not.toContain("someone");
    expect(url).not.toContain("example.com");
    expect(url).not.toContain("@");
  });

  it("returns null when there is no address to hash", () => {
    expect(gravatarUrl(null)).toBeNull();
    expect(gravatarUrl(undefined)).toBeNull();
    expect(gravatarUrl("")).toBeNull();
    expect(gravatarUrl("   ")).toBeNull();
  });

  it("returns null for something that is not an address", () => {
    expect(gravatarUrl("not-an-email")).toBeNull();
  });
});

describe("avatarSourceFor", () => {
  it("prefers a picture the user chose over one inferred from their address", () => {
    const source = avatarSourceFor({
      email: "someone@example.com",
      avatarUrl: "https://cdn.example.com/me.png",
      useGravatar: true,
    });

    expect(source).toBe("https://cdn.example.com/me.png");
  });

  it("falls back to Gravatar when no picture has been uploaded", () => {
    const source = avatarSourceFor({
      email: "someone@example.com",
      avatarUrl: null,
      useGravatar: true,
    });

    expect(source).toBe(gravatarUrl("someone@example.com"));
  });

  it("makes no Gravatar request at all when the user has opted out", () => {
    // The setting has to mean "do not look me up", not "look me up and hide the
    // result" -- a hidden image is still a request carrying their hash.
    const source = avatarSourceFor({
      email: "someone@example.com",
      avatarUrl: null,
      useGravatar: false,
    });

    expect(source).toBeNull();
  });

  it("still shows an uploaded picture when Gravatar is switched off", () => {
    // The two settings are independent: declining the inference should not cost
    // someone the picture they deliberately uploaded.
    const source = avatarSourceFor({
      email: "someone@example.com",
      avatarUrl: "https://cdn.example.com/me.png",
      useGravatar: false,
    });

    expect(source).toBe("https://cdn.example.com/me.png");
  });

  it("has nothing to offer when there is neither", () => {
    expect(avatarSourceFor({ email: null, avatarUrl: null, useGravatar: true })).toBeNull();
  });
});

describe("avatarInitial", () => {
  it("prefers the display name, which is what the user calls themselves", () => {
    expect(avatarInitial("Subash", "someone@example.com")).toBe("S");
  });

  it("falls back to the address", () => {
    expect(avatarInitial(null, "someone@example.com")).toBe("S");
  });

  it("never renders an empty circle", () => {
    // A blank initial under a picture that fails to load leaves an empty disc
    // with no indication of who is signed in.
    expect(avatarInitial(null, null)).toBe("?");
    expect(avatarInitial("   ", null)).toBe("?");
    expect(avatarInitial("", "")).toBe("?");
  });
});
