/** Completes baseline fields from already collected, attributable website text.
 * This is a rules-based pass, not AI: copied statements are extracted; summaries
 * and classifications are inferred. It never approves content for the owner.
 */
import type { Evidence, KnowledgeBase, KnowledgeField } from "@/types/knowledge";
import { claimPattern } from "@/lib/marketing-safety";

export function refineBaseline(profile: KnowledgeBase): KnowledgeBase {
  const company = { ...profile.company };
  const market = { ...profile.market };
  const positioning = { ...profile.positioning };
  const branding = { ...profile.branding };
  const brand = company.name.value ?? "";
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ownStart = new RegExp(`^(?:we\\b|our (?:company|business|team|products|services)\\b|${escaped || "(?!)"}\\b)`, "i");
  const evidence: Evidence[] = profile.sources.flatMap((source) => {
    // Customer stories, careers and editorial articles describe other entities.
    if (/\/(?:blog|news|careers|jobs|case-studies|testimonials)(?:\/|$)/i.test(new URL(source.url).pathname)) return [];
    return source.paragraphs.map((snippet) => ({ sourceUrl: source.url, snippet }));
  });
  // Include published answers: they often explain audience, price and service area.
  const answers = profile.content.faqs.flatMap((faq) => faq.answer.value && faq.answer.origin === "extracted"
    ? faq.answer.evidence.map((e) => ({ sourceUrl: e.sourceUrl, snippet: faq.answer.value! })) : []);
  const passages = [...company.description.evidence.filter((e) => e.snippet === company.description.value), ...evidence, ...answers]
    .filter((e, i, all) => e.snippet.length <= 2000 && all.findIndex((v) => v.snippet === e.snippet) === i);
  const sentences = passages.flatMap((e) => e.snippet.split(/(?<=[.!?])\s+(?=[A-Z])/).map((snippet) => ({ sourceUrl: e.sourceUrl, snippet })));
  const self = sentences.filter((e, i, all) => all.findIndex((x) => x.snippet === e.snippet) === i && (ownStart.test(e.snippet) || (brand && e.snippet.startsWith(`At ${brand}`))));
  const vacant = <T>(f: KnowledgeField<T>) => f.value === null && !f.confirmedAt && !f.evidence.length;
  const field = <T>(value: T, sources: Evidence[], origin: "extracted" | "inferred" | "measured" = "extracted"): KnowledgeField<T> => ({ value, evidence: sources, origin, confirmedAt: null, updatedAt: profile.updatedAt });
  const collect = (pattern: RegExp, candidates = self) => candidates.filter((e) => pattern.test(e.snippet)).slice(0, 4);

  // Retain full published sentences so qualifiers and limitations stay visible.
  if (vacant(market.targetBuyers)) {
    const found = collect(/\b(?:for|serve|serves|help|helps|support|supports|work with|to)\s+(?:(?:busy|local|small|growing|American|individual|independent|and)\s+){0,3}(?:homeowners|families|business(?:es| owners)?|teams|students|patients|professionals|customers|clients|organizations|people who)\b/i);
    if (found.length) market.targetBuyers = field(found.map((e) => e.snippet), found);
  }
  if (vacant(market.customerNeeds)) {
    const found = collect(/\b(?:help|helps|designed to|so you can|allows you to)\b[^.!?]{0,160}\b(?:save|saves|reduce|avoid|manage|focus|organize|keep|maintain|simplify|repair|clean|spend|solve)\b/i);
    if (found.length) market.customerNeeds = field(found.map((e) => e.snippet), found);
  }
  if (vacant(company.serviceAreas)) {
    const found = collect(/\b(?:nationwide|worldwide|across (?:the|all)|throughout|serve (?:the|all)|serving (?:the|all)|ship to|ships to|available in)\b/i);
    if (found.length) company.serviceAreas = field(found.map((e) => e.snippet), found);
  }
  if (!positioning.differentiators.length) {
    const found = collect(/\b(?:unlike|instead of|no (?:contracts|term contracts)|without (?:a contract|contracts)|customi[sz]ed|family[- ](?:run|owned)|locally owned|made to order)\b/i);
    positioning.differentiators = found.map((e) => field(e.snippet, [e]));
  }
  if (!market.suppliersAndPartners.length) {
    const found = self.filter((e) => !/\byou (?:partner|work) with\b/i.test(e.snippet) && (
      /\b(?:we partner(?:ed)? with|we work in partnership with|our supplier is|we(?:'re|’re| are) part of|member of|supplied by)\b/i.test(e.snippet) ||
      /\bis (?:a |proud to be a )[A-Z][\w®&'-]*(?: [A-Z][\w®&'-]*){0,3} company\b/.test(e.snippet)
    )).slice(0, 3);
    // Store the relationship sentence, not an unsupported legal ownership claim.
    market.suppliersAndPartners = found.map((e) => field(e.snippet, [e]));
  }
  if (vacant(positioning.foundingStory)) {
    const found = passages.find((e) => /about|story|history/i.test(new URL(e.sourceUrl).pathname) &&
      (ownStart.test(e.snippet) || (brand && e.snippet.includes(brand))) && /\b(?:founded|started|began|established|launched|beginnings|was born|brought)\b/i.test(e.snippet));
    if (found) positioning.foundingStory = field(found.snippet, [found]);
  }

  // Founding dates must describe this company being founded, not years in business
  // or "serving since" (which can mean a regional launch rather than founding).
  if (vacant(company.yearFounded)) {
    const years = passages.flatMap((e) => {
      if (!(ownStart.test(e.snippet) || (brand && e.snippet.includes(brand)))) return [];
      const match = e.snippet.match(new RegExp(`(?:${escaped || "(?!)"}|we|our (?:company|business))[^.!?]{0,60}\\b(?:was founded|was established|was launched|began|started)\\b[^.!?\\d]{0,40}((?:18|19|20)\\d{2})`, "i"));
      return match && +match[1] <= new Date().getFullYear() ? [{ e, year: +match[1] }] : [];
    });
    if (years.length) {
      const unique = new Set(years.map((x) => x.year));
      company.yearFounded = { ...field(years[0].year, years.map((x) => x.e)), value: unique.size === 1 ? years[0].year : null };
      if (unique.size > 1) profile.warnings.push({ url: company.website.value ?? "", message: "Conflicting explicit founding years; no year selected." });
    }
  }
  if (vacant(company.mainAddress)) {
    const found = collect(/\b(?:headquarters|head office|main office)\b[^.!?]{0,30}\b(?:at|in|is located)\b/i);
    if (found.length === 1) company.mainAddress = field(found[0].snippet, found);
  }
  const summary = company.description.value ?? "";
  const summaryEvidence = company.description.evidence.filter((e) => e.snippet === summary);
  if (vacant(company.companyRole) && summaryEvidence.length) {
    const role = /\b(?:cleaning|repair|consulting|bookkeeping|legal|dental|photography|installation|catering) services?\b/i.test(summary) ? "Service provider"
      : /\b(?:shop|buy|sell|sells)\b[^.!?]{0,100}\bproducts\b/i.test(summary) ? "Product seller" : null;
    if (role) company.companyRole = field(role, summaryEvidence, "inferred");
  }
  if (vacant(company.businessModel) && company.companyRole.value === "Service provider") {
    const consumer = collect(/\b(?:homeowners|homes|families|residential|patients)\b/i);
    if (consumer.length) company.businessModel = field("Consumer services", consumer, "inferred");
  }
  if (vacant(market.channels)) {
    // These are observed contact/sales channels, not a guessed acquisition strategy.
    const actions = market.callsToAction.filter((a) => a.value && /\b(?:shop|buy|order|call|email|book|quote|estimate)\b/i.test(a.value));
    const channels = new Set<string>();
    for (const action of actions) {
      if (/\b(?:shop|buy|order)\b/i.test(action.value!)) channels.add("Website ordering");
      if (/\bcall\b/i.test(action.value!)) channels.add("Telephone enquiries");
      if (/\bemail\b/i.test(action.value!)) channels.add("Email enquiries");
      if (/\b(?:book|quote|estimate)\b/i.test(action.value!)) channels.add("Website booking or quote request");
    }
    if (channels.size) market.channels = field([...channels], actions.flatMap((a) => a.evidence), "inferred");
  }
  if (vacant(market.funnels)) {
    const found = passages.filter((e) => /\bfirst(?:,|:) ?|\bfirst /i.test(e.snippet) && /\b(?:then|next|finally)(?:,|:)? /i.test(e.snippet) && /\b(?:book|quote|consultation|order|contact|appointment|purchase)\b/i.test(e.snippet)).slice(0, 3);
    if (found.length) market.funnels = field(found.map((e) => e.snippet), found);
  }
  if (vacant(market.idealCustomerPersona) && market.targetBuyers.value?.length) {
    market.idealCustomerPersona = field(`Rule-based audience summary: ${market.targetBuyers.value[0]}${market.customerNeeds.value?.[0] ? ` Need: ${market.customerNeeds.value[0]}` : ""}`, [...market.targetBuyers.evidence, ...market.customerNeeds.evidence], "inferred");
  }
  if (vacant(positioning.pitch) && summary && summaryEvidence.length && !claimPattern.test(summary) && !/[$£€]/.test(summary)) {
    positioning.pitch = field(`Rule-based pitch suggestion: ${summary}`, summaryEvidence, "inferred");
  }
  if (branding.writingStyle.origin === "measured" && !branding.writingStyle.confirmedAt && evidence.length) {
    const sample = evidence.slice(0, 20);
    const sentences = sample.flatMap((e) => e.snippet.match(/[^.!?]+[.!?]?/g) ?? []);
    const average = Math.round(sentences.reduce((n, s) => n + s.trim().split(/\s+/).length, 0) / Math.max(1, sentences.length));
    const direct = sample.filter((e) => /\b(?:you|your)\b/i.test(e.snippet)).length;
    branding.writingStyle = field(`Measured website text: ${sample.length} paragraphs; about ${average} words per sentence. ${direct} paragraphs address the reader as you/your. This describes language patterns, not owner-approved tone.`, sample.slice(0, 3), "measured");
  }
  // Industry outlook, art direction, legal facts and demographics still require
  // explicit published evidence. A plausible fill would be worse than unknown.
  return { ...profile, company, market, positioning, branding };
}
