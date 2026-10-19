import type { KnowledgeBase } from "@/types/knowledge";

// Derived on every render/compile: edits to the original Q/A never go stale.
export function customerDecisionMap(profile: KnowledgeBase) {
  return profile.content.faqs.map((faq) => {
    const text = `${faq.question.value ?? ""} ${faq.answer.value ?? ""}`;
    const topic = /\b(price|cost|pay|fee|deposit|refund)\b|[$£€]/i.test(text)
      ? "Cost and commitment"
      : /\b(book|start|process|step|schedule|happens|how it works)\b/i.test(
            text,
          )
        ? "Getting started"
        : /\b(who|suitable|serve|area|location|eligible)\b/i.test(text)
          ? "Fit"
          : /\b(time|long|deliver|expect|prepare)\b/i.test(text)
            ? "What to expect"
            : "Common questions";
    return { ...faq, topic };
  });
}
