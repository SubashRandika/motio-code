"use client";

import { useId } from "react";

import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

import { FieldLabel } from "./field-help";

/**
 * Every control takes an optional `help`. Wiring it here rather than at each
 * call site means the description is attached to the input with
 * `aria-describedby` the same way every time -- which is the part that is easy
 * to forget when each panel does its own.
 */

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 px-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>{children}</div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  help?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel id={helpId} htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  help?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel id={helpId} htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-describedby={help ? helpId : undefined}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className={cn("tabular", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-mist-dim">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  help?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel id={helpId} htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <Select
        id={id}
        value={value}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  allowNone,
  help,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  allowNone?: boolean;
  help?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel id={helpId} htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-describedby={help ? helpId : undefined}
          value={(value ?? "#000000").slice(0, 7)}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-edge bg-ink-sunk"
        />
        <span className="tabular flex-1 truncate text-[11.5px] text-mist-dim">
          {value ?? "none"}
        </span>
        {allowNone ? (
          <button
            type="button"
            onClick={() => onChange(value === null ? "#FFFFFF" : null)}
            className="rounded px-1.5 py-1 text-[11px] text-mist transition-colors hover:bg-raised hover:text-paper"
          >
            {value === null ? "set" : "clear"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel id={helpId} htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--color-amber)]"
      />
    </div>
  );
}
