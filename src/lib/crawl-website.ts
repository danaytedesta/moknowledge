/** Visits a small, diverse set of same-site pages and keeps partial successes.
 * The deadline includes parsing time; complexity limits bound synchronous work. */
import { selectCrawlLinks, pagePriority } from "@/lib/crawl-priority";
import { fetchWebsite } from "@/lib/fetch-website";
import {
  extractKnowledge,
  type ExtractedKnowledge,
} from "@/lib/extract-knowledge";
import {
  extractPageContext,
  type PageContext,
} from "@/lib/extract-page-context";

interface ScrapedPage {
  knowledge: ExtractedKnowledge;
  context: PageContext;
  fetchedAt: string;
}

interface CrawlWarning {
  url: string;
  message: string;
}

export interface CrawlResult {
  pages: ScrapedPage[];
  warnings: CrawlWarning[];
}

// Treat /menu and /menu/ as duplicates for this limited crawl.
// Keep the original URL when actually downloading the page.
function pageKey(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

// Extract both sets of information from the same downloaded HTML.
function readPage(html: string, url: string): ScrapedPage {
  // Timers cannot interrupt synchronous JavaScript. Reject pathological markup
  // before repeated DOM scans; the caller keeps previously collected pages.
  if ((html.match(/<[a-z][^>]*>/gi)?.length ?? 0) > 18000) throw new Error("Page has too many HTML elements to process safely.");
  return {
    knowledge: extractKnowledge(html, url),
    context: extractPageContext(html, url),
    fetchedAt: new Date().toISOString(),
  };
}

// A timeout also protects against a downloader promise that never settles.
// This releases the caller; the real downloader separately aborts its connection.
async function withinBudget<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Collection deadline exceeded.")), Math.max(1, milliseconds));
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function crawlWebsite(website: string, budgetMs = 45_000): Promise<CrawlResult> {
  const deadline = Date.now() + Math.min(45_000, budgetMs);
  // If the starting page fails, let the API return an error.
  const first = await withinBudget(fetchWebsite(website, undefined, deadline - Date.now()), deadline - Date.now());
  const firstPage = readPage(first.html, first.finalUrl);

  const pages: ScrapedPage[] = [firstPage];
  const warnings: CrawlWarning[] = [];
  const allowedOrigin = new URL(first.finalUrl).origin;

  const visited = new Set([pageKey(website), pageKey(first.finalUrl)]);

  // One further discovery level helps when services are linked from an index.
  // The same six-attempt and time budgets still bound all requests.
  const candidates = selectCrawlLinks(firstPage.context.relatedPages).map(
    (link) => ({ ...link, depth: 1 }),
  );
  const visitedKinds = new Set<number>();

  let attempts = 0;

  while (candidates.length) {
    candidates.sort(
      (a, b) =>
        pagePriority(a) +
        (visitedKinds.has(pagePriority(a)) ? 10 : 0) -
        (pagePriority(b) + (visitedKinds.has(pagePriority(b)) ? 10 : 0)),
    );
    const candidate = candidates.shift()!;
    if (attempts >= 6) break;
    if (Date.now() >= deadline - 500) {
      warnings.push({
        url: first.finalUrl,
        message:
          "The collection time limit was reached. Some linked pages were not read.",
      });
      break;
    }

    const key = pageKey(candidate.url);

    if (visited.has(key)) continue;
    if (new URL(candidate.url).origin !== allowedOrigin) continue;

    visited.add(key);
    attempts += 1;
    visitedKinds.add(pagePriority(candidate));

    try {
      // Download sequentially, using the existing address and size checks.
      const downloaded = await withinBudget(fetchWebsite(
        candidate.url,
        allowedOrigin,
        deadline - Date.now(),
      ), deadline - Date.now());

      const finalKey = pageKey(downloaded.finalUrl);

      // A redirect may lead to a page already collected.
      if (finalKey !== key && visited.has(finalKey)) continue;

      visited.add(finalKey);

      if (Date.now() >= deadline) {
        warnings.push({ url: candidate.url, message: "The collection time limit was reached before this page could be processed." });
        break;
      }
      const page = readPage(downloaded.html, downloaded.finalUrl);
      pages.push(page);
      if (candidate.depth < 2)
        for (const link of selectCrawlLinks(page.context.relatedPages)) {
          if (
            !visited.has(pageKey(link.url)) &&
            !candidates.some((item) => pageKey(item.url) === pageKey(link.url))
          )
            candidates.push({ ...link, depth: 2 });
        }
    } catch (error) {
      // Keep successful pages if an additional page cannot be read.
      console.error("Related page failed:", candidate.url, error);

      warnings.push({
        url: candidate.url,
        message: "This related page could not be read.",
      });
    }
  }

  for (const page of pages) {
    const textLength = page.context.paragraphs.join(" ").length;
    if (
      textLength < 80 &&
      page.knowledge.headings.length < 2 &&
      page.context.offeringCandidates.length === 0
    ) {
      warnings.push({
        url: page.knowledge.sourceUrl,
        message:
          "Very little readable content was returned. This page may require JavaScript or restrict automated access. Review the result or try another page.",
      });
    }
    if (page.context.offeringCandidates.length >= 40) {
      warnings.push({
        url: page.knowledge.sourceUrl,
        message:
          "The 40-offering collection limit was reached. This profile may not include the complete catalog.",
      });
    }
  }
  return { pages, warnings };
}
