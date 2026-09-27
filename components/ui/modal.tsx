"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A modal built on the native `<dialog>` element, which gives focus trapping,
 * Escape to close, and the top layer for free -- all of which are easy to get
 * subtly wrong by hand, and all of which matter for a destructive confirmation.
 *
 * Clicking the backdrop closes it: the backdrop is the dialog element itself, so
 * a click whose target is the dialog rather than its contents came from outside.
 *
 * Two things the element does not do for us:
 *
 * - It takes no name from the heading inside it, so a screen reader announces a
 *   bare "dialog". `aria-labelledby` points it at the title.
 * - Its focus restoration returns focus to whatever was focused when it opened.
 *   That is the right rule, but it fails here, because these dialogs are opened
 *   from a menu item that unmounts as the dialog mounts -- so focus would land
 *   on `<body>` and a keyboard user would be dropped back to the top of the
 *   page. `returnFocusTo` names an element that still exists on close.
 *
 * The restore runs on unmount rather than on the element's `close` event,
 * because a Cancel button calls `onClose` directly and never closes the dialog
 * -- so a `close`-based restore would fire for Escape and the backdrop but not
 * for the button most people actually press. Unmounting is the one thing every
 * way out of this dialog has in common.
 */
export function Modal({
  title,
  onClose,
  returnFocusTo,
  className,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Focused after the dialog closes, for when the opener does not outlive it. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // `returnFocusTo` is read at cleanup time, so a ref that only settles after
  // mount is still the right element by the time this runs.
  useEffect(
    () => () => {
      returnFocusTo?.current?.focus();
    },
    [returnFocusTo],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className={cn(
        "m-auto rounded-panel border border-line bg-panel p-0 text-paper backdrop:bg-black/60",
        className ?? "w-[min(26rem,calc(100vw-2rem))]",
      )}
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
