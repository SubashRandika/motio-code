import { afterEach, describe, expect, it } from "vitest";

import { controlOwnsKey, modalIsOpen } from "@/lib/a11y/key-ownership";

/**
 * The editor's shortcuts are bound to `window`, which is the only place a canvas
 * shortcut can live when nothing in particular is focused. The hazard is that
 * the same handler hears keys meant for the focused control, and it calls
 * `preventDefault()` -- which does not duplicate the control's behaviour, it
 * cancels it.
 *
 * The case that made this necessary: "Space toggles playback". A `<button>` is
 * activated by Space, so preventing the default left every icon button in the
 * editor toolbar unpressable by keyboard, while working perfectly with a mouse.
 */
function el(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("controlOwnsKey", () => {
  it("leaves Space to a button, which is how a button is pressed", () => {
    expect(controlOwnsKey(el("<button>Save</button>"), " ")).toBe(true);
  });

  it("does not hand a button the keys it has no use for", () => {
    const button = el("<button>Save</button>");
    for (const key of ["ArrowLeft", "ArrowRight", "Delete", "Backspace", "Escape"]) {
      expect(controlOwnsKey(button, key), key).toBe(false);
    }
  });

  it("gives a text field everything, including the keys that edit around the caret", () => {
    const input = el('<input type="text" />');
    for (const key of ["a", " ", "ArrowLeft", "Home", "End", "Backspace", "Delete"]) {
      expect(controlOwnsKey(input, key), key).toBe(true);
    }
  });

  it("treats a textarea and a contenteditable the same as a text field", () => {
    expect(controlOwnsKey(el("<textarea></textarea>"), "Delete")).toBe(true);
    expect(controlOwnsKey(el('<div contenteditable="true"></div>'), "Backspace")).toBe(true);
  });

  it("covers the typed inputs that are still text entry", () => {
    // A number input is the one that matters here: the properties panel is full
    // of them, and its arrows increment the value.
    for (const type of ["number", "email", "search", "password", "date"]) {
      expect(controlOwnsKey(el(`<input type="${type}" />`), "ArrowUp"), type).toBe(true);
    }
  });

  it("does not treat a checkbox as text entry, but does give it Space", () => {
    const checkbox = el('<input type="checkbox" />');
    expect(controlOwnsKey(checkbox, " ")).toBe(true);
    expect(controlOwnsKey(checkbox, "Delete")).toBe(false);
  });

  it("gives a radio its arrows, because arrows move between radios", () => {
    const radio = el('<input type="radio" />');
    expect(controlOwnsKey(radio, "ArrowDown")).toBe(true);
    expect(controlOwnsKey(radio, " ")).toBe(true);
  });

  it("gives a select the keys that open it and move through it", () => {
    const select = el("<select><option>a</option></select>");
    for (const key of ["ArrowDown", "Home", "End", " ", "Enter"]) {
      expect(controlOwnsKey(select, key), key).toBe(true);
    }
    expect(controlOwnsKey(select, "Delete")).toBe(false);
  });

  it("gives a slider its arrows and its ends", () => {
    // The timeline scrubber is a div with role=slider, so the role has to be
    // honoured and not just the tag.
    const scrubber = el('<div role="slider" tabindex="0"></div>');
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp"]) {
      expect(controlOwnsKey(scrubber, key), key).toBe(true);
    }
    expect(controlOwnsKey(scrubber, "Delete")).toBe(false);
  });

  it("honours a role on an element whose tag says nothing", () => {
    expect(controlOwnsKey(el('<div role="menuitem"></div>'), " ")).toBe(true);
    expect(controlOwnsKey(el('<div role="option"></div>'), "ArrowDown")).toBe(true);
    expect(controlOwnsKey(el('<span role="switch"></span>'), " ")).toBe(true);
  });

  it("leaves Space to a link, whose default is to scroll", () => {
    expect(controlOwnsKey(el('<a href="/dashboard">Projects</a>'), " ")).toBe(true);
    expect(controlOwnsKey(el("<a>not a link</a>"), " ")).toBe(false);
  });

  it("claims nothing for a plain element, so the shortcuts still work", () => {
    const div = el("<div></div>");
    for (const key of [" ", "ArrowLeft", "Delete", "Escape", "a"]) {
      expect(controlOwnsKey(div, key), key).toBe(false);
    }
  });

  it("is safe when there is no element at all", () => {
    expect(controlOwnsKey(null, " ")).toBe(false);
    expect(controlOwnsKey(document, " ")).toBe(false);
  });
});

describe("modalIsOpen", () => {
  it("is false with no dialog, and false for a dialog that is merely present", () => {
    expect(modalIsOpen(document)).toBe(false);
    el("<dialog></dialog>");
    expect(modalIsOpen(document)).toBe(false);
  });

  it("is true once a dialog is open, so Escape belongs to the dialog", () => {
    el("<dialog open></dialog>");
    expect(modalIsOpen(document)).toBe(true);
  });
});
