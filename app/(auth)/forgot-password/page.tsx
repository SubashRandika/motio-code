import Link from "next/link";
import type { Metadata } from "next";

import { Panel } from "@/components/ui/panel";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { ForgotPasswordForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-[14px] text-mist">
          Enter your email and we will send a link to set a new one.
        </p>
      </div>

      <Panel className="p-5">
        <ForgotPasswordForm action={requestPasswordResetAction} />
      </Panel>

      <p className="text-center text-[13px] text-mist">
        <Link href="/login" className="text-amber underline decoration-amber/40 underline-offset-2 hover:decoration-amber">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
