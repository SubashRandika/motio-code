"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

import { renameProjectAction, type ActionState } from "./actions";

const EMPTY: ActionState = {};

type Dialog = "rename" | "delete" | null;

interface ProjectMenuProps {
  projectId: string;
  projectName: string;
  duplicate: () => Promise<void>;
  remove: () => Promise<void>;
}

export function ProjectMenu({ projectId, projectName, duplicate, remove }: ProjectMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${projectName}`}
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 place-items-center rounded-md text-mist transition-colors hover:bg-raised hover:text-paper"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-line bg-raised py-1 shadow-lg shadow-black/40"
        >
          <MenuItem
            icon={<Pencil className="size-3.5" />}
            label="Rename"
            onClick={() => {
              setOpen(false);
              setDialog("rename");
            }}
          />
          <form
            action={async () => {
              setOpen(false);
              await duplicate();
            }}
          >
            <MenuSubmit icon={<Copy className="size-3.5" />} label="Duplicate" />
          </form>
          <MenuItem
            icon={<Trash2 className="size-3.5" />}
            label="Delete"
            tone="danger"
            onClick={() => {
              setOpen(false);
              setDialog("delete");
            }}
          />
        </div>
      ) : null}

      {dialog === "rename" ? (
        <RenameDialog
          projectId={projectId}
          projectName={projectName}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === "delete" ? (
        <DeleteDialog projectName={projectName} remove={remove} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-line ${
        tone === "danger" ? "text-danger" : "text-paper"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MenuSubmit({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      disabled={pending}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-paper transition-colors hover:bg-line disabled:opacity-50"
    >
      {icon}
      {pending ? "Duplicating…" : label}
    </button>
  );
}

function RenameDialog({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(renameProjectAction, EMPTY);

  useEffect(() => {
    if (state === EMPTY) return;
    if (!state.error && !state.fieldErrors) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Rename project" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="projectId" value={projectId} />

        <Field label="Project name" error={state.fieldErrors?.name}>
          {(props) => (
            <Input {...props} name="name" defaultValue={projectName} maxLength={120} required autoFocus />
          )}
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton label="Save name" pendingLabel="Saving…" />
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  projectName,
  remove,
  onClose,
}: {
  projectName: string;
  remove: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title="Delete project" onClose={onClose}>
      <p className="text-[14px] leading-relaxed text-mist">
        <span className="text-paper">{projectName}</span> and all of its scenes will be deleted.
        This cannot be undone.
      </p>

      <form action={remove} className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
        <DangerSubmit />
      </form>
    </Modal>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DangerSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Deleting…" : "Delete project"}
    </Button>
  );
}
