import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/ui/error-boundary";

/**
 * React logs every caught error to the console itself, which would bury the
 * real output of a suite that deliberately throws. Silenced per test rather
 * than globally, so an unexpected error elsewhere still surfaces.
 */
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

function Boom({ fail }: { fail: boolean }): React.ReactElement {
  if (fail) throw new Error("element exploded");
  return <p>working</p>;
}

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <Boom fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("working")).toBeInTheDocument();
  });

  it("shows the fallback instead of propagating the throw", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>caught: {error.message}</p>}>
        <Boom fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText("caught: element exploded")).toBeInTheDocument();
  });

  it("reports the error rather than swallowing it", () => {
    // A boundary that recovers quietly is how a bug survives a release.
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError} fallback={() => <p>fallback</p>}>
        <Boom fail />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("recovers when the reset callback is used", async () => {
    const user = userEvent.setup();

    // Whether it throws is held outside React, because React re-renders a
    // failing component once on its own before showing a fallback -- so a
    // component that counted its own renders would recover by accident and the
    // test would pass without reset ever being called.
    const control = { failing: true };

    function Controlled() {
      if (control.failing) throw new Error("transient");
      return <p>recovered</p>;
    }

    render(
      <ErrorBoundary
        fallback={(_error, reset) => (
          <button type="button" onClick={reset}>
            retry
          </button>
        )}
      >
        <Controlled />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();

    control.failing = false;
    await user.click(screen.getByRole("button", { name: "retry" }));

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("retries by itself when a reset key changes", () => {
    // The important one. Without this a boundary stays caught forever: the user
    // fixes the thing that broke, and the fallback is still there, so the fix
    // looks like it did not work.
    const { rerender } = render(
      <ErrorBoundary resetKeys={["v1"]} fallback={() => <p>fallback</p>}>
        <Boom fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText("fallback")).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKeys={["v2"]} fallback={() => <p>fallback</p>}>
        <Boom fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("working")).toBeInTheDocument();
  });

  it("stays caught while the reset keys are unchanged", () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={["v1"]} fallback={() => <p>fallback</p>}>
        <Boom fail />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary resetKeys={["v1"]} fallback={() => <p>fallback</p>}>
        <Boom fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("fallback")).toBeInTheDocument();
  });
});
