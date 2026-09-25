import Link from "next/link";
import type { Metadata } from "next";

import { Panel } from "@/components/ui/panel";
import { signInAction } from "@/features/auth/actions";
import { SignInForm } from "@/features/auth/auth-form";
import { safeRedirectPath } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your MotioCode projects.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(
    typeof params.next === "string" ? params.next : undefined,
    "/dashboard",
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-[14px] text-mist">Pick up where you left off.</p>
      </div>

      {params.error === "link-expired" ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger-wash px-3 py-2 text-[13px] text-danger"
        >
          That link has already been used or has expired. Request a new one below.
        </p>
      ) : null}

      <Panel className="p-5">
        <SignInForm action={signInAction} next={next} />
        <p className="mt-4 text-right text-[13px]">
          <Link href="/forgot-password" className="text-mist hover:text-paper">
            Forgot your password?
          </Link>
        </p>
      </Panel>

      <p className="text-center text-[13px] text-mist">
        New to MotioCode?{" "}
        <Link href="/signup" className="text-amber hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
