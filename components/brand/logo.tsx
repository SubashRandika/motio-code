import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The mark is a composition frame with a playhead parked inside it: the two
 * things every MotioCode project is made of.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <rect
        x="1.75"
        y="4.75"
        width="20.5"
        height="14.5"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <path d="M13 3.5 L13 20.5" stroke="var(--color-amber)" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M10.4 3.6 L15.6 3.6 L13 6.6 Z" fill="var(--color-amber)" />
      <path d="M5.5 10.5 L8 12 L5.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[17px] leading-none font-semibold tracking-tight", className)}>
      Motio<span className="text-amber">Code</span>
    </span>
  );
}

export function LogoLink({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-paper", className)}
      aria-label="MotioCode home"
    >
      <LogoMark />
      <Wordmark />
    </Link>
  );
}
