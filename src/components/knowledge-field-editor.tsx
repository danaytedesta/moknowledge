"use client";

import { useId } from "react";
import KnowledgeFieldHeading from "@/components/knowledge-field-heading";
import type { KnowledgeField } from "@/types/knowledge";

interface FieldEditorProps {
  label: string;
  field: KnowledgeField<string>;
  onChange: (field: KnowledgeField<string>) => void;
  multiline?: boolean;
  placeholder?: string;
  showConfirmation?: boolean;
}

export default function KnowledgeFieldEditor({
  label,
  field,
  onChange,
  multiline = false,
  placeholder = "Add if known",
  showConfirmation = true,
}: FieldEditorProps) {
  // Generate a unique ID to connect the label and input.
  const id = useId();

  const hasValue = Boolean(field.value?.trim());

  const inputStyle =
    "mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-4 py-3 text-[#3F352E] outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20";

  function updateValue(value: string) {
    onChange({
      ...field,
      value: value === "" ? null : value,

      // A changed value needs confirmation again.
      confirmedAt: null,
      origin: "owner",
      updatedAt: new Date().toISOString(),

      // Edited text is owner-entered; original evidence remains attached.
    });
  }

  function toggleConfirmation() {
    if (!hasValue) return;

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
        hasValue={hasValue}
        onConfirm={showConfirmation ? toggleConfirmation : undefined}
      />

      {multiline ? (
        <textarea
          id={id}
          value={field.value ?? ""}
          onChange={(event) => updateValue(event.target.value)}
          placeholder={placeholder}
          rows={4}
          maxLength={5000}
          className={`${inputStyle} resize-y`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={field.value ?? ""}
          onChange={(event) => updateValue(event.target.value)}
          placeholder={placeholder}
          maxLength={500}
          className={inputStyle}
        />
      )}
    </div>
  );
}
