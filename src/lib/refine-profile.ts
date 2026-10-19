/** Refines company identity and biographies while preserving unknowns and conflicts. */
import { refineBaseline } from "@/lib/refine-baseline";
import type { KnowledgeBase, KnowledgeField } from "@/types/knowledge";

// Small evidence-based interpretations. This is not an LLM and does not approve facts.
export function refineProfile(profile: KnowledgeBase): KnowledgeBase {
  const company = { ...profile.company };
  const brand = company.name.value ?? "";
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const passages = profile.sources.flatMap((source) =>
    source.paragraphs.map((snippet) => ({ sourceUrl: source.url, snippet })),
  );
  const ownPassages = passages.filter(
    ({ snippet, sourceUrl }) =>
      /about|story|history|companyinfo|firm-background/i.test(
        new URL(sourceUrl).pathname,
      ) &&
      !/^(?:our client|our customer|a client|a customer)/i.test(snippet) &&
      (Boolean(brand && snippet.toLowerCase().includes(brand.toLowerCase())) ||
        /^(?:we |our company |I started|I founded)/i.test(snippet)),
  );
  const field = (
    value: string,
    evidence: { sourceUrl: string; snippet: string }[],
    origin: "extracted" | "inferred" = "extracted",
  ): KnowledgeField<string> => ({
    value,
    evidence,
    origin,
    confirmedAt: null,
    updatedAt: profile.updatedAt,
  });
  if (
    company.yearFounded.value === null &&
    !company.yearFounded.evidence.length &&
    !company.yearFounded.confirmedAt &&
    brand
  ) {
    const candidates = ownPassages.flatMap((e) => {
      const match = e.snippet.match(
        new RegExp(
          "\\b(?:I|we) (?:started|founded|established) " +
            escaped +
            " in (\\d{4})\\b",
          "i",
        ),
      );
      return match && +match[1] <= new Date().getFullYear()
        ? [{ ...e, year: +match[1] }]
        : [];
    });
    const years = new Set(candidates.map((e) => e.year));
    if (candidates.length)
      company.yearFounded = {
        ...company.yearFounded,
        value: years.size === 1 ? candidates[0].year : null,
        origin: "extracted",
        evidence: candidates.map(({ sourceUrl, snippet }) => ({
          sourceUrl,
          snippet,
        })),
      };
    if (years.size > 1)
      profile.warnings.push({
        url: company.website.value ?? "",
        message:
          "Conflicting founding years in company history; no year selected.",
      });
  }
  if (
    !company.legalEntityType.value &&
    !company.legalEntityType.evidence.length &&
    !company.legalEntityType.confirmedAt
  ) {
    const suffix = brand.match(
      /(?:,?\s)(LLC|L\.L\.C\.|LLP|Ltd\.?|Limited|Inc\.?|Incorporated|Corporation|PLC)\s*$/i,
    )?.[1];
    if (suffix) company.legalEntityType = field(suffix, company.name.evidence);
  }
  // Use the company's overview/own story, not customer-industry landing pages.
  const summary = company.description.value ?? "";
  const evidence = company.description.evidence.filter(
    (e) => e.snippet === summary,
  );
  const ownText = [summary, ...ownPassages.map((e) => e.snippet)].join(" ");
  if (
    !company.companyRole.value &&
    !company.companyRole.evidence.length &&
    !company.companyRole.confirmedAt
  ) {
    const roles: [RegExp, string][] = [
      [
        /\b(?:we|our company) (?:are|is) (?:an? )?(manufacturer|retailer|wholesaler|distributor)\b/i,
        "",
      ],
      [
        /\b(?:we|[A-Z][\w’-]+) (?:designs?) (?:our |its |their )?(?:own )?(?:[a-z-]+ ){0,2}(?:products|tools|furniture|clothing)\b/,
        "Product designer",
      ],
      [
        /\b(?:bookkeep(?:er|ing)|accounting|pest control|repair|consulting|haircut|salon|drilling)\b/i,
        "Service provider",
      ],
    ];
    for (const [pattern, label] of roles) {
      const match = summary.match(pattern);
      if (match && evidence.length) {
        company.companyRole = field(label || match[1], evidence, "inferred");
        break;
      }
    }
  }
  if (
    !company.businessModel.value &&
    !company.businessModel.evidence.length &&
    !company.businessModel.confirmedAt
  ) {
    if (/\b(?:subscription|membership)[ -]based\b/i.test(ownText)) {
      const e = ownPassages.find((e) =>
        /\b(?:subscription|membership)[ -]based\b/i.test(e.snippet),
      );
      if (e)
        company.businessModel = field(
          e.snippet.match(/\b(?:subscription|membership)[ -]based\b/i)![0],
          [e],
          "inferred",
        );
    } else if (
      company.companyRole.value === "Service provider" &&
      /\b(?:businesses|business owners|companies)\b/i.test(summary) &&
      evidence.length
    )
      company.businessModel = field(
        "Business-to-business services",
        evidence,
        "inferred",
      );
    else if (
      /\b(?:shop|buy|order)\b/i.test(
        profile.market.callsToAction.map((x) => x.value).join(" "),
      ) &&
      profile.offerings.some((o) => o.kind.value === "product")
    ) {
      const product = profile.offerings.find(
        (o) => o.kind.value === "product" && o.name.origin === "extracted",
      );
      const action = profile.market.callsToAction.find((x) =>
        /^(?:shop|buy|order)\b/i.test(x.value ?? ""),
      );
      if (product && action)
        company.businessModel = field(
          "Direct product sales",
          [...product.name.evidence, ...action.evidence],
          "inferred",
        );
    }
  }
  const people = profile.people.map((person) => {
    if (
      person.background.value ||
      person.background.confirmedAt ||
      !person.name.value
    )
      return person;
    const name = person.name.value.toLowerCase();
    const passage = passages.find(
      (e) =>
        person.name.evidence.some(
          (source) => source.sourceUrl === e.sourceUrl,
        ) && e.snippet.toLowerCase().startsWith(name + " "),
    );
    return passage
      ? { ...person, background: field(passage.snippet, [passage]) }
      : person;
  });
  return refineBaseline({ ...profile, company, people });
}
