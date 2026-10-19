"use client";

import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import type {
  FrequentlyAskedQuestion,
  KnowledgeField,
} from "@/types/knowledge";

interface Props {
  faqs: FrequentlyAskedQuestion[];
  onChange: (faqs: FrequentlyAskedQuestion[]) => void;
}

// FAQ questions and answers stay paired through editing, saving, and export.
export default function FaqEditor({ faqs, onChange }: Props) {
  const buttonStyle =
    "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";
  function empty(): KnowledgeField<string> {
    return {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return (
    <section className="kb-group">
      <h4 className="kb-group-title">Customer decision map ({faqs.length})</h4>
      <p className="mt-3 text-sm text-[#756D66]">
        Website questions and process explanations help customers understand
        their next step. Edit only what needs correcting. These answers feed the
        writing brief; pricing is kept in offering controls. Promises in an
        answer still need separate approval under Statements to review.
      </p>
      <div className="mt-5 space-y-3">
        {faqs.map((faq) => (
          <details key={faq.id} className="kb-item">
            <summary className="cursor-pointer font-bold">
              {faq.question.value || "New question"}
            </summary>
            <div className="kb-item-body kb-fields">
              <KnowledgeFieldEditor
                label="Question"
                field={faq.question}
                onChange={(question) =>
                  onChange(
                    faqs.map((item) =>
                      item.id === faq.id ? { ...item, question } : item,
                    ),
                  )
                }
              />
              <KnowledgeFieldEditor
                label="Answer"
                field={faq.answer}
                multiline
                onChange={(answer) =>
                  onChange(
                    faqs.map((item) =>
                      item.id === faq.id ? { ...item, answer } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                className={buttonStyle}
                onClick={() => {
                  if (window.confirm("Remove this question and answer?"))
                    onChange(faqs.filter((item) => item.id !== faq.id));
                }}
              >
                Remove question
              </button>
            </div>
          </details>
        ))}
      </div>
      <button
        type="button"
        className={`${buttonStyle} mt-4`}
        onClick={() =>
          onChange([
            ...faqs,
            { id: crypto.randomUUID(), question: empty(), answer: empty() },
          ])
        }
      >
        Add question
      </button>
    </section>
  );
}
