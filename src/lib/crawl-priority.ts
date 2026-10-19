// Common service labels supplement structural menu context; no website-specific rules.
export const serviceLinkPattern =
  /\b(?:pest control|termite|rodent|repairs?|inspections?|drilling|bookkeeping|tax preparation|haircuts?|cleaning|treatments?)\b/i;
// Rank links by their published label and navigation context, never by a company name.
export interface CrawlLink {
  url: string;
  label: string;
  context?: string;
}
export function pagePriority(page: CrawlLink): number {
  const text = `${page.label} ${new URL(page.url).pathname.replace(/[-_/]/g, " ")}`;
  if (
    /\b(careers?|employment|jobs?|login|privacy|terms|blog|news|join our team|requests?|quotes?|estimates?|promotions?)\b/i.test(
      text,
    )
  )
    return 99;
  if (
    serviceLinkPattern.test(text) &&
    !/\b(?:industries|industry|customers)\b/i.test(text)
  )
    return 1;
  if (/\b(about|story|history|companyinfo)\b/i.test(text)) return 0;
  if (
    /\b(services?|products?|menu|pricing|shop|solutions?)\b/i.test(
      text + " " + (page.context ?? ""),
    )
  )
    return 1;
  if (/\b(faqs?|process|how it works)\b/i.test(text)) return 2;
  if (/\b(team|staff|staffbios|people|founder|bios)\b/i.test(text)) return 3;
  if (/\b(contact|locations?)\b/i.test(text)) return 4;
  if (/\b(partners?|suppliers?)\b/i.test(text)) return 5;
  return 6;
}
export function selectCrawlLinks(links: CrawlLink[]): CrawlLink[] {
  const seen = new Set<string>();
  const sorted = links
    .filter((link) => {
      const url = new URL(link.url);
      const key = url.origin + url.pathname.replace(/\/+$/, "");
      if (seen.has(key) || pagePriority(link) === 99) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => pagePriority(a) - pagePriority(b));
  const first = sorted.filter(
    (link, index) =>
      sorted.findIndex(
        (other) => pagePriority(other) === pagePriority(link),
      ) === index,
  );
  return [...first, ...sorted.filter((link) => !first.includes(link))];
}
