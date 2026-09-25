import type { Metadata } from "next";

import { Panel } from "@/components/ui/panel";
import { updatePasswordAction } from "@/features/auth/actions";
import { ResetPasswordForm } from "@/features/auth/auth-form";
import { requireUser } from "@/features/auth/session";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function ResetPasswordPage() {
  // Reaching this page means the recovery link produced a session.
  await requireUser("/reset-password");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1.5 text-[14px] text-mist">
          Choose a password you have not used elsewhere.
        </p>
      </div>

      <Panel className="p-5">
        <ResetPasswordForm action={updatePasswordAction} />
      </Panel>
    </div>
  );
}
