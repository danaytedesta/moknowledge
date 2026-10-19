/** Converts sourced candidates into editable offerings, merges duplicates and
 * preserves price conflicts. Suggestions never count as owner approval. */
import {
  decodePublishedText,
  isOfferingName,
} from "@/lib/normalize-extraction";
import type { CrawlResult } from "@/lib/crawl-website";
import type { OfferingCandidate } from "@/lib/extract-page-context";
import type { KnowledgeField, Offering } from "@/types/knowledge";

export function buildOfferings(crawl: CrawlResult): Offering[] {
  const now = new Date().toISOString();

  function empty<T>(): KnowledgeField<T> {
    return {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: now,
    };
  }

  function extracted(
    value: string,
    candidate: OfferingCandidate,
  ): KnowledgeField<string> {
    return {
      value,
      origin: candidate.origin ?? "extracted",
      evidence: [
        {
          sourceUrl: candidate.sourceUrl,
          snippet: candidate.snippet,
        },
      ],
      confirmedAt: null,
      updatedAt: now,
    };
  }

  const offerings: Offering[] = [];

  for (const page of crawl.pages) {
    for (const raw of page.context.offeringCandidates) {
      const candidate: OfferingCandidate = {
        ...raw,
        name: decodePublishedText(raw.name)
          .split(/,\s*(?:so\b|please\b|don[’']t\b)/i)[0]
          .trim(),
        description: raw.description
          ? decodePublishedText(raw.description)
          : null,
        priceText: raw.priceText ? decodePublishedText(raw.priceText) : null,
      };
      if (!isOfferingName(candidate.name)) continue;
      // Merge below, including candidates whose richer features appear on a
      // later page even when their name, description and price are identical.
      offerings.push({
        id: crypto.randomUUID(),
        name: extracted(candidate.name, candidate),

        description: candidate.description
          ? extracted(candidate.description, candidate)
          : empty<string>(),

        // Structured values are copied. A later bounded rule can suggest service kind.
        category: candidate.category
          ? extracted(candidate.category, candidate)
          : empty<string>(),
        kind: candidate.kind
          ? { ...extracted(candidate.kind, candidate), value: candidate.kind }
          : empty<"product" | "service" | "other">(),
        features: candidate.features?.length
          ? { ...extracted("", candidate), value: candidate.features }
          : empty<string[]>(),

        marketing: {
          priority: "maintain",

          // Default priority does not mean the owner chose or approved it.
          chosenAt: null,
          reviewAfter: null,
        },

        pricing: {
          // The owner will choose the price type during review.
          type: null,
          text: candidate.priceText
            ? extracted(candidate.priceText, candidate)
            : empty<string>(),
        },
      });
    }
  }

  // The same offering often appears on the homepage and its detail page.
  // Merge by normalized name; retain evidence and do not choose between conflicting prices.
  const merged = new Map<string, Offering>();
  const priceConflicts = new Set<string>();
  const priceKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/https?:\/\/schema.org\/\w+/g, "")
      .replace(/usd\s*/g, "$")
      .replace(/\.00\b/g, "")
      .replace(/[^a-z0-9$£€]+/g, "");
  const mergeField = <T>(
    a: KnowledgeField<T>,
    b: KnowledgeField<T>,
  ): KnowledgeField<T> => {
    const preferred =
      b.value !== null &&
      (a.value === null ||
        (b.origin === "extracted" && a.origin !== "extracted"))
        ? b
        : a;
    return {
      ...preferred,
      evidence: [...a.evidence, ...b.evidence].filter(
        (e, i, all) =>
          all.findIndex(
            (x) => x.sourceUrl === e.sourceUrl && x.snippet === e.snippet,
          ) === i,
      ),
    };
  };
  for (const item of offerings) {
    const key = (item.name.value ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, item);
      continue;
    }
    for (const field of ["name", "description", "category"] as const)
      previous[field] = mergeField(previous[field], item[field]);
    previous.kind = mergeField(previous.kind, item.kind);
    previous.features = mergeField(previous.features, item.features);
    const a = previous.pricing.text,
      b = item.pricing.text;
    if (a.value && b.value && priceKey(a.value) !== priceKey(b.value))
      priceConflicts.add(key);
    previous.pricing.text = mergeField(a, b);
    if (priceConflicts.has(key))
      previous.pricing.text = {
        ...previous.pricing.text,
        value: null,
        origin: "inferred",
      };
  }
  for (const key of priceConflicts)
    crawl.warnings.push({
      url: merged.get(key)!.name.evidence[0]?.sourceUrl ?? "",
      message: `Different published prices for ${merged.get(key)!.name.value}; no price selected. Review the retained sources.`,
    });
  return [...merged.values()].slice(0, 40).map((item) => {
    // Classify only from a service-bearing offering name, never from a customer's
    // industry page or from an unrelated product mentioned in its description.
    const service = (item.name.value ?? "").match(/\b(?:bookkeeping|bookkeeper|cleaning|consulting|consultation|repair|installation|inspection|catering|photography|drilling|tax filing|tax preparation|haircut|lessons|training)\b/i);
    const explicitService = /\b(?:tax filing|bookkeeping|cleaning services|repair services)\b/i.test(item.description.value ?? "");
    if (!item.kind.value && (service || explicitService)) item.kind = { ...(service ? item.name : item.description), value: "service", origin: "inferred" };
    if (!item.category.value && service) item.category = { ...item.name, value: service[0], origin: "inferred" };
    return item;
  });
}
