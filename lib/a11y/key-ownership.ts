/**
 * Whether the focused control already means something by this key.
 *
 * The editor listens for keys on `window`, which is the only way a canvas
 * shortcut can work when nothing in particular is focused. The cost is that the
 * handler also hears keys meant for whatever *is* focused, and a
 * `preventDefault()` there does not merely duplicate the action -- it cancels
 * it. Space on a focused `<button>` is the clearest case: the browser activates
 * a button on Space, so a global "Space toggles playback" that prevents the
 * default leaves a keyboard user unable to press any button in the toolbar,
 * while a mouse user never notices.
 *
 * So before acting on a bare key, ask whether the focused element owns it. This
 * is deliberately generous: a shortcut that silently fails to fire is a small
 * annoyance, whereas a shortcut that eats a control's own key makes the control
 * unusable without a pointer.
 *
 * Modifier shortcuts (⌘S, ⌘Z) are not routed through here -- they are chords no
 * native control claims, and they should work wherever focus happens to be.
 */

/** Text-entry inputs, where every printable key and every caret key belongs to the field. */
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/** Roles whose activation key is Space, exactly as a button's is. */
const SPACE_ACTIVATED_ROLES = new Set([
  "button",
  "checkbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "switch",
  "tab",
  "treeitem",
]);

/** Roles that navigate with the arrow keys. */
const ARROW_NAVIGATED_ROLES = new Set([
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "option",
  "radio",
  "radiogroup",
  "slider",
  "spinbutton",
  "tab",
  "tablist",
  "tree",
  "treeitem",
]);

const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const EDGE_KEYS = new Set(["Home", "End", "PageUp", "PageDown"]);

function isTextEntry(element: HTMLElement): boolean {
  // The attribute as well as the property: `isContentEditable` is a computed
  // value that depends on the element being rendered, so it is unreliable
  // outside a real browser and the attribute is the more honest signal.
  if (element.isContentEditable) return true;
  const editable = element.getAttribute("contenteditable");
  if (editable !== null && editable !== "false") return true;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName !== "INPUT") return false;

  const type = (element as HTMLInputElement).type.toLowerCase();
  return TEXT_INPUT_TYPES.has(type);
}

export function controlOwnsKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  const role = target.getAttribute("role") ?? "";
  const type = tag === "INPUT" ? (target as HTMLInputElement).type.toLowerCase() : "";

  // A text field owns the lot: printable characters, the caret keys, and the
  // two keys that delete around the caret.
  if (isTextEntry(target)) return true;

  // A select owns the keys that move through and open its options.
  if (tag === "SELECT") {
    return ARROW_KEYS.has(key) || EDGE_KEYS.has(key) || key === " " || key === "Enter";
  }

  // A range input and anything advertising itself as a slider or spinbutton
  // moves by arrow, and jumps by Home/End.
  if (type === "range" || role === "slider" || role === "spinbutton") {
    return ARROW_KEYS.has(key) || EDGE_KEYS.has(key);
  }

  // Space activates a button, a checkbox, a summary, a link acting as a button,
  // and every role listed above. Enter does too, but nothing here binds Enter.
  const spaceActivated =
    tag === "BUTTON" ||
    tag === "SUMMARY" ||
    type === "checkbox" ||
    type === "radio" ||
    type === "color" ||
    type === "file" ||
    SPACE_ACTIVATED_ROLES.has(role);

  if (key === " " && spaceActivated) return true;

  // A link is activated by Enter, not Space -- but browsers still scroll on
  // Space, and taking that away from a focused link is its own small trap.
  if (key === " " && tag === "A" && target.hasAttribute("href")) return true;

  if ((ARROW_KEYS.has(key) || EDGE_KEYS.has(key)) && ARROW_NAVIGATED_ROLES.has(role)) return true;

  // Radios are an arrow-navigated group even without an explicit role.
  if (ARROW_KEYS.has(key) && type === "radio") return true;

  return false;
}

/**
 * True while a modal dialog is open.
 *
 * Escape belongs to the dialog then. Without this, closing the preview also
 * clears the canvas selection, because both are listening for the same key and
 * the dialog's own handler does not stop it reaching `window`.
 */
export function modalIsOpen(doc: Document = document): boolean {
  return doc.querySelector("dialog[open]") !== null;
}
