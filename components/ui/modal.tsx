"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A modal built on the native `<dialog>` element, which gives focus trapping,
 * Escape to close, and the top layer for free -- all of which are easy to get
 * subtly wrong by hand, and all of which matter for a destructive confirmation.
 *
 * Clicking the backdrop closes it: the backdrop is the dialog element itself, so
 * a click whose target is the dialog rather than its contents came from outside.
 */
export function Modal({
  title,
  onClose,
  className,
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
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
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
