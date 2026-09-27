"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A user's picture, with their initial underneath.
 *
 * The initial is not a fallback that replaces the image -- it is always
 * rendered, and the image sits on top of it. That ordering does the work:
 *
 * - Most addresses have no Gravatar, so the request 404s. There is no state to
 *   unwind and nothing to swap, because what is left is what was already there.
 * - No layout shift and no flash of empty circle while the image loads, which a
 *   swap-on-error fallback always has.
 * - If Gravatar is slow, blocked, or down, the header still shows something
 *   correct rather than a broken-image glyph.
 *
 * `onError` only hides the image element, and is what makes a 404 quiet.
 */
export function Avatar({
  src,
  initial,
  label,
  className,
}: {
  /** The picture to try, or null to show the initial alone. */
  src: string | null;
  initial: string;
  /** Who this is, for a screen reader. The picture itself is decorative. */
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-raised text-[12px] font-medium text-mist",
        className,
      )}
    >
      {/* Hidden from assistive tech: the identity is announced once, below, and
          hearing the letter as well would just be noise. */}
      <span aria-hidden="true">{initial}</span>

      {src && !failed ? (
        <Image
          src={src}
          // Empty alt, not the user's name: the name is already announced by the
          // sr-only text, and a described image beside identical text is read twice.
          alt=""
          width={32}
          height={32}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}

      {/* Without this the header says nothing about who is signed in -- the
          avatar was the only indicator, and it was decorative. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}
