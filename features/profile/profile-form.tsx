"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormNotice, Input, Label } from "@/components/ui/field";

import { updateProfileAction, type ProfileFormState } from "./actions";

const EMPTY: ProfileFormState = {};

export function ProfileForm({
  displayName,
  email,
  useGravatar,
  hasUpload,
}: {
  displayName: string | null;
  email: string | null;
  useGravatar: boolean;
  /** An uploaded picture wins, which changes what the toggle actually does. */
  hasUpload: boolean;
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

      <GravatarToggle defaultChecked={useGravatar} hasUpload={hasUpload} />

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

/**
 * Gravatar is a lookup against a third party, keyed on a hash of the user's
 * email address. The copy says so plainly rather than calling it "personalise
 * your profile": someone deciding whether to allow it needs to know who is
 * being asked and what is being sent, and it is a short enough sentence to say.
 */
function GravatarToggle({
  defaultChecked,
  hasUpload,
}: {
  defaultChecked: boolean;
  hasUpload: boolean;
}) {
  const describedBy = "gravatar-description";

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-ink-sunk px-3 py-3">
      <div className="flex items-start gap-2.5">
        <input
          id="useGravatar"
          name="useGravatar"
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-describedby={describedBy}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-amber)]"
        />
        <Label htmlFor="useGravatar" className="text-paper">
          Use my Gravatar when I have not uploaded a picture
        </Label>
      </div>

      <p id={describedBy} className="pl-[26px] text-[12px] leading-relaxed text-mist-dim">
        Gravatar is a service that maps an email address to a picture. Your address is never
        sent — only a one-way hash of it — and the request is made by MotioCode rather than
        your browser, so Gravatar never sees your IP address. Turn this off and no request is
        made at all.
        {hasUpload ? " You have uploaded a picture, so this has no effect right now." : ""}
      </p>
    </div>
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
