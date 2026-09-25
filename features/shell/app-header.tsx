import Link from "next/link";

import { LogoLink } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import type { SessionUser } from "@/features/auth/session";

const NAV = [
  { href: "/dashboard", label: "Projects" },
  { href: "/settings/profile", label: "Profile" },
] as const;

export function AppHeader({ user }: { user: SessionUser }) {
  const initial = (user.displayName ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <header className="border-b border-line bg-ink">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <LogoLink href="/dashboard" />

        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-mist transition-colors hover:bg-raised hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ButtonLink href="/projects/new" size="sm">
            New project
          </ButtonLink>

          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full border border-line bg-raised text-[12px] font-medium text-mist"
          >
            {initial}
          </span>

          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
