"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormNotice, Input } from "@/components/ui/field";

import { updateProfileAction, type ProfileFormState } from "./actions";

const EMPTY: ProfileFormState = {};

export function ProfileForm({
  displayName,
  email,
}: {
  displayName: string | null;
  email: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <FormNotice>{state.notice}</FormNotice>

      <Field label="Name" error={state.fieldErrors?.displayName}>
        {(props) => (
          <Input {...props} name="displayName" defaultValue={displayName ?? ""} maxLength={80} required />
        )}
      </Field>

      <Field label="Email" hint="Changing your email is not available yet.">
        {(props) => <Input {...props} value={email ?? ""} readOnly disabled />}
      </Field>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}
