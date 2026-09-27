"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * `border-edge` rather than `border-line`: a field's fill is nearly the same
 * luminance as the panel behind it, so the border is the only thing that says
 * "this is a control". See the token comment in globals.css.
 */
const CONTROL =
  "w-full rounded-md border border-edge bg-ink-sunk px-3 text-sm text-paper placeholder:text-mist-dim transition-colors duration-150 hover:border-mist-dim focus:border-amber disabled:opacity-50 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(CONTROL, "h-10 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[13px] font-medium text-mist", className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/**
 * Labels a control and wires up its description and error message. The render
 * prop hands back the ids so the control stays a plain element.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        ...(message ? { "aria-describedby": messageId } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {message ? (
        <p
          id={messageId}
          className={cn("text-[12px]", error ? "text-danger" : "text-mist-dim")}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error banner, for failures that do not belong to one field. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/40 bg-danger-wash px-3 py-2 text-[13px] text-danger"
    >
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-md border border-cyan-deep/40 bg-cyan-wash px-3 py-2 text-[13px] text-cyan">
      {children}
    </p>
  );
}
