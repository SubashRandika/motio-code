import { ButtonLink } from "@/components/ui/button";
import { LogoLink } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <LogoLink />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <p className="tabular text-[11px] tracking-[0.18em] text-mist-dim uppercase">404</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page is not here</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-mist">
            The link may be out of date, or the project may belong to another account.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/dashboard">Go to your projects</ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
