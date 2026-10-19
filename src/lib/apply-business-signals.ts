import { refineProfile } from "@/lib/refine-profile";
import { addressKey } from "@/lib/normalize-extraction";
import { applyContentSignals } from "@/lib/apply-content-signals";
import type { CrawlResult } from "@/lib/crawl-website";
import type {
  Evidence,
  KnowledgeBase,
  KnowledgeField,
} from "@/types/knowledge";
import type { CompanySignalKey } from "@/lib/extract-business-signals";

// Map collected evidence into a profile without owner-confirming it.
export function applyBusinessSignals(
  profile: KnowledgeBase,
  crawl: CrawlResult,
): KnowledgeBase {
  const now = new Date().toISOString();
  const warnings = [...profile.warnings];

  function emptyText(): KnowledgeField<string> {
    return {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: now,
    };
  }

  // Identical values share their supporting evidence from different pages.
  function collect<T>(
    values: { value: T; sourceUrl: string; snippet: string }[],
    origin: KnowledgeField<T>["origin"],
  ): KnowledgeField<T>[] {
    const grouped = new Map<T, Evidence[]>();

    for (const item of values) {
      const evidence = grouped.get(item.value) ?? [];

      if (
        !evidence.some(
          (entry) =>
            entry.sourceUrl === item.sourceUrl &&
            entry.snippet === item.snippet,
        )
      ) {
        evidence.push({
          sourceUrl: item.sourceUrl,
          snippet: item.snippet,
        });
      }

      grouped.set(item.value, evidence);
    }

    return [...grouped.entries()].map(([value, evidence]) => ({
      value,
      origin,
      evidence,
      confirmedAt: null,
      updatedAt: now,
    }));
  }

  const signals = crawl.pages.map((page) => page.context.businessSignals);

  const years = collect(
    signals.flatMap((item) => item.foundingYears),
    "extracted",
  );

  // Group punctuation, country suffix, and street-abbreviation variants,
  // while retaining every source snippet supporting the chosen display value.
  const addressVariants = signals.flatMap((item) => item.addresses);
  const displayValues = new Map<string, string>();
  for (const item of addressVariants) {
    const key = addressKey(item.value);
    if (key && !displayValues.has(key)) displayValues.set(key, item.value);
  }
  const addresses = collect(
    addressVariants.map((item) => ({
      ...item,
      value: displayValues.get(addressKey(item.value)) ?? item.value,
    })),
    "extracted",
  );

  if (years.length > 1) {
    warnings.push({
      url: profile.company.website.value ?? "",
      message:
        "Multiple founding-year candidates were found. No year was selected automatically.",
    });
  }

  const company = { ...profile.company };
  if (years.length > 1)
    company.yearFounded = {
      ...company.yearFounded,
      value: null,
      evidence: years.flatMap((item) => item.evidence),
    };

  // Conflicting values are left for review rather than arbitrarily selected.
  const companyKeys: CompanySignalKey[] = [
    "legalEntityType",
    "employeeCount",
    "industry",
    "companyRole",
  ];

  for (const key of companyKeys) {
    const candidates = collect(
      signals.flatMap((item) =>
        (item.companyDetails ?? [])
          .filter((detail) => detail.key === key)
          .map((detail) => detail.signal),
      ),
      "extracted",
    );

    if (!company[key].value && candidates.length === 1) {
      company[key] = candidates[0];
    } else if (candidates.length > 1) {
      company[key] = {
        ...company[key],
        value: null,
        evidence: candidates.flatMap((item) => item.evidence),
      };
      warnings.push({
        url: profile.company.website.value ?? "",
        message: `Conflicting ${key} values: ${candidates.map((item) => item.value).join(" / ")}. No value was selected automatically.`,
      });
    }
  }

  // Convert individually sourced candidates into a list with combined evidence.
  // Preserve any existing owner-entered or confirmed list.
  function fillList(
    current: KnowledgeField<string[]>,
    candidates: KnowledgeField<string>[],
  ): KnowledgeField<string[]> {
    if (current.value?.length || current.confirmedAt || !candidates.length) {
      return current;
    }

    return {
      value: candidates
        .map((item) => item.value)
        .filter((value): value is string => value !== null),
      origin: "extracted",
      evidence: candidates.flatMap((item) => item.evidence),
      confirmedAt: null,
      updatedAt: now,
    };
  }

  company.alternativeNames = fillList(
    company.alternativeNames,
    collect(
      signals.flatMap((item) => item.alternativeNames ?? []),
      "extracted",
    ),
  );

  company.serviceAreas = fillList(
    company.serviceAreas,
    collect(
      signals.flatMap((item) => item.serviceAreas ?? []),
      "extracted",
    ),
  );

  if (company.yearFounded.value === null && years.length === 1) {
    company.yearFounded = years[0];
  }

  // Do not decide which address is the headquarters.
  const existingAddresses = new Set(
    company.otherLocations.map((location) =>
      addressKey(location.address.value ?? ""),
    ),
  );

  company.otherLocations = [
    ...company.otherLocations,
    ...addresses
      .filter(
        (address) => !existingAddresses.has(addressKey(address.value ?? "")),
      )
      .map((address) => ({
        id: crypto.randomUUID(),
        label: emptyText(),
        address,
      })),
  ];

  const people = [...profile.people];

  for (const signal of signals.flatMap((item) => item.people ?? [])) {
    const normalizedName = signal.name.toLowerCase().trim();

    // Keep an existing person's details rather than overwriting reviewed data.
    if (
      people.some(
        (person) => person.name.value?.toLowerCase().trim() === normalizedName,
      )
    ) {
      continue;
    }

    function personField(value: string | null): KnowledgeField<string> {
      return value
        ? {
            value,
            origin: "extracted",
            evidence: [
              {
                sourceUrl: signal.sourceUrl,
                snippet: signal.snippet,
              },
            ],
            confirmedAt: null,
            updatedAt: now,
          }
        : emptyText();
    }

    people.push({
      id: crypto.randomUUID(),
      name: personField(signal.name),
      title: personField(signal.title),
      role: personField(signal.role),
      background: personField(signal.background),

      // Never infer gender from names, pictures, or job titles.
      gender: personField(signal.gender ?? null),
    });
  }

  const callsToAction = [...profile.market.callsToAction];
  const existingActions = new Set(
    callsToAction.map((field) => field.value?.trim().toLowerCase()),
  );

  for (const field of collect(
    signals.flatMap((item) => item.callsToAction ?? []),
    "extracted",
  )) {
    const key = field.value?.trim().toLowerCase();

    if (!existingActions.has(key)) {
      callsToAction.push(field);
      existingActions.add(key);
    }
  }

  return refineProfile(
    applyContentSignals(
      {
        ...profile,
        updatedAt: now,
        company,
        people,

        market: {
          ...profile.market,
          callsToAction,
        },

        branding: {
          ...profile.branding,

          // Observed CSS is not automatically an official brand guideline.
          colors: profile.branding.colors.length
            ? profile.branding.colors
            : collect(
                signals.flatMap((item) => item.colors),
                "measured",
              ),

          fonts: profile.branding.fonts.length
            ? profile.branding.fonts
            : collect(
                signals.flatMap((item) => item.fonts),
                "measured",
              ),

          logoUrls: profile.branding.logoUrls.length
            ? profile.branding.logoUrls
            : collect(
                signals.flatMap((item) => item.logoUrls),
                "inferred",
              ),
        },

        warnings,
      },
      crawl,
    ),
  );
}
