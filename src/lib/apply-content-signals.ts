import type { CrawlResult } from "@/lib/crawl-website";
import type { KnowledgeBase, KnowledgeField } from "@/types/knowledge";

// Add newly discovered evidence without changing owner-reviewed values.
export function applyContentSignals(
  profile: KnowledgeBase,
  crawl: CrawlResult,
): KnowledgeBase {
  const now = new Date().toISOString();
  const signals = crawl.pages.flatMap((page) =>
    page.context.contentSignals ? [page.context.contentSignals] : [],
  );
  function field(
    value: string,
    sourceUrl: string,
    snippet: string,
    origin: "extracted" | "inferred" = "extracted",
  ): KnowledgeField<string> {
    return {
      value,
      origin,
      evidence: [{ sourceUrl, snippet }],
      confirmedAt: null,
      updatedAt: now,
    };
  }
  const people = [...profile.people];
  for (const person of signals.flatMap((item) => item.people)) {
    if (
      people.some(
        (item) => item.name.value?.toLowerCase() === person.name.toLowerCase(),
      )
    )
      continue;
    const empty = (): KnowledgeField<string> => ({
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: now,
    });
    people.push({
      id: crypto.randomUUID(),
      name: field(person.name, person.sourceUrl, person.snippet),
      title: person.title
        ? field(person.title, person.sourceUrl, person.snippet)
        : empty(),
      role: field(person.role, person.sourceUrl, person.snippet),
      background: person.background
        ? field(person.background, person.sourceUrl, person.snippet)
        : empty(),
      gender: empty(),
    });
  }
  const faqs = [...profile.content.faqs];
  for (const item of signals.flatMap((signal) => signal.faqs)) {
    if (
      faqs.some(
        (faq) =>
          faq.question.value?.toLowerCase() === item.question.toLowerCase(),
      )
    )
      continue;
    faqs.push({
      id: crypto.randomUUID(),
      question: field(item.question, item.sourceUrl, item.snippet),
      answer: field(item.answer, item.sourceUrl, item.snippet),
    });
    if (faqs.length >= 20) break;
  }
  const claims = [...profile.marketing.claims];
  for (const item of signals.flatMap((signal) => signal.claims)) {
    if (
      claims.some(
        (claim) => claim.text.value?.toLowerCase() === item.value.toLowerCase(),
      )
    )
      continue;
    claims.push({
      id: crypto.randomUUID(),
      text: field(item.value, item.sourceUrl, item.snippet),
      status: "needs_proof",
      reviewAfter: null,
    });
    if (claims.length >= 20) break;
  }
  const company = { ...profile.company };
  for (const key of ["industry", "businessModel", "companyRole"] as const) {
    if (
      company[key].value ||
      company[key].confirmedAt ||
      company[key].evidence.length
    )
      continue;
    const candidates = signals.flatMap((signal) => signal[key]);
    const values = new Set(candidates.map((item) => item.value.toLowerCase()));
    if (values.size === 1) {
      const first = candidates[0];
      company[key] = {
        ...field(first.value, first.sourceUrl, first.snippet, "inferred"),
        evidence: candidates.map(({ sourceUrl, snippet }) => ({
          sourceUrl,
          snippet,
        })),
      };
    }
  }
  const market = { ...profile.market };
  const positioning = { ...profile.positioning };
  const warnings = [...profile.warnings];
  const collect = (
    key:
      | "foundingStory"
      | "serviceAreas"
      | "targetBuyers"
      | "customerNeeds"
      | "differentiators"
      | "partners",
  ) => signals.flatMap((signal) => signal[key] ?? []);
  for (const key of ["targetBuyers", "customerNeeds"] as const) {
    const items = collect(key);
    if (!market[key].value?.length && !market[key].confirmedAt && items.length)
      market[key] = {
        value: [...new Set(items.map((item) => item.value))],
        origin: "extracted",
        evidence: items.map(({ sourceUrl, snippet }) => ({
          sourceUrl,
          snippet,
        })),
        confirmedAt: null,
        updatedAt: now,
      };
  }
  const areas = collect("serviceAreas");
  if (!company.serviceAreas.value?.length && areas.length)
    company.serviceAreas = {
      value: [...new Set(areas.map((item) => item.value))],
      origin: "extracted",
      evidence: areas.map(({ sourceUrl, snippet }) => ({ sourceUrl, snippet })),
      confirmedAt: null,
      updatedAt: now,
    };
  const stories = collect("foundingStory");
  if (!positioning.foundingStory.value && stories.length) {
    const first = stories[0];
    positioning.foundingStory = field(
      first.value,
      first.sourceUrl,
      first.snippet,
    );
  }
  if (!positioning.differentiators.length)
    positioning.differentiators = collect("differentiators").map((item) =>
      field(item.value, item.sourceUrl, item.snippet),
    );
  if (!market.suppliersAndPartners.length)
    market.suppliersAndPartners = collect("partners").map((item) =>
      field(item.value, item.sourceUrl, item.snippet),
    );
  // Different answers to the same question need review. Keep both evidence records.
  for (const item of signals.flatMap((signal) => signal.faqs)) {
    const existing = faqs.find(
      (faq) =>
        faq.question.value?.toLowerCase() === item.question.toLowerCase(),
    );
    if (existing && existing.answer.value !== item.answer) {
      if (!existing.answer.evidence.some((e) => e.snippet === item.snippet))
        existing.answer.evidence.push({
          sourceUrl: item.sourceUrl,
          snippet: item.snippet,
        });
      existing.answer.origin = "inferred";
      warnings.push({
        url: item.sourceUrl,
        message: `Different answers found for "${item.question}". Review the retained answer and source evidence before using it.`,
      });
    }
  }
  const branding = { ...profile.branding };
  const passages = profile.sources
    .flatMap((source) =>
      source.paragraphs.map((snippet) => ({ sourceUrl: source.url, snippet })),
    )
    .slice(0, 20);
  if (!branding.writingStyle.value && passages.length) {
    const words = passages.reduce(
      (n, item) => n + item.snippet.split(/\s+/).length,
      0,
    );
    branding.writingStyle = {
      value: `Text sample: ${passages.length} paragraphs; average ${Math.round(words / passages.length)} words per paragraph. This measures text length, not brand tone.`,
      origin: "measured",
      evidence: passages.slice(0, 3),
      confirmedAt: null,
      updatedAt: now,
    };
  }
  // Explicit baseline labels take precedence over measurements or guesses.
  const explicit = crawl.pages.flatMap((page) =>
    page.context.explicitProfile ? [page.context.explicitProfile] : [],
  );
  const mappings = [
    ["pitch", positioning, "pitch"],
    ["persona", market, "idealCustomerPersona"],
    ["industryOutlook", market, "industryOutlook"],
    ["artStyle", branding, "artStyle"],
    ["writingStyle", branding, "writingStyle"],
    ["businessModel", company, "businessModel"],
    ["mainAddress", company, "mainAddress"],
  ] as const;
  for (const [sourceKey, section, destination] of mappings) {
    const target = section as unknown as Record<string, KnowledgeField<string>>;
    const current = target[destination];
    if (current.confirmedAt || (current.value && current.origin !== "measured"))
      continue;
    const items = explicit.flatMap((item) => item[sourceKey]);
    if (!items.length) continue;
    const values = new Set(items.map((item) => item.value.toLowerCase()));
    target[destination] = {
      ...field(items[0].value, items[0].sourceUrl, items[0].snippet),
      value: values.size === 1 ? items[0].value : null,
      evidence: items.map(({ sourceUrl, snippet }) => ({ sourceUrl, snippet })),
    };
    if (values.size > 1)
      warnings.push({
        url: items[0].sourceUrl,
        message: `Conflicting ${destination} statements were found. No value was selected.`,
      });
  }
  for (const key of ["industryGroupings", "channels", "funnels"] as const) {
    const items = explicit.flatMap((item) => item[key]);
    if (!market[key].value?.length && !market[key].confirmedAt && items.length)
      market[key] = {
        value: [...new Set(items.map((item) => item.value))],
        origin: "extracted",
        evidence: items.map(({ sourceUrl, snippet }) => ({
          sourceUrl,
          snippet,
        })),
        confirmedAt: null,
        updatedAt: now,
      };
  }
  return {
    ...profile,
    market,
    positioning,
    branding,
    warnings,
    company,
    people,
    content: { ...profile.content, faqs },
    marketing: { ...profile.marketing, claims },
  };
}
