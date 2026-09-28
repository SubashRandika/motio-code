"use client";

import { useEffect } from "react";

/**
 * The last boundary there is.
 *
 * `app/error.tsx` is rendered *inside* the root layout, so it cannot catch a
 * failure in the root layout itself -- fonts, the html and body tags, the
 * providers. This one replaces the document instead, which is why it has to
 * ship its own `<html>` and `<body>`.
 *
 * It also means nothing here can rely on the app: no global stylesheet, no
 * design tokens, no fonts. Those are exactly the things that may have been what
 * failed. So the styles below are inline and self-contained, and the page is
 * built to render correctly with no CSS at all beyond what it carries.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout failed:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1rem",
          backgroundColor: "#0e1116",
          color: "#e8ecf2",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#e5675e",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            Error
          </p>

          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
            MotioCode could not start
          </h1>

          <p style={{ margin: "0.75rem 0 0", lineHeight: 1.6, color: "#9faec1" }}>
            Something failed before the page could load. Reloading usually fixes it; if it does
            not, the service may be having trouble.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "0.5rem 0 0",
                fontSize: 12,
                color: "#7e8fa6",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: 14,
              fontWeight: 500,
              color: "#0e1116",
              backgroundColor: "#f2a63b",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
