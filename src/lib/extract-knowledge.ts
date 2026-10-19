import { socialProfileUrl } from "@/lib/normalize-extraction";
import * as cheerio from "cheerio";

export interface ExtractedKnowledge {
  sourceUrl: string;
  companyName: string | null;
  pageTitle: string | null;
  description: string | null;
  headings: string[];
  socialLinks: string[];
  socialLinkSources?: { url: string; originalUrl: string }[];
  contactLinks: string[];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Some sites publish placeholder strings instead of missing values.
// Reject them before they become a company name or description.
function readText(value: unknown): string {
  if (typeof value !== "string") return "";

  const text = cleanText(value);

  return /^(null|undefined|none|n\/a|not available)$/i.test(text) ? "" : text;
}

export function extractKnowledge(
  html: string,
  sourceUrl: string,
): ExtractedKnowledge {
  const $ = cheerio.load(html);
  const metadata = new Map<string, string>();

  $("meta").each((_, element) => {
    const content = readText($(element).attr("content"));
    if (!content) return;

    for (const attribute of ["name", "property"]) {
      const key = $(element).attr(attribute)?.trim().toLowerCase();

      if (key && !metadata.has(key)) {
        metadata.set(key, content);
      }
    }
  });

  function readMeta(...keys: string[]): string {
    for (const key of keys) {
      const value = metadata.get(key);
      if (value) return value;
    }

    return "";
  }

  // Read structured data without executing scripts.
  const structuredItems: Record<string, unknown>[] = [];

  function collectStructuredItems(value: unknown, depth = 0): void {
    if (depth > 12 || structuredItems.length >= 300) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        collectStructuredItems(item, depth + 1);
        if (structuredItems.length >= 300) break;
      }
      return;
    }

    if (!isRecord(value)) return;

    structuredItems.push(value);

    for (const child of Object.values(value)) {
      if (typeof child === "object" && child !== null) {
        collectStructuredItems(child, depth + 1);
      }

      if (structuredItems.length >= 300) break;
    }
  }

  $("script").each((_, element) => {
    const type = $(element).attr("type")?.trim().toLowerCase();
    if (type !== "application/ld+json") return;

    const raw = $(element).text();
    if (raw.length > 500_000) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      collectStructuredItems(parsed);
    } catch {
      // A malformed JSON-LD block should not stop the scrape.
    }
  });

  const businessTypes = new Set([
    "Organization",
    "Corporation",
    "LocalBusiness",
    "Store",
    "OnlineStore",
    "FoodEstablishment",
    "Restaurant",
    "CafeOrCoffeeShop",
    "Bakery",
    "ProfessionalService",
    "HealthAndBeautyBusiness",
    "BeautySalon",
  ]);

  function hasBusinessType(item: Record<string, unknown>): boolean {
    const rawTypes = Array.isArray(item["@type"])
      ? item["@type"]
      : [item["@type"]];

    return rawTypes.some((value) => {
      const type = readText(value).split(/[/#]/).pop() ?? "";
      return businessTypes.has(type);
    });
  }

  const sourceHostname = new URL(sourceUrl).hostname
    .toLowerCase()
    .replace(/^www\./, "");

  function belongsToWebsite(item: Record<string, unknown>): boolean {
    const website = readText(item.url);
    if (!website) return false;

    try {
      const url = new URL(website, sourceUrl);

      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.hostname.toLowerCase().replace(/^www\./, "") === sourceHostname
      );
    } catch {
      return false;
    }
  }

  const business = structuredItems.find(
    (item) => hasBusinessType(item) && belongsToWebsite(item),
  );

  // If explicit names are missing, leave them unknown here.
  // The existing enrichment step can suggest a repeated title-based name.
  const companyName =
    readMeta("og:site_name") ||
    readText(business?.name) ||
    readText(business?.legalName);

  const pageTitle = readText($("title").first().text());

  let description =
    readMeta("description", "og:description", "twitter:description") ||
    readText(business?.description);

  // Expand a clipped metadata excerpt only when a visible paragraph starts with
  // exactly the same words. Never complete the sentence with generated text.
  if (description.length >= 60) {
    const prefix = description.replace(/(?:\.\.\.|…)$/, "").trim();
    const full = $("p")
      .map((_, el) => cleanText($(el).text()))
      .get()
      .find(
        (value) =>
          value.length > prefix.length &&
          value.length <= 1500 &&
          value.startsWith(prefix),
      );
    if (full) description = full;
  }

  $("script, style, noscript, template").remove();

  const headings = unique(
    $("h1, h2, h3")
      .map((_, element) => {
        const heading = $(element).clone();
        heading.find("br").replaceWith(" ");
        heading.find("div, p, li, span, sup, sub, em").before(" ").after(" ");
        return cleanText(heading.text());
      })
      .get(),
  ).slice(0, 40);

  const socialLinks: string[] = [];
  const socialLinkSources: { url: string; originalUrl: string }[] = [];
  const contactLinks: string[] = [];

  const socialDomains = [
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "pinterest.com",
  ];

  function collectLink(href: string): void {
    try {
      const link = new URL(href, sourceUrl);

      if (link.username || link.password) return;

      if (link.protocol === "mailto:" || link.protocol === "tel:") {
        contactLinks.push(link.href);
        return;
      }

      if (!["https:", "http:"].includes(link.protocol)) return;

      const isSocial = socialDomains.some(
        (domain) =>
          link.hostname === domain || link.hostname.endsWith(`.${domain}`),
      );

      if (isSocial) {
        const profileUrl = socialProfileUrl(link.href);
        if (profileUrl) {
          socialLinks.push(profileUrl);
          if (
            socialLinkSources.length < 100 &&
            !socialLinkSources.some((item) => item.originalUrl === link.href)
          ) {
            socialLinkSources.push({ url: profileUrl, originalUrl: link.href });
          }
        }
      }
    } catch {
      // Ignore malformed links.
    }
  }

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (href) collectLink(href);
  });

  const sameAs = business?.sameAs;
  const structuredLinks = Array.isArray(sameAs) ? sameAs : [sameAs];

  for (const value of structuredLinks) {
    const link = readText(value);
    if (link) collectLink(link);
  }

  return {
    sourceUrl,
    companyName: companyName || null,
    pageTitle: pageTitle || null,
    description: description || null,
    headings,
    socialLinks: unique(socialLinks).slice(0, 30),
    socialLinkSources,
    contactLinks: unique(contactLinks).slice(0, 30),
  };
}
