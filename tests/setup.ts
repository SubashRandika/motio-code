import "@testing-library/jest-dom/vitest";

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
