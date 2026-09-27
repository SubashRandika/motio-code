"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Which item to land on once the menu has rendered: ArrowUp on the trigger is
  // expected to open the menu at the *bottom* of the list.
  const [landOn, setLandOn] = useState<"first" | "last">("first");

  /**
   * The items, read from the DOM rather than collected through refs.
   *
   * One of them is a submit button inside a form and another may be disabled
   * while a duplication is in flight, so the live DOM is the only description of
   * the list that is never out of date -- and a disabled item must not be a
   * stop, or the arrow keys would appear to hang.
   */
  const items = useCallback(
    () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      ),
    [],
  );

  const focusItem = useCallback(
    (index: number) => {
      const list = items();
      if (list.length === 0) return;
      list[((index % list.length) + list.length) % list.length]?.focus();
    },
    [items],
  );

  /**
   * Closing returns focus to the trigger. Without that, focus would be sitting
   * on an item that is about to unmount, and the browser resets it to `<body>`
   * -- dropping a keyboard user at the top of the dashboard with no idea which
   * project they had been on.
   */
  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // A menu is expected to take focus when it opens, so the arrow keys have
  // somewhere to start from.
  useEffect(() => {
    if (!open) return;
    focusItem(landOn === "last" ? -1 : 0);
  }, [open, landOn, focusItem]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      // A click elsewhere is already moving focus; pulling it back to the
      // trigger would fight the user.
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${projectName}`}
        onClick={() => {
          setLandOn("first");
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setLandOn(event.key === "ArrowUp" ? "last" : "first");
          setOpen(true);
        }}
        className="grid size-8 place-items-center rounded-md text-mist transition-colors hover:bg-raised hover:text-paper"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${projectName}`}
          onKeyDown={(event) => {
            const list = items();
            const index = list.indexOf(document.activeElement as HTMLElement);

            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }

            // Tab leaves the menu entirely, which is what a menu is meant to do
            // -- so close it and let the browser move focus on its own.
            if (event.key === "Tab") {
              close(false);
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(index + 1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(index - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusItem(0);
            } else if (event.key === "End") {
              event.preventDefault();
              focusItem(-1);
            }
          }}
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-line bg-raised py-1 shadow-lg shadow-black/40"
        >
          <MenuItem
            icon={<Pencil className="size-3.5" />}
            label="Rename"
            onClick={() => {
              close(false);
              setDialog("rename");
            }}
          />
          <form
            action={async () => {
              close();
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
              close(false);
              setDialog("delete");
            }}
          />
        </div>
      ) : null}

      {dialog === "rename" ? (
        <RenameDialog
          projectId={projectId}
          projectName={projectName}
          returnFocusTo={triggerRef}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === "delete" ? (
        <DeleteDialog
          projectName={projectName}
          remove={remove}
          returnFocusTo={triggerRef}
          onClose={() => setDialog(null)}
        />
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
  returnFocusTo,
  onClose,
}: {
  projectId: string;
  projectName: string;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(renameProjectAction, EMPTY);

  useEffect(() => {
    if (state === EMPTY) return;
    if (!state.error && !state.fieldErrors) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Rename project" onClose={onClose} returnFocusTo={returnFocusTo}>
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
  returnFocusTo,
  onClose,
}: {
  projectName: string;
  remove: () => Promise<void>;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  return (
    <Modal title="Delete project" onClose={onClose} returnFocusTo={returnFocusTo}>
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
