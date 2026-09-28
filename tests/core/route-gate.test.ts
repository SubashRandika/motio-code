import { describe, expect, it } from "vitest";

import { requiresSession } from "@/lib/supabase/proxy";

/**
 * Which paths the proxy gates.
 *
 * This is an allowlist of *protected* prefixes, which is the direction that
 * needs watching: adding a signed-in section without adding it here means the
 * proxy lets an anonymous request through to render. The server still redirects
 * -- every page in the group sits under a layout that calls `requireUser()` --
 * but the wasted render is worth avoiding, and a gap here is easy to miss.
 *
 * It used to be the other way round, listing public paths, and that had a
 * subtler cost: every path matching no route at all counted as protected, so a
 * signed-out visitor following a stale link met a login form instead of the
 * not-found page, then signed in and arrived at the 404 anyway.
 */
describe("requiresSession", () => {
  it("gates every signed-in route in the app", () => {
    for (const path of [
      "/dashboard",
      "/projects/new",
      "/projects/3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11/editor",
      "/projects/3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11/settings",
      "/settings/profile",
    ]) {
      expect(requiresSession(path), path).toBe(true);
    }
  });

  it("leaves the public pages alone", () => {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/auth/confirm",
    ]) {
      expect(requiresSession(path), path).toBe(false);
    }
  });

  it("lets an unknown path through, so it can reach the not-found page", () => {
    // The regression this file exists for.
    for (const path of ["/nonsense", "/blog/post-1", "/dashboardish", "/projectsomething"]) {
      expect(requiresSession(path), path).toBe(false);
    }
  });

  it("matches on a path segment, not a string prefix", () => {
    // `/dashboardextra` is not inside `/dashboard`, and `/settings-public`
    // is not inside `/settings`. A naive startsWith would gate both.
    expect(requiresSession("/dashboardextra")).toBe(false);
    expect(requiresSession("/settings-public")).toBe(false);

    // But genuine children are gated.
    expect(requiresSession("/dashboard/anything")).toBe(true);
    expect(requiresSession("/settings/profile")).toBe(true);
  });
});
