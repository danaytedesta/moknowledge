"use client";

import { useId, useState } from "react";
import type { KnowledgeField } from "@/types/knowledge";

// One compact label row keeps provenance and confirmation consistent.
// Showing a source never changes or approves the value.
export default function KnowledgeFieldHeading<T>({
  label,
  inputId,
  field,
  hasValue,
  onConfirm,
}: {
  label: string;
  inputId: string;
  field: KnowledgeField<T>;
  hasValue: boolean;
  onConfirm?: () => void;
}) {
  const evidenceId = useId();
  const [showEvidence, setShowEvidence] = useState(false);
  const status = field.confirmedAt
    ? "You confirmed"
    : field.origin === "extracted"
      ? "From website"
      : field.origin === "inferred"
        ? "Suggested"
        : field.origin === "measured"
          ? "Measured"
          : null;

  return (
    <>
      <div className="kb-field-heading">
        <label htmlFor={inputId} className="font-bold">
          {label}
        </label>
        <div className="kb-field-tools">
          {hasValue && status && (
            <span
              className={`kb-status ${field.confirmedAt ? "kb-status-confirmed" : ""}`}
            >
              {field.confirmedAt ? "✓ " : ""}
              {status}
            </span>
          )}
          {hasValue && onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              aria-pressed={Boolean(field.confirmedAt)}
              aria-label={`${field.confirmedAt ? "Remove confirmation for" : "Confirm"} ${label}`}
              className="kb-text-button"
            >
              {field.confirmedAt ? "Remove confirmation" : "Looks right"}
            </button>
          )}
          {field.evidence.length > 0 && (
            <button
              type="button"
              className="kb-text-button"
              aria-expanded={showEvidence}
              aria-controls={evidenceId}
              aria-label={`Original evidence for ${label}`}
              onClick={() => setShowEvidence(!showEvidence)}
            >
              {showEvidence ? "Hide source" : "See source"}
            </button>
          )}
        </div>
      </div>
      {field.evidence.length > 0 && (
        <div id={evidenceId} hidden={!showEvidence} className="kb-evidence">
          <p className="kb-eyebrow">Original evidence</p>
          {field.evidence.map((evidence, index) => (
            <blockquote key={`${evidence.sourceUrl}-${index}`} className="mt-3">
              <p className="break-words leading-relaxed">{evidence.snippet}</p>
              <cite className="mt-2 block break-all text-sm not-italic">
                {evidence.sourceUrl}
              </cite>
            </blockquote>
          ))}
        </div>
      )}
    </>
  );
}
