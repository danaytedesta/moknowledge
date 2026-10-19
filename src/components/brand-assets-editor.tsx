"use client";

import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import type { KnowledgeBase, KnowledgeField } from "@/types/knowledge";

type AssetKey = "colors" | "fonts" | "logoUrls";

interface BrandAssetsEditorProps {
  branding: KnowledgeBase["branding"];
  onChange: (branding: KnowledgeBase["branding"]) => void;
}

export default function BrandAssetsEditor({
  branding,
  onChange,
}: BrandAssetsEditorProps) {
  const groups: { key: AssetKey; label: string }[] = [
    { key: "colors", label: "Colors — hex values" },
    { key: "fonts", label: "Fonts — published font stacks" },
    { key: "logoUrls", label: "Logo images" },
  ];

  function updateItem(
    key: AssetKey,
    index: number,
    field: KnowledgeField<string>,
  ) {
    onChange({
      ...branding,
      [key]: branding[key].map((item, position) =>
        position === index ? field : item,
      ),
    });
  }

  function addItem(key: AssetKey) {
    // Owner-added values start empty and unconfirmed.
    const field: KnowledgeField<string> = {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: new Date().toISOString(),
    };

    onChange({
      ...branding,
      [key]: [...branding[key], field],
    });
  }

  function removeItem(key: AssetKey, index: number) {
    onChange({
      ...branding,
      [key]: branding[key].filter((_, position) => position !== index),
    });
  }

  const buttonStyle =
    "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

  return (
    <section className="kb-group">
      <h4 className="kb-group-title">Your brand’s look</h4>

      <p className="mt-3 text-sm leading-relaxed text-[#756D66]">
        Review colors, fonts, and logo images found on your website. All are
        saved with your profile; only confirmed choices appear in the content
        brief.
      </p>

      <div className="mt-5 space-y-6">
        {groups.map((group) => (
          <details key={group.key} className="kb-optional">
            <summary className="cursor-pointer rounded font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]">
              {group.label} ({branding[group.key].length})
            </summary>

            {branding[group.key].length === 0 && (
              <p className="mt-3 text-sm text-[#756D66]">
                No candidates found in the HTML we read.
              </p>
            )}

            {branding[group.key].map((field, index) => (
              <div
                key={index}
                className="mt-5 space-y-2 border-b border-[#E8E0D6] pb-5"
              >
                <KnowledgeFieldEditor
                  label={`${group.label} ${index + 1}`}
                  field={field}
                  onChange={(updated) => updateItem(group.key, index, updated)}
                />

                <button
                  type="button"
                  onClick={() => removeItem(group.key, index)}
                  aria-label={`Remove ${group.label} ${index + 1}`}
                  className={buttonStyle}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addItem(group.key)}
              className={`${buttonStyle} mt-3`}
            >
              Add item
            </button>
          </details>
        ))}
      </div>
    </section>
  );
}
