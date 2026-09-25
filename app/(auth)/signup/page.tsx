import Link from "next/link";
import type { Metadata } from "next";

import { Panel } from "@/components/ui/panel";
import { signUpAction } from "@/features/auth/actions";
import { SignUpForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Start building animated technical explanations with MotioCode.",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-1.5 text-[14px] text-mist">
          Free while MotioCode is in development.
        </p>
      </div>

      <Panel className="p-5">
        <SignUpForm action={signUpAction} />
      </Panel>

      <p className="text-center text-[13px] text-mist">
        Already have an account?{" "}
        <Link href="/login" className="text-amber hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
