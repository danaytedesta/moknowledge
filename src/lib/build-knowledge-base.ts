import { buildOfferings } from "@/lib/build-offerings";
import type { CrawlResult } from "@/lib/crawl-website";
import type {
  Evidence,
  KnowledgeBase,
  KnowledgeField,
  SocialProfile,
} from "@/types/knowledge";

// Convert collected page evidence into an editable business profile.
// This function does not call AI or invent missing business facts.
export function buildKnowledgeBase(crawl: CrawlResult): KnowledgeBase {
  if (crawl.pages.length === 0) {
    throw new Error("At least one collected page is required.");
  }

  const now = new Date().toISOString();
  const offerings = buildOfferings(crawl);

  // Empty fields have no evidence or confirmation.
  // "owner" means they are available for owner input.
  function empty<T>(): KnowledgeField<T> {
    return {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: now,
    };
  }

  // Website information is extracted, not automatically confirmed.
  function extracted<T>(value: T, evidence: Evidence[]): KnowledgeField<T> {
    return {
      value,
      origin: "extracted",
      evidence,
      confirmedAt: null,
      updatedAt: now,
    };
  }

  // Keep evidence from every page that supplies the same selected value.
  function extractTextField(
    key: "companyName" | "description",
  ): KnowledgeField<string> {
    const values = crawl.pages.flatMap((page) => {
      const value = page.knowledge[key]?.trim();

      return value ? [{ value, sourceUrl: page.knowledge.sourceUrl }] : [];
    });

    if (values.length === 0) return empty<string>();

    const selected = values[0].value;

    return extracted(
      selected,
      values.map((item) => ({
        sourceUrl: item.sourceUrl,
        snippet: item.value,
      })),
    );
  }

  // Preserve conflicting extracted values for review in source evidence.
  const warnings = [...crawl.warnings];

  for (const key of ["companyName", "description"] as const) {
    const values = new Set(
      crawl.pages
        .map((page) => page.knowledge[key]?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    if (values.size > 1) {
      warnings.push({
        url: crawl.pages[0].knowledge.sourceUrl,
        message:
          `Different ${key === "companyName" ? "company names" : "descriptions"} ` +
          "were found. The first value was selected for review.",
      });
    }
  }

  // Combine matching social URLs while retaining their sources.
  const socialEvidence = new Map<string, Evidence[]>();

  for (const page of crawl.pages) {
    for (const link of page.knowledge.socialLinks) {
      const evidence = socialEvidence.get(link) ?? [];

      const publishedLinks =
        page.knowledge.socialLinkSources
          ?.filter((item) => item.url === link)
          .map((item) => item.originalUrl) ?? [];
      for (const published of publishedLinks.length ? publishedLinks : [link]) {
        if (
          !evidence.some(
            (item) =>
              item.sourceUrl === page.knowledge.sourceUrl &&
              item.snippet === published,
          )
        ) {
          evidence.push({
            sourceUrl: page.knowledge.sourceUrl,
            snippet: published,
          });
        }
      }

      socialEvidence.set(link, evidence);
    }
  }

  function platformName(link: string): string {
    const hostname = new URL(link).hostname.replace(/^www\./, "");

    const platforms: [string, string][] = [
      ["instagram.com", "Instagram"],
      ["facebook.com", "Facebook"],
      ["linkedin.com", "LinkedIn"],
      ["twitter.com", "X"],
      ["x.com", "X"],
      ["youtube.com", "YouTube"],
      ["youtu.be", "YouTube"],
      ["tiktok.com", "TikTok"],
      ["pinterest.com", "Pinterest"],
    ];

    return (
      platforms.find(
        ([domain]) => hostname === domain || hostname.endsWith(`.${domain}`),
      )?.[1] ?? hostname
    );
  }

  const socialProfiles: SocialProfile[] = [...socialEvidence.entries()].map(
    ([url, evidence]) => ({
      id: crypto.randomUUID(),
      platform: platformName(url),
      url: extracted(url, evidence),
    }),
  );

  const website = crawl.pages[0].knowledge.sourceUrl;

  return {
    schemaVersion: "1.0",
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,

    company: {
      name: extractTextField("companyName"),
      description: extractTextField("description"),
      website: extracted(website, [
        {
          sourceUrl: website,
          snippet: website,
        },
      ]),
      industry: empty<string>(),
      businessModel: empty<string>(),
      companyRole: empty<string>(),
      yearFounded: empty<number>(),
      legalEntityType: empty<string>(),
      employeeCount: empty<string>(),
      mainAddress: empty<string>(),
      otherLocations: [],
      serviceAreas: empty<string[]>(),
      alternativeNames: empty<string[]>(),
    },

    positioning: {
      pitch: empty<string>(),
      foundingStory: empty<string>(),
      differentiators: [],
    },

    market: {
      targetBuyers: empty<string[]>(),
      customerNeeds: empty<string[]>(),
      idealCustomerPersona: empty<string>(),
      industryGroupings: empty<string[]>(),
      industryOutlook: empty<string>(),
      channels: empty<string[]>(),
      funnels: empty<string[]>(),
      callsToAction: [],
      suppliersAndPartners: [],
    },

    branding: {
      writingStyle: empty<string>(),
      artStyle: empty<string>(),
      fonts: [],
      colors: [],
      logoUrls: [],
    },

    socialProfiles,
    people: [],

    // Do not turn every heading into a product or service.

    offerings,

    content: {
      topics: [],
      faqs: [],
      testimonials: [],
      trustSignals: [],
    },

    marketing: {
      voice: {
        formality: "conversational",
        emoji: "none",
        length: "balanced",
        pronoun: null,
        callsCustomers: "",
        avoid: [],
        writingSamples: [],

        // These are interface defaults, not approved brand preferences.
        chosenAt: null,
      },
      claims: [],
      promotions: [],
      preferredCallToAction: empty<string>(),
      customersWanted: empty<string[]>(),
      customersNotSuitable: empty<string[]>(),
      triggerMoments: empty<string[]>(),
      genericPhrasesToAvoid: [],
    },

    sources: crawl.pages.map((page) => ({
      url: page.knowledge.sourceUrl,
      title: page.knowledge.pageTitle,
      fetchedAt: page.fetchedAt,
      headings: [...page.knowledge.headings],
      paragraphs: [...page.context.paragraphs],
    })),

    warnings,
  };
}
