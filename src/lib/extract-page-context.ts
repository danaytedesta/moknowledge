/** Collects page evidence, useful links and offering candidates for the profile. */
import { readableText } from "@/lib/readable-text";
import {
  extractExplicitProfile,
  type ExplicitProfile,
} from "@/lib/extract-explicit-profile";
import {
  selectCrawlLinks,
  serviceLinkPattern,
  type CrawlLink,
} from "@/lib/crawl-priority";
import {
  extractContentSignals,
  type ContentSignals,
} from "@/lib/extract-content-signals";
import * as cheerio from "cheerio";
import {
  extractBusinessSignals,
  type BusinessSignals,
} from "@/lib/extract-business-signals";
import { cleanBusinessSignals } from "@/lib/clean-business-signals";

export interface OfferingCandidate {
  origin?: "extracted" | "inferred";
  category?: string | null;
  kind?: "product" | "service";
  features?: string[];
  name: string;
  description: string | null;
  priceText: string | null;
  sourceUrl: string;
  snippet: string;
}

export interface PageContext {
  explicitProfile?: ExplicitProfile;
  contentSignals?: ContentSignals;
  paragraphs: string[];
  relatedPages: CrawlLink[];
  offeringCandidates: OfferingCandidate[];
  businessSignals: BusinessSignals;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractPageContext(
  html: string,
  sourceUrl: string,
): PageContext {
  const $ = cheerio.load(html);
  const source = new URL(sourceUrl);

  $("script, style, noscript, template").remove();

  const relatedPages = new Map<string, CrawlLink>();
  const usefulWords =
    /\b(about|story|team|contact|location|locations|service|services|product|products|menu|pricing|faq|faqs|process|solutions|staff|staffbios|bios|people|partners|suppliers)\b/i;

  const sectionLabels = new Map<object, string>();
  $("a[href]").slice(0, 2000).each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href) return;

    try {
      const url = new URL(href, source);

      if (url.origin !== source.origin) return;
      if (!["http:", "https:"].includes(url.protocol)) return;
      if (url.username || url.password || url.search) return;

      if (
        /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|docx?)$/i.test(url.pathname)
      ) {
        return;
      }

      url.hash = "";

      const current = new URL(source);
      current.hash = "";
      if (url.href === current.href) return;

      const label = cleanText($(element).text());
      const pathWords = url.pathname.replace(/[-_/]/g, " ");

      // Parent menu labels can identify services with names such as "Drain inspection".
      const parentMenu = $(element)
        .closest("li")
        .parents("li")
        .first()
        .children("a")
        .first()
        .text();
      const section = $(element).closest("section");
      const sectionNode = section.get(0);
      if (sectionNode && !sectionLabels.has(sectionNode)) sectionLabels.set(sectionNode, section.find("h2").first().text());
      const context = cleanText(`${parentMenu} ${sectionNode ? sectionLabels.get(sectionNode) : ""}`);
      if (
        usefulWords.test(`${label} ${pathWords}`) ||
        serviceLinkPattern.test(`${label} ${pathWords}`) ||
        /\b(services?|products?|solutions?|menu)\b/i.test(context)
      ) {
        relatedPages.set(url.href, {
          url: url.href,
          label: label || url.pathname,
          context,
        });
      }
    } catch {
      // Ignore malformed links.
    }
  });

  $(
    "blockquote, [class*='testimonial'], [class*='blog'], [class*='post-card'], nav, header, footer, form, [role='form'], input, select, textarea, [hidden], [aria-hidden='true']",
  ).remove();

  const main = $("main").first();
  const content = main.length ? main : $("body");

  const paragraphs = new Set<string>();

  content.find("p").each((_, element) => {
    const text = readableText($(element));

    if (text.length >= 50 && text.length <= 1500) {
      paragraphs.add(text);
    }
  });

  const offeringCandidates = new Map<string, OfferingCandidate>();

  // Match descriptive paths such as /food-menu and /our-services too.
  const pathWords = source.pathname.replace(/[-_/]+/g, " ");
  const isOfferingPage = /\b(menu|services?|products?|pricing|shop)\b/i.test(
    pathWords,
  );

  if (isOfferingPage) {
    const genericHeading =
      /^(menu|our menu|our drinks|list|services|our services|products|our products|pricing|shop|locations|contact|about|fall specials|customer favorites|best sellers|featured products)$/i;

    content.find("h2, h3, h4").each((_, element) => {
      if (offeringCandidates.size >= 40) return;

      const heading = $(element);
      const name = readableText(heading);

      if (name.length < 3 || name.length > 120 || genericHeading.test(name)) {
        return;
      }

      let description = "";
      let blockText = "";
      let container = heading.parent();

      for (let depth = 0; depth < 4 && container.length; depth++) {
        if (container.find("h1, h2, h3, h4").length !== 1) break;

        const text = readableText(container);
        if (text.length > 2000) break;

        // Some platforms use description divs instead of paragraphs.
        // Only accept those without nested headings or paragraph blocks.
        const nearbyDescriptions = container
          .find(
            "p, [itemprop='description'], " +
              "[class*='description'], [class*='Description']",
          )
          .filter(
            (_, candidate) =>
              $(candidate).find("h1, h2, h3, h4, p").length === 0,
          )
          .map((_, candidate) => readableText($(candidate)))
          .get()
          .filter(
            (value) =>
              value.length >= 20 &&
              value.length <= 1500 &&
              value.toLowerCase() !== name.toLowerCase(),
          );

        if (nearbyDescriptions.length > 0) {
          description = nearbyDescriptions[0];
          blockText = text;
          break;
        }

        container = container.parent();
      }

      // Keep the conservative evidence requirement.
      // Items with no nearby description may still be missed.
      if (!description) return;

      // The description may sit in a nested header while features/prices are
      // siblings in the same card. Expand only while there is one offering heading.
      for (let depth = 0; depth < 2; depth++) {
        const parent = container.parent();
        if (!parent.length || parent.find("h1,h2,h3,h4").length !== 1) break;
        const text = readableText(parent);
        if (text.length > 2000) break;
        container = parent;
        blockText = text;
      }
      const amounts = blockText.match(/[$£€]\s*\d[\d,]*(?:\.\d{1,2})?/g);

      // Prefer an explicitly labeled price block to preserve wording
      // such as "$5.95/5 Pieces" rather than reducing it to "$5.95".
      const priceBlocks = container
        .find("[itemprop='price'], [class*='price'], [class*='Price']")
        .filter(
          (_, candidate) => $(candidate).find("h1, h2, h3, h4").length === 0,
        )
        .map((_, candidate) => readableText($(candidate)))
        .get()
        .filter(
          (value) =>
            value.length <= 160 &&
            (value.match(/[$£€]\s*\d[\d,]*(?:\.\d{1,2})?/g)?.length ?? 0) === 1,
        );

      const priceMatch = blockText.match(
        /(?:starting\s+(?:at|from)\s*|from\s*)?[$£€]\s*\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:\/|per\s+)(?:hour|month|year|person|item))?/i,
      );

      const priceText =
        amounts?.length === 1 &&
        !container.find("sup, sub, [class*='cents'], [class*='fraction']")
          .length &&
        !/[$£€]\s*\d+\s+\d/.test(blockText)
          ? (priceBlocks[0] ?? priceMatch?.[0] ?? null)
          : null;

      const key = name.toLowerCase();

      if (!offeringCandidates.has(key)) {
        offeringCandidates.set(key, {
          name,
          origin: "inferred",
          kind: /\bservices?\b/i.test(pathWords) ? "service" : undefined,
          features: container
            .find("li, [role='listitem'], [class*='feature-item'], [class*='incl-item'], [class*='inclusion-item']")
            .map((_, item) => readableText($(item)))
            .get()
            .filter((value) => value.length > 3 && value.length < 300)
            .slice(0, 12),
          description,
          priceText,
          sourceUrl,
          snippet: blockText,
        });
      }
    });
  }

  const contentSignals = extractContentSignals(html, sourceUrl);
  // On a product detail page, descriptive subheadings are features/options, not
  // separate products. Structured items and explicit linked cards still survive.
  const structuredProduct = contentSignals.offerings.some((item) => item.origin === "extracted" && item.kind === "product");
  if (structuredProduct && /\/products?\/[^/]+/.test(source.pathname)) offeringCandidates.clear();
  // Keep dedicated-page results first; merge other sourced suggestions by name.
  for (const candidate of contentSignals.offerings) {
    if (
      (!offeringCandidates.has(candidate.name.toLowerCase()) ||
        candidate.origin === "extracted") &&
      offeringCandidates.size < 40
    ) {
      const previous = offeringCandidates.get(candidate.name.toLowerCase());
      offeringCandidates.set(candidate.name.toLowerCase(), {
        ...candidate,
        features: candidate.features?.length ? candidate.features : previous?.features,
      });
    }
  }
  return {
    contentSignals,
    explicitProfile: extractExplicitProfile(html, sourceUrl),
    paragraphs: [...paragraphs].slice(0, 30),
    relatedPages: selectCrawlLinks([...relatedPages.values()]).slice(0, 40),
    offeringCandidates: [...offeringCandidates.values()],
    businessSignals: cleanBusinessSignals(
      extractBusinessSignals(html, sourceUrl),
    ),
  };
}
