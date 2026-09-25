"use client";

import {
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Square,
  Type,
  Unlock,
} from "lucide-react";

import { ELEMENT_LABELS, type ElementType } from "@/core/model";
import { cn } from "@/lib/utils/cn";

import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";

const ELEMENT_ICONS: Record<ElementType, typeof Type> = {
  text: Type,
  shape: Square,
  code: Code2,
  callout: MessageSquare,
  image: ImageIcon,
};

const RAIL_ORDER: ElementType[] = ["text", "code", "shape", "callout", "image"];

export function ElementRail() {
  const addElement = useEditorStore((state) => state.addElement);

  return (
    <div className="flex flex-col">
      <h2 className="px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
        Add
      </h2>

      <div className="grid grid-cols-3 gap-1.5 px-2 pb-3">
        {RAIL_ORDER.map((type) => {
          const Icon = ELEMENT_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => addElement(type)}
              className="flex flex-col items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-2.5 text-[11px] text-mist transition-colors hover:border-line-strong hover:text-paper"
            >
              <Icon className="size-4" aria-hidden="true" />
              {ELEMENT_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LayerList() {
  const scene = useEditorStore(selectActiveScene);
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds);
  const selectElement = useEditorStore((state) => state.selectElement);
  const updateElement = useEditorStore((state) => state.updateElement);
  const reorderElement = useEditorStore((state) => state.reorderElement);

  // Top of the list is the top of the stack, which is how layers read.
  const elements = [...(scene?.data.elements ?? [])].sort((a, b) => b.layer - a.layer);

  return (
    <div className="flex flex-col">
      <h2 className="px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
        Layers
      </h2>

      {elements.length === 0 ? (
        <p className="px-3 pb-3 text-[12px] leading-relaxed text-mist-dim">
          Nothing in this scene yet.
        </p>
      ) : (
        <ul className="space-y-0.5 px-2 pb-3">
          {elements.map((element, index) => {
            const selected = selectedElementIds.includes(element.id);
            const Icon = ELEMENT_ICONS[element.type];

            return (
              <li
                key={element.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md border px-1.5 transition-colors",
                  selected
                    ? "border-amber/50 bg-amber-wash"
                    : "border-transparent hover:border-line hover:bg-raised",
                )}
              >
                <button
                  type="button"
                  onClick={(event) =>
                    selectElement(element.id, { additive: event.shiftKey || event.metaKey })
                  }
                  aria-current={selected ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                >
                  <Icon
                    className={cn("size-3.5 shrink-0", selected ? "text-amber" : "text-mist-dim")}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "truncate text-[12.5px]",
                      element.hidden ? "text-mist-dim line-through" : "text-paper",
                    )}
                  >
                    {element.name}
                  </span>
                </button>

                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <LayerAction
                    label={`Move ${element.name} up`}
                    disabled={index === 0}
                    onClick={() => reorderElement(element.id, "forward")}
                  >
                    <ChevronUp className="size-3" />
                  </LayerAction>
                  <LayerAction
                    label={`Move ${element.name} down`}
                    disabled={index === elements.length - 1}
                    onClick={() => reorderElement(element.id, "backward")}
                  >
                    <ChevronDown className="size-3" />
                  </LayerAction>
                  <LayerAction
                    label={element.hidden ? `Show ${element.name}` : `Hide ${element.name}`}
                    onClick={() =>
                      updateElement(element.id, (item) => ({ ...item, hidden: !item.hidden }), {
                        label: element.hidden ? "Show element" : "Hide element",
                      })
                    }
                  >
                    {element.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  </LayerAction>
                  <LayerAction
                    label={element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`}
                    onClick={() =>
                      updateElement(element.id, (item) => ({ ...item, locked: !item.locked }), {
                        label: element.locked ? "Unlock element" : "Lock element",
                      })
                    }
                  >
                    {element.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                  </LayerAction>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LayerAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-6 place-items-center rounded text-mist transition-colors hover:bg-line hover:text-paper disabled:opacity-30"
    >
      {children}
    </button>
  );
}
