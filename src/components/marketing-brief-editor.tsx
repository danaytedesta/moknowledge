"use client";

import { useId, useState } from "react";
import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import KnowledgeListEditor from "@/components/knowledge-list-editor";
import {
  compileMarketingBrief,
  type MarketingChannel,
} from "@/lib/compile-marketing-brief";
import type {
  KnowledgeBase,
  KnowledgeField,
  MarketingClaim,
  VoicePreferences,
} from "@/types/knowledge";

interface Props {
  profile: KnowledgeBase;
  onChange: (profile: KnowledgeBase) => void;
}

const buttonStyle =
  "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747] disabled:opacity-40";

const controlStyle =
  "mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-3 py-3 text-[#3F352E] outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20";

const presets = [
  {
    label: "Professional",
    description: "Polished and clear, without emojis.",
    formality: "professional",
    emoji: "none",
    length: "balanced",
  },
  {
    label: "Warm",
    description: "Friendly and conversational, with occasional emojis.",
    formality: "conversational",
    emoji: "occasional",
    length: "balanced",
  },
  {
    label: "Casual",
    description: "Relaxed and brief, without emojis.",
    formality: "casual",
    emoji: "none",
    length: "short",
  },
] as const;

export default function MarketingBriefEditor({ profile, onChange }: Props) {
  const id = useId();
  const [channel, setChannel] = useState<MarketingChannel>("social");
  const [task, setTask] = useState(
    "Introduce an offering to a potential customer.",
  );
  const [notice, setNotice] = useState("");

  const brief = compileMarketingBrief(profile, channel, task);
  const voice = profile.marketing.voice;

  function updateMarketing(changes: Partial<KnowledgeBase["marketing"]>) {
    onChange({
      ...profile,
      updatedAt: new Date().toISOString(),
      marketing: {
        ...profile.marketing,
        ...changes,
      },
    });

    setNotice("");
  }

  function updateVoice(changes: Partial<VoicePreferences>) {
    updateMarketing({
      voice: {
        ...voice,
        ...changes,
        chosenAt: new Date().toISOString(),
      },
    });
  }

  function addClaim() {
    const field: KnowledgeField<string> = {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: new Date().toISOString(),
    };

    updateMarketing({
      claims: [
        ...profile.marketing.claims,
        {
          id: crypto.randomUUID(),
          text: field,
          status: "needs_proof",
          reviewAfter: null,
        },
      ],
    });
  }

  function replaceClaim(updated: MarketingClaim) {
    updateMarketing({
      claims: profile.marketing.claims.map((claim) =>
        claim.id === updated.id ? updated : claim,
      ),
    });
  }

  function approveClaim(claim: MarketingClaim) {
    if (!claim.text.value?.trim()) return;

    const now = new Date();

    replaceClaim({
      ...claim,
      status: "approved",
      text: {
        ...claim.text,
        confirmedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      reviewAfter: new Date(
        now.getTime() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief.text);
      setNotice("Brief copied.");
    } catch {
      setNotice("Copy unavailable. Select and copy the preview text.");
    }
  }

  return (
    <div>
      <section className="kb-summary mb-6" aria-label="How to use marketing preferences">
        <h4 className="text-xl font-bold">Ready to use your profile for marketing?</h4>
        <p className="mt-2 text-[#695B4F]">These choices are optional. Your profile can be saved without them.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[#695B4F]">
          <li>Pick a writing style below, such as Warm or Professional.</li>
          <li>Choose what you want customers to do next. Add audience details only if helpful.</li>
          <li>Review prices or promises you want included. Unapproved ones are left out.</li>
          <li>Open “Advanced: writing instructions” below, choose a social post, email or article, and describe what you want to write. Copy the instructions for use in a writing tool.</li>
        </ol>
        <p className="mt-3 text-sm text-[#756D66]">This app prepares writing instructions. It does not generate finished posts, send emails or publish anything. Select Save profile to keep your preferences; the writing task and channel choice are temporary.</p>
      </section>
      <h4 className="kb-group-title">How should your business sound?</h4>
      <p className="mt-2 text-sm text-[#756D66]">
        Pick a style that feels like your business.
      </p>

      {/* Choosing a preset is the only visible voice task at first. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {presets.map((preset) => {
          const selected =
            Boolean(voice.chosenAt) &&
            voice.formality === preset.formality &&
            voice.emoji === preset.emoji &&
            voice.length === preset.length;

          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                updateVoice({
                  formality: preset.formality,
                  emoji: preset.emoji,
                  length: preset.length,
                })
              }
              className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747] ${
                selected
                  ? "border-[#705747] bg-[#EEE4D8]"
                  : "border-[#CEC3B7] bg-[#FAF8F5] hover:bg-[#F2EDE6]"
              }`}
            >
              <span className="block font-bold">{preset.label}</span>
              <span className="mt-2 block text-sm text-[#756D66]">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-5">
        {/* Extra preferences remain available without crowding the main flow. */}
        <details className="kb-optional">
          <summary className="cursor-pointer font-bold">
            Fine-tune wording
          </summary>

          <label className="mt-4 block font-bold">
            Refer to the business as
            <select
              className={controlStyle}
              value={voice.pronoun ?? ""}
              onChange={(event) =>
                updateVoice({
                  pronoun: (event.target.value || null) as "we" | "I" | null,
                })
              }
            >
              <option value="">Not specified</option>
              <option value="we">We</option>
              <option value="I">I</option>
            </select>
          </label>

          <label className="mt-4 block font-bold">
            What do you call your customers?
            <input
              className={controlStyle}
              value={voice.callsCustomers}
              maxLength={80}
              placeholder="For example: clients or guests"
              onChange={(event) =>
                updateVoice({ callsCustomers: event.target.value })
              }
            />
          </label>

          <label className="mt-4 block font-bold">
            Avoid in our writing
            <textarea
              className={controlStyle}
              rows={3}
              maxLength={1500}
              placeholder="One instruction per line"
              value={voice.avoid.join("\n")}
              onChange={(event) =>
                updateVoice({
                  avoid: event.target.value.split("\n"),
                })
              }
            />
          </label>
        </details>

        <div className="mt-5">
          <KnowledgeFieldEditor
            label="What should customers do next?"
            field={profile.marketing.preferredCallToAction}
            placeholder="For example: View our menu or Request a quote"
            onChange={(preferredCallToAction) =>
              updateMarketing({ preferredCallToAction })
            }
          />
        </div>

        <details className="kb-optional">
          <summary className="cursor-pointer font-bold">
            Audience preferences
          </summary>

          <div className="mt-4 space-y-5">
            <KnowledgeListEditor
              label="Customers you want more of"
              field={profile.marketing.customersWanted}
              onChange={(customersWanted) =>
                updateMarketing({ customersWanted })
              }
            />

            <KnowledgeListEditor
              label="Customers outside your focus"
              field={profile.marketing.customersNotSuitable}
              onChange={(customersNotSuitable) =>
                updateMarketing({ customersNotSuitable })
              }
            />

            <KnowledgeListEditor
              label="What prompts customers to look for you?"
              field={profile.marketing.triggerMoments}
              onChange={(triggerMoments) => updateMarketing({ triggerMoments })}
            />
          </div>
        </details>

        {/* Explicit approval remains important for promises and claims. */}
        <section className="kb-group">
          <h4 className="kb-group-title">
            Statements to review ({profile.marketing.claims.length})
          </h4>

          <p className="mt-3 text-sm text-[#756D66]">
            Approve awards, certifications, guarantees, and similar statements
            before they appear in your marketing.
          </p>

          {profile.marketing.claims.map((claim) => (
            <details
              key={claim.id}
              className="kb-item mt-3"
              name={`${id}-statements`}
            >
              <summary>
                <span className="block break-words">
                  {claim.text.value || "New statement"}
                </span>
                <span className="mt-1 block text-sm font-normal text-[#756D66]">
                  {claim.status === "approved"
                    ? "Approved for use"
                    : claim.status === "banned"
                      ? "Don’t use"
                      : "Needs a look"}
                </span>
              </summary>
              <div className="kb-item-body space-y-4">
                <KnowledgeFieldEditor
                  label="Statement"
                  showConfirmation={false}
                  field={claim.text}
                  multiline
                  onChange={(text) =>
                    replaceClaim({
                      ...claim,
                      text,
                      status: "needs_proof",
                      reviewAfter: null,
                    })
                  }
                />

                <p className="text-sm text-[#756D66]">
                  {claim.status === "approved"
                    ? "Approved — subject to annual review."
                    : claim.status === "banned"
                      ? "Banned from marketing content."
                      : "Needs review."}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonStyle}
                    disabled={!claim.text.value?.trim()}
                    onClick={() => approveClaim(claim)}
                  >
                    Approve for use
                  </button>

                  <button
                    type="button"
                    className={buttonStyle}
                    onClick={() => replaceClaim({ ...claim, status: "banned" })}
                  >
                    Ban
                  </button>

                  <button
                    type="button"
                    className={buttonStyle}
                    onClick={() =>
                      replaceClaim({
                        ...claim,
                        status: "needs_proof",
                        reviewAfter: null,
                      })
                    }
                  >
                    Needs review
                  </button>

                  <button
                    type="button"
                    className={buttonStyle}
                    onClick={() => {
                      if (window.confirm("Remove this claim?")) {
                        updateMarketing({
                          claims: profile.marketing.claims.filter(
                            (item) => item.id !== claim.id,
                          ),
                        });
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </details>
          ))}

          <button
            type="button"
            className={`${buttonStyle} mt-4`}
            onClick={addClaim}
          >
            Add statement
          </button>
        </section>

        {/* The technical demonstration is available only when requested. */}
        <details className="kb-optional">
          <summary className="cursor-pointer font-bold">
            Advanced: writing instructions
          </summary>

          <p className="mt-3 text-sm text-[#756D66]">
            These instructions bring your business details and choices together. Choose a format and describe your goal. Review what was included and left out before copying.
          </p>

          <label htmlFor={`${id}-channel`} className="mt-4 block font-bold">
            What would you like to write?
          </label>

          <select
            id={`${id}-channel`}
            className={controlStyle}
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value as MarketingChannel);
              setNotice("");
            }}
          >
            <option value="social">MoSocial — social post</option>
            <option value="email">MoMail — email</option>
            <option value="blog">MoBlogs — article</option>
          </select>

          <label htmlFor={`${id}-task`} className="mt-4 block font-bold">
            What should the content do?
          </label>

          <textarea
            id={`${id}-task`}
            className={controlStyle}
            rows={3}
            maxLength={2000}
            value={task}
            onChange={(event) => {
              setTask(event.target.value);
              setNotice("");
            }}
          />

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor={`${id}-preview`} className="block font-bold">
                Writing instructions (brief)
              </label>

              <textarea
                id={`${id}-preview`}
                readOnly
                value={brief.text}
                rows={20}
                className={`${controlStyle} font-mono text-xs leading-relaxed`}
              />
            </div>

            <div className="rounded-lg bg-[#F2EDE6] p-4">
              <h4 className="font-bold">Left out of this brief</h4>

              {brief.leftOut.length > 0 ? (
                <ul className="mt-3 max-h-72 overflow-y-auto list-disc space-y-2 pl-5 text-sm text-[#695B4F]">
                  {brief.leftOut.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#756D66]">
                  No eligible details needed to be left out.
                </p>
              )}

              <p className="mt-4 text-sm text-[#756D66]">
                Only fields supported by this brief are checked. Other details
                remain saved in your profile.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={`${buttonStyle} mt-4`}
            onClick={copyBrief}
          >
            Copy brief
          </button>

          <p
            role="status"
            aria-live="polite"
            className="mt-2 text-sm text-[#756D66]"
          >
            {notice}
          </p>
        </details>
      </div>
    </div>
  );
}
