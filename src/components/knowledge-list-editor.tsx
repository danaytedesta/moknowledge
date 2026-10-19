"use client";

import { useId, useState } from "react";
import KnowledgeFieldHeading from "@/components/knowledge-field-heading";
import type { KnowledgeField } from "@/types/knowledge";

interface KnowledgeListEditorProps {
  label: string;
  field: KnowledgeField<string[]>;
  onChange: (field: KnowledgeField<string[]>) => void;
}

export default function KnowledgeListEditor({
  label,
  field,
  onChange,
}: KnowledgeListEditorProps) {
  const id = useId();

  // Keep unfinished typing separate from the saved list.
  const [draft, setDraft] = useState("");

  const items = field.value ?? [];

  function updateItems(values: string[]) {
    onChange({
      ...field,
      value: values.length > 0 ? values : null,

      // A changed list needs review again.
      confirmedAt: null,
      origin: "owner",
      updatedAt: new Date().toISOString(),

      // Preserve original source evidence.
    });
  }

  function addItem() {
    const value = draft.trim();

    if (!value) return;

    // Prevent duplicates that differ only in capitalization.
    const alreadyExists = items.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    );

    if (!alreadyExists) {
      updateItems([...items, value]);
    }

    setDraft("");
  }

  function toggleConfirmation() {
    if (items.length === 0) return;

    const now = new Date().toISOString();

    onChange({
      ...field,
      confirmedAt: field.confirmedAt ? null : now,
      updatedAt: now,
    });
  }

  return (
    <div>
      <KnowledgeFieldHeading
        label={label}
        inputId={id}
        field={field}
        hasValue={items.length > 0}
        onConfirm={toggleConfirmation}
      />

      {/* Show each item with its own removal control. */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex items-start justify-between gap-3 rounded-lg bg-[#F2EDE6] px-3 py-2"
            >
              <span className="min-w-0 break-words text-[#695B4F]">{item}</span>

              <button
                type="button"
                onClick={() =>
                  updateItems(items.filter((_, position) => position !== index))
                }
                aria-label={`Remove ${item} from ${label}`}
                className="shrink-0 rounded px-1 text-sm text-[#843E2D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#705747]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={draft}
          maxLength={300}
          placeholder="Add one item"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the item without submitting another form.
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addItem();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20"
        />

        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="rounded-lg border border-[#CEC3B7] px-4 py-2 text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#705747] disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {draft.trim() && (
        <p className="mt-2 text-sm text-[#756D66]">
          Use Add to include this item in your profile.
        </p>
      )}
    </div>
  );
}
