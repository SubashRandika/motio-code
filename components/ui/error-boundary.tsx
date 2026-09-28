"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A React error boundary.
 *
 * Still a class, because `componentDidCatch` has no hook equivalent -- React
 * has never shipped one, and the recommended alternative is to use a library
 * that is also a class underneath.
 *
 * What a boundary is *for* is worth being precise about, because it is easy to
 * wrap everything and feel safer without being safer. A boundary decides how
 * much of the tree dies when something throws. Wrapping the whole editor turns
 * a broken element into a blank page; wrapping each element turns the same
 * throw into one missing box on a canvas that still works. So these are placed
 * where the blast radius should stop, not wherever an error might occur.
 *
 * `resetKeys` is what makes a boundary recoverable rather than a dead end. A
 * boundary that has caught stays caught -- it will keep showing the fallback
 * even after the user fixes the thing that broke -- unless something tells it
 * to try again. Changing a key does that.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the children once something below has thrown. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Re-renders the children when any of these change, so a fix is picked up. */
  resetKeys?: readonly unknown[];
  /** For logging. Errors are not swallowed silently. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (!this.state.error) return;

    const before = previous.resetKeys;
    const after = this.props.resetKeys;
    if (!before || !after) return;

    const changed =
      before.length !== after.length || before.some((key, index) => !Object.is(key, after[index]));

    if (changed) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged even when the UI recovers gracefully: a boundary that catches
    // quietly is how a bug survives a release. In production this is where a
    // reporting service would be called.
    this.props.onError?.(error, info);
    console.error("Caught by an error boundary:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
