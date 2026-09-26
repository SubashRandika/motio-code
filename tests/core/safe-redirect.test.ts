import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/site";

/**
 * The `next` parameter is attacker-controllable: it arrives in a link someone
 * can email ("confirm your account") and decides where the app sends a user
 * after they sign in. If it can be made to point off-site, it is a credible
 * phishing primitive -- the victim starts on the real domain and ends up
 * somewhere else, already trusting the page.
 */
describe("safeRedirectPath", () => {
  it("keeps a legitimate in-app path", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/projects/8b1d2c3e/editor")).toBe("/projects/8b1d2c3e/editor");
  });

  it("keeps a query string and fragment", () => {
    expect(safeRedirectPath("/dashboard?q=auth#scenes")).toBe("/dashboard?q=auth#scenes");
  });

  it("falls back when there is nothing to redirect to", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
  });

  it("honours a caller's own fallback", () => {
    expect(safeRedirectPath(null, "/settings/profile")).toBe("/settings/profile");
    expect(safeRedirectPath("https://evil.example", "/settings/profile")).toBe("/settings/profile");
  });

  it("refuses an absolute URL", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("http://evil.example/path")).toBe("/dashboard");
  });

  it("refuses a protocol-relative URL", () => {
    // "//evil.example" inherits the current scheme and goes off-site.
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example/dashboard")).toBe("/dashboard");
  });

  it("refuses a backslash, which a browser rewrites into a protocol-relative URL", () => {
    // The bypass a leading-slash check misses: "/\evil.example" is normalised to
    // "//evil.example" before it is followed.
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\/evil.example")).toBe("/dashboard");
  });

  it("refuses traversal that collapses into a protocol-relative path", () => {
    // Origin is unchanged here, but the resolved path becomes "//evil.example",
    // so judging the origin alone is not enough.
    expect(safeRedirectPath("/..//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/../..//evil.example")).toBe("/dashboard");
  });

  it("refuses a non-http scheme", () => {
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
    expect(safeRedirectPath("mailto:someone@example.com")).toBe("/dashboard");
  });

  it("strips control characters rather than letting them smuggle anything", () => {
    // A parser drops these, so the check must see what the browser will see.
    expect(safeRedirectPath("/\tevil")).toBe("/evil");
    expect(safeRedirectPath("/\nevil")).toBe("/evil");
    expect(safeRedirectPath("/\r\nevil")).toBe("/evil");
  });

  it("catches a control character used to build a protocol-relative path", () => {
    // Both halves of the check earn their place here: stripping the tab leaves
    // "//evil.example", which keeps the probe origin but is protocol-relative,
    // so only the check on the resolved path rejects it.
    expect(safeRedirectPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\n/evil.example")).toBe("/dashboard");
  });

  it("never returns something that leaves the origin", () => {
    // A sweep, so a future change has to keep the guarantee rather than just
    // the listed cases.
    const payloads = [
      "/dashboard",
      "//evil.example",
      "/\\evil.example",
      "/\\\\evil.example",
      "https://evil.example",
      "http://evil.example",
      "//user:pass@evil.example",
      "/..//evil.example",
      "/./..//evil.example",
      "javascript:alert(1)",
      "\\\\evil.example",
      "/%2F%2Fevil.example",
      "/\tevil.example",
      "/dashboard?next=//evil.example",
    ];

    for (const payload of payloads) {
      const result = safeRedirectPath(payload);
      const resolved = new URL(result, "https://motiocode.test");

      expect(resolved.origin, `${payload} -> ${result}`).toBe("https://motiocode.test");
      expect(result.startsWith("/"), `${payload} -> ${result}`).toBe(true);
      expect(result.startsWith("//"), `${payload} -> ${result}`).toBe(false);
    }
  });
});
