"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

/**
 * "What does this actually do?" for a property field.
 *
 * The panel is 288px wide and holds forty-odd controls, so the constraint is
 * that help must cost nothing when it is not wanted. Three choices follow from
 * that:
 *
 * **It goes in the dead space after the label.** Every label in this panel is
 * one or two words with an empty third of a row after it. An icon there fills
 * space that was already empty instead of competing with anything.
 *
 * **The popover is positioned fixed, not absolute.** The panel is a scroll
 * container, and a scroll container clips its children in both directions --
 * `overflow-y: auto` forces `overflow-x` to clip too. An absolutely positioned
 * tooltip would be readable next to `Duration` and sliced in half next to
 * `Height`, which sits in the right-hand column of a two-column row. Fixed
 * positioning leaves the container entirely, and the cost is that it does not
 * follow scrolling -- so it closes on scroll instead of drifting.
 *
 * **The text is wired to the input, not just to the tooltip.** This is the part
 * that matters most and is the easiest to skip: `aria-describedby` on the
 * control means a screen reader reads the explanation when the user lands on
 * the field. Without it they would have to discover a tooltip, tab to it, and
 * read it separately -- so the sighted hover and the assistive path would be
 * two different features, one of them much worse.
 *
 * Opens on hover and on focus, and stays open on click so it can be read at
 * length or used on a touch screen.
 */
/** Width of the popover, in pixels. Matches the inline width below. */
export const POPOVER_WIDTH = 224;
const EDGE_GAP = 8;

/**
 * Where the popover goes, given the trigger's box and the viewport.
 *
 * Pulled out as a pure function because it is the part that can be wrong in a
 * way nobody notices: the properties panel is docked to the right edge, so a
 * trigger in the right-hand column of a two-column row sits within a popover's
 * width of the edge, and an unclamped `left` puts half the text off screen.
 * jsdom has no layout, so this is the only place the geometry can be checked.
 */
export function placePopover(
  trigger: { bottom: number; left: number },
  viewportWidth: number,
): { top: number; left: number } {
  const maxLeft = viewportWidth - POPOVER_WIDTH - EDGE_GAP;
  return {
    top: trigger.bottom + 6,
    // `Math.max` last so a viewport too narrow for the popover pins it to the
    // left edge rather than pushing it off the other side.
    left: Math.max(EDGE_GAP, Math.min(trigger.left, maxLeft)),
  };
}

export function FieldHelp({ id, text }: { id: string; text: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // A stale position from the last time it opened is harmless: `place` runs
  // before anything sets these, so by the time the popover renders it has been
  // recomputed. Keeping it out of the open/closed condition is what lets the
  // effect below only add listeners instead of also clearing state.
  const open = hovered || pinned;

  const place = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    setPosition(placePopover(trigger.getBoundingClientRect(), window.innerWidth));
  }, []);

  const show = useCallback(() => {
    place();
    setHovered(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;

    // Fixed positioning does not follow the panel's scroll, so rather than let
    // the popover drift away from its field, it closes.
    const dismiss = () => {
      setHovered(false);
      setPinned(false);
    };

    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  useEffect(() => {
    if (!pinned) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Stops the editor's global Escape from also clearing the selection --
      // dismissing a tooltip should not cost the user what they had selected.
      event.stopPropagation();
      setPinned(false);
      setHovered(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setPinned(false);
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pinned]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        // Not `aria-describedby` on this button: the description belongs to the
        // field, and is attached there. This button only reveals it visually.
        aria-expanded={open}
        aria-controls={id}
        aria-label="What does this do?"
        onPointerEnter={show}
        onPointerLeave={() => setHovered(false)}
        onFocus={show}
        onBlur={() => setHovered(false)}
        onClick={() => {
          place();
          setPinned((value) => !value);
        }}
        className={cn(
          "grid size-5 place-items-center rounded-full transition-colors",
          open ? "text-amber" : "text-mist-dim hover:text-mist",
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>

      {open && position ? (
        <span
          role="tooltip"
          style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          className="fixed z-50 rounded-md border border-line-strong bg-raised px-2.5 py-2 text-[11.5px] leading-relaxed font-normal text-paper normal-case shadow-lg shadow-black/50"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A field's label, with its explanation attached.
 *
 * The hidden paragraph is the description itself. It is rendered whether or not
 * the tooltip is open, because `aria-describedby` on the control points at it
 * -- a description that only existed while a tooltip was visible would be
 * announced only to people who had already found the tooltip.
 */
export function FieldLabel({
  id,
  htmlFor,
  children,
  help,
}: {
  /** Id for the description element; the control references it. */
  id: string;
  htmlFor: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="flex min-h-5 items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      {help ? (
        <>
          <FieldHelp id={id} text={help} />
          <span id={id} className="sr-only">
            {help}
          </span>
        </>
      ) : null}
    </div>
  );
}
