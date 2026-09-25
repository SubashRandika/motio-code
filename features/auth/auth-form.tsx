"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormNotice, Input } from "@/components/ui/field";
import type { AuthFormState } from "@/features/auth/actions";

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const EMPTY: AuthFormState = {};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SignUpForm({ action }: { action: AuthAction }) {
  const [state, formAction] = useActionState(action, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <FormNotice>{state.notice}</FormNotice>

      <Field label="Name" error={state.fieldErrors?.displayName}>
        {(props) => (
          <Input
            {...props}
            name="displayName"
            autoComplete="name"
            placeholder="Ada Lovelace"
            required
          />
        )}
      </Field>

      <Field label="Email" error={state.fieldErrors?.email}>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        )}
      </Field>

      <Field
        label="Password"
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      >
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <SubmitButton label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}

export function SignInForm({ action, next }: { action: AuthAction; next?: string }) {
  const [state, formAction] = useActionState(action, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email" error={state.fieldErrors?.email}>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        )}
      </Field>

      <Field label="Password" error={state.fieldErrors?.password}>
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>

      <SubmitButton label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: AuthAction }) {
  const [state, formAction] = useActionState(action, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormNotice>{state.notice}</FormNotice>

      <Field label="Email" error={state.fieldErrors?.email}>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        )}
      </Field>

      <SubmitButton label="Send reset link" pendingLabel="Sending…" />
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: AuthAction }) {
  const [state, formAction] = useActionState(action, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>

      <Field label="New password" hint="At least 8 characters." error={state.fieldErrors?.password}>
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="new-password" required />
        )}
      </Field>

      <Field label="Confirm new password" error={state.fieldErrors?.confirmPassword}>
        {(props) => (
          <Input
            {...props}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <SubmitButton label="Save password" pendingLabel="Saving…" />
    </form>
  );
}
