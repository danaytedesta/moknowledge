import type {
  KnowledgeBase,
  KnowledgeField,
  SourcePage,
} from "@/types/knowledge";

// Add conservative, rule-based suggestions.
// This does not call an AI service.
export function enrichKnowledgeBase(profile: KnowledgeBase): KnowledgeBase {
  const now = new Date().toISOString();

  // Copy the sections we will change.
  const company = { ...profile.company };

  function fromPassage(
    text: string,
    source: SourcePage,
  ): KnowledgeField<string> {
    return {
      value: text,
      origin: "extracted",
      evidence: [
        {
          sourceUrl: source.url,
          snippet: text,
        },
      ],
      confirmedAt: null,
      updatedAt: now,
    };
  }

  // Find an About or Story page by its URL path.
  const aboutPage = profile.sources.find((source) => {
    const path = new URL(source.url).pathname;
    return /\/(about|about-us|our-story|story)(\/|$)/i.test(path);
  });

  if (
    (!company.description.value || company.description.value.length < 40) &&
    !company.description.confirmedAt &&
    aboutPage
  ) {
    // Use a substantial About-page passage as an editable excerpt.
    // This is not an AI-generated summary or a verified company overview.
    const passage = aboutPage.paragraphs.find(
      (text) =>
        text.length >= 100 &&
        !/\b(cookie|privacy policy|terms of service)\b/i.test(text),
    );

    if (passage) {
      company.description = fromPassage(passage, aboutPage);
    }
  }

  if (!company.name.value) {
    // Page titles often put the brand at the beginning or end.
    // Only suggest a short title segment repeated on multiple pages.
    const candidates = new Map<
      string,
      { name: string; sources: SourcePage[] }
    >();

    const genericNames = new Set([
      "home",
      "about",
      "about us",
      "our story",
      "contact",
      "contact us",
      "menu",
      "services",
      "products",
      "blog",
      "welcome",
      "faq",
      "pricing",
      "locations",
      "shop",
    ]);

    for (const source of profile.sources) {
      if (!source.title) continue;

      // Split only at common title separators with surrounding spaces.
      const parts = source.title.split(/\s+[|–—-]\s+/);
      const segments = [parts[0], parts[parts.length - 1]];

      for (const segment of new Set(segments)) {
        const name = segment.trim();
        const key = name.toLowerCase();

        if (name.length < 2 || name.length > 60 || genericNames.has(key)) {
          continue;
        }

        const candidate = candidates.get(key) ?? {
          name,
          sources: [],
        };

        if (!candidate.sources.some((item) => item.url === source.url)) {
          candidate.sources.push(source);
        }

        candidates.set(key, candidate);
      }
    }

    const repeatedName = [...candidates.values()]
      .filter((candidate) => candidate.sources.length >= 2)
      .sort((a, b) => b.sources.length - a.sources.length)[0];

    if (repeatedName) {
      company.name = {
        value: repeatedName.name,

        // Title interpretation is a suggestion, not an explicit fact.
        origin: "inferred",
        evidence: repeatedName.sources.map((source) => ({
          sourceUrl: source.url,
          snippet: source.title ?? "",
        })),
        confirmedAt: null,
        updatedAt: now,
      };
    }
  }

  return {
    ...profile,
    company,
    updatedAt: now,
  };
}
