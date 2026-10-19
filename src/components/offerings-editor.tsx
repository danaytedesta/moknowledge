"use client";

import { useId, useRef, useState } from "react";
import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import KnowledgeListEditor from "@/components/knowledge-list-editor";
import type {
  KnowledgeField,
  Offering,
  OfferingPriority,
  PriceType,
} from "@/types/knowledge";

interface OfferingsEditorProps {
  offerings: Offering[];
  onChange: (offerings: Offering[]) => void;
}

const buttonStyle =
  "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

const selectStyle =
  "mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-3 py-3 text-[#3F352E] outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20";

// Reuse the same metadata structure for every owner-added field.
function emptyField<T>(): KnowledgeField<T> {
  return {
    value: null,
    origin: "owner",
    evidence: [],
    confirmedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function OfferingEditor({
  offering,
  onChange,
  onRemove,
  isOpen,
  onToggle,
  position,
  total,
}: {
  offering: Offering;
  onChange: (offering: Offering) => void;
  onRemove: () => void;
  isOpen: boolean;
  onToggle: () => void;
  position: number;
  total: number;
}) {
  const id = useId();

  function updatePriority(priority: OfferingPriority) {
    const now = new Date();

    onChange({
      ...offering,
      marketing: {
        ...offering.marketing,
        priority,
        chosenAt: now.toISOString(),
        reviewAfter: new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    });
  }

  function updatePriceType(type: PriceType | null) {
    onChange({
      ...offering,
      pricing: {
        ...offering.pricing,
        type,

        // A changed pricing rule requires the wording to be reviewed again.
        text: {
          ...offering.pricing.text,
          confirmedAt: null,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  return (
    <article className={`kb-offering ${isOpen ? "kb-offering-open" : ""}`}>
      <button
        type="button"
        className="kb-offering-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${id}-body`}
      >
        <span className="min-w-0">
          <span className="block break-words font-bold">
            {offering.name.value || "New offering"}
          </span>
          <span className="mt-1 block text-sm text-[#756D66]">
            {
              {
                maintain: "Normal",
                push: "Promote more",
                pause: "Don’t promote",
                waitlist: "Waitlist only",
              }[offering.marketing.priority]
            }
            {" · "}
            {offering.name.confirmedAt ? "You confirmed" : "Needs a look"}
          </span>
        </span>
        <span className="shrink-0 text-sm text-[#705747]">
          {isOpen ? "Close −" : "Edit +"}
        </span>
      </button>
      {/* Keep the body mounted when closed, preserving unfinished list typing. */}
      <div id={`${id}-body`} hidden={!isOpen} className="kb-item-body">
        <p className="kb-eyebrow mb-6">
          Products and services · {position} of {total}
        </p>
        <section>
          <h4 className="kb-group-title">About this offering</h4>
          <div className="kb-fields">
            <KnowledgeFieldEditor
              label="Offering name"
              field={offering.name}
              onChange={(name) => onChange({ ...offering, name })}
            />

            <KnowledgeFieldEditor
              label="Description"
              field={offering.description}
              multiline
              onChange={(description) => onChange({ ...offering, description })}
            />
          </div>
        </section>
        <section className="kb-group">
          <h4 className="kb-group-title">How to market it</h4>
          <div className="kb-fields">
            <div>
              <label htmlFor={`${id}-priority`} className="block font-bold">
                How much to promote it
              </label>

              <select
                id={`${id}-priority`}
                value={offering.marketing.priority}
                onChange={(event) =>
                  updatePriority(event.target.value as OfferingPriority)
                }
                className={selectStyle}
              >
                <option value="maintain">Normal</option>
                <option value="push">Promote more</option>
                <option value="pause">Paused — don’t promote</option>
                <option value="waitlist">Waitlist only</option>
              </select>

              <p className="mt-2 text-sm text-[#756D66]">
                {offering.marketing.chosenAt
                  ? "This preference has a review date in 30 days."
                  : "Normal is the default. Choose what you want to promote."}
              </p>

              {!offering.marketing.chosenAt && (
                <button
                  type="button"
                  onClick={() => updatePriority(offering.marketing.priority)}
                  className={`${buttonStyle} mt-2`}
                >
                  Keep this priority
                </button>
              )}
            </div>

            <div>
              <label htmlFor={`${id}-price-type`} className="block font-bold">
                How should pricing be shown?
              </label>

              <select
                id={`${id}-price-type`}
                value={offering.pricing.type ?? ""}
                onChange={(event) =>
                  updatePriceType(
                    (event.target.value || null) as PriceType | null,
                  )
                }
                className={selectStyle}
              >
                <option value="">Not decided</option>
                <option value="fixed">Fixed price</option>
                <option value="starting_at">Starting at</option>
                <option value="quote_only">Quote required</option>
                <option value="hidden">Don’t show pricing</option>
              </select>
            </div>

            <KnowledgeFieldEditor
              label="Price wording"
              field={offering.pricing.text}
              placeholder="For example: $6 or Starting at $50"
              onChange={(text) =>
                onChange({
                  ...offering,
                  pricing: { ...offering.pricing, text },
                })
              }
            />

            <p className="text-sm text-[#756D66]">
              Prices appear in the brief only after you confirm the wording and
              choose a fixed or starting price.
            </p>
          </div>
        </section>
        <details className="kb-optional">
          <summary>
            More details <span className="kb-optional-tag">Optional</span>
          </summary>
          <div className="kb-fields">
            <KnowledgeFieldEditor
              label="Category"
              field={offering.category}
              placeholder="Optional category"
              onChange={(category) => onChange({ ...offering, category })}
            />

            {/* Features use the existing add/remove list control. */}
            <KnowledgeListEditor
              label="Features"
              field={offering.features}
              onChange={(features) => onChange({ ...offering, features })}
            />

            <div>
              <label htmlFor={`${id}-kind`} className="block font-bold">
                Product or service?
              </label>

              <select
                id={`${id}-kind`}
                value={offering.kind.value ?? ""}
                onChange={(event) => {
                  const value = event.target.value as
                    "product" | "service" | "other" | "";

                  const now = new Date().toISOString();

                  // Selecting a type records an explicit owner choice.
                  onChange({
                    ...offering,
                    kind: {
                      ...offering.kind,
                      value: value || null,
                      origin: "owner",
                      confirmedAt: value ? now : null,
                      updatedAt: now,
                    },
                  });
                }}
                className={selectStyle}
              >
                <option value="">Not specified</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </details>
        <div className="mt-7 border-t border-[#E8E0D6] pt-4">
          <button type="button" onClick={onRemove} className="kb-danger-button">
            Remove this offering
          </button>
        </div>
      </div>
    </article>
  );
}

export default function OfferingsEditor({
  offerings,
  onChange,
}: OfferingsEditorProps) {
  const [search, setSearch] = useState("");
  const [openOfferingId, setOpenOfferingId] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const listSummaryRef = useRef<HTMLParagraphElement>(null);

  function showLess() {
    // Collapse the visible list only. Every offering remains in the profile.
    setLimit(8);
    if (!filtered.slice(0, 8).some((item) => item.id === openOfferingId)) {
      setOpenOfferingId(null);
    }
    // The clicked button disappears, so return keyboard focus to the list.
    listSummaryRef.current?.focus({ preventScroll: true });
    listSummaryRef.current?.scrollIntoView?.({ block: "start" });
  }
  const filtered = offerings.filter((item) =>
    (item.name.value ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  function addOffering() {
    // Manual entries use exactly the same structure as scraped offerings.
    const offering: Offering = {
      id: crypto.randomUUID(),
      name: emptyField<string>(),
      description: emptyField<string>(),
      category: emptyField<string>(),
      kind: emptyField<"product" | "service" | "other">(),
      features: emptyField<string[]>(),
      marketing: {
        priority: "maintain",
        chosenAt: null,
        reviewAfter: null,
      },
      pricing: {
        type: null,
        text: emptyField<string>(),
      },
    };

    setSearch("");
    setLimit(offerings.length + 1);
    onChange([...offerings, offering]);
    setOpenOfferingId(offering.id);
  }

  return (
    <div>
      <p className="text-[#756D66]">
        Open an item to edit its details, pricing, or promotion settings. Remove
        suggestions that aren’t products or services.
      </p>

      {offerings.length > 8 && (
        <label className="mt-4 block text-sm">
          Find an offering
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(8);
            }}
            placeholder="Search products and services"
            className={selectStyle}
          />
        </label>
      )}
      <p
        ref={listSummaryRef}
        tabIndex={-1}
        role="status"
        className="kb-list-summary mt-3 text-sm text-[#756D66]"
      >
        Showing {Math.min(limit, filtered.length)} of {filtered.length} products
        and services
      </p>
      <div className="mt-5 space-y-3">
        {offerings.length === 0 && (
          <p className="text-[#756D66]">
            No offerings found. Add one if useful.
          </p>
        )}

        {filtered.slice(0, limit).map((offering, index) => (
          <OfferingEditor
            key={offering.id}
            offering={offering}
            isOpen={openOfferingId === offering.id}
            onToggle={() =>
              setOpenOfferingId(
                openOfferingId === offering.id ? null : offering.id,
              )
            }
            position={index + 1}
            total={filtered.length}
            onChange={(updated) =>
              onChange(
                offerings.map((item) =>
                  item.id === offering.id ? updated : item,
                ),
              )
            }
            onRemove={() => {
              if (
                window.confirm(
                  `Remove "${offering.name.value || "this offering"}" from the profile?`,
                )
              ) {
                onChange(offerings.filter((item) => item.id !== offering.id));
              }
            }}
          />
        ))}
      </div>

      {filtered.length > limit && (
        <button
          type="button"
          className={`${buttonStyle} mt-4 mr-3`}
          onClick={() => setLimit(limit + 8)}
        >
          Show more
        </button>
      )}
      {limit > 8 && filtered.length > 8 && (
        <button
          type="button"
          className={`${buttonStyle} mt-4 mr-3`}
          onClick={showLess}
        >
          Show less
        </button>
      )}
      <button
        type="button"
        className={`${buttonStyle} mt-4`}
        onClick={addOffering}
      >
        Add offering
      </button>
    </div>
  );
}
