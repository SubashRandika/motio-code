"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

import { deleteProjectAction, renameProjectAction, type ActionState } from "./actions";

const EMPTY: ActionState = {};

export function ProjectSettingsForm({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, formAction] = useActionState(renameProjectAction, EMPTY);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="projectId" value={projectId} />

        <Field label="Project name" error={state.fieldErrors?.name}>
          {(props) => (
            <Input {...props} name="name" defaultValue={projectName} maxLength={120} required />
          )}
        </Field>

        <div className="flex justify-end">
          <SaveButton />
        </div>
      </form>

      <div className="border-t border-line pt-5">
        <h2 className="text-[13px] font-medium text-danger">Delete this project</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-mist">
          The project and every scene in it will be removed. This cannot be undone.
        </p>

        {confirming ? (
          <form
            action={async () => {
              await deleteProjectAction(projectId);
              router.push("/dashboard");
            }}
            className="mt-4 flex items-center gap-2"
          >
            <span className="text-[13px] text-paper">Delete {projectName}?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <DeleteButton />
          </form>
        ) : (
          <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirming(true)}>
            Delete project
          </Button>
        )}
      </div>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save name"}
    </Button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "Deleting…" : "Yes, delete it"}
    </Button>
  );
}
