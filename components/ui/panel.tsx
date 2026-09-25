import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-panel border border-line bg-panel", className)} {...props} />;
}

/**
 * A small label above a heading. Reserved for text that carries real
 * information about what follows, not decoration.
 */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("tabular text-[11px] tracking-[0.16em] text-mist-dim uppercase", className)}
      {...props}
    />
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-mist">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-md text-[14px] leading-relaxed text-mist">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Panel>
  );
}
