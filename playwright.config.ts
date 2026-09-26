import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests.
 *
 * These cover what the component tests structurally cannot: route protection,
 * which lives in the proxy (middleware) and only exists once a real request is
 * made, and redirect handling, where the thing that matters is what a browser
 * does with a header rather than what a function returned.
 *
 * A dedicated port keeps a run from colliding with a dev server the user already
 * has open on 3000, which would otherwise be silently reused and test whatever
 * code that server happened to be running.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The dashboard and marketing pages are meant to work on a phone; the
    // editor is desktop-first by design and is not tested at this width.
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],

  webServer: {
    // Built output rather than dev: a production build is what ships, and dev
    // mode's on-demand compilation makes the first navigation of each route slow
    // enough to look like a failure.
    command: `pnpm build && pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
