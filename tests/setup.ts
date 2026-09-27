import "@testing-library/jest-dom/vitest";

// Fixed Supabase config for tests. Assigned rather than defaulted so a run is
// identical on every machine: modules that read env do so at import time, and a
// developer's real .env.local would otherwise change what the assertions see.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

// jsdom implements pointer events but not pointer capture, which the canvas
// and timeline drag handlers rely on.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// jsdom has no layout engine, so every element measures 0x0. Tests that need a
// real size stub getBoundingClientRect on the specific element.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom parses <dialog> but implements none of its behaviour, so a modal built
// on it cannot open in a test. These stubs give the parts components rely on:
// `open` reflects state, and `close` fires the event React listens to.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}
