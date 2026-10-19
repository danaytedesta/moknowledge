/** Extracts company facts, people, branding and CTAs with original evidence.
 * Ownership checks prevent another organization from supplying company facts. */
import { extractVisibleAddresses } from "@/lib/extract-visible-addresses";
import * as cheerio from "cheerio";

// Every candidate retains the page and text that support it.
export interface Signal<T> {
  value: T;
  sourceUrl: string;
  snippet: string;
}

export type CompanySignalKey =
  "legalEntityType" | "employeeCount" | "industry" | "companyRole";

export interface PersonSignal {
  name: string;
  title: string | null;
  role: string;
  background: string | null;
  gender?: string | null;
  sourceUrl: string;
  snippet: string;
}

export interface BusinessSignals {
  addresses: Signal<string>[];
  foundingYears: Signal<number>[];
  logoUrls: Signal<string>[];
  colors: Signal<string>[];
  fonts: Signal<string>[];

  companyDetails: {
    key: CompanySignalKey;
    signal: Signal<string>;
  }[];

  alternativeNames: Signal<string>[];
  serviceAreas: Signal<string>[];
  people: PersonSignal[];
  callsToAction: Signal<string>[];
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractBusinessSignals(
  html: string,
  sourceUrl: string,
): BusinessSignals {
  const $ = cheerio.load(html);

  const result: BusinessSignals = {
    addresses: [],
    foundingYears: [],
    logoUrls: [],
    colors: [],
    fonts: [],
    companyDetails: [],
    alternativeNames: [],
    serviceAreas: [],
    people: [],
    callsToAction: [],
  };

  function clean(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  function text(value: unknown): string {
    if (typeof value !== "string") return "";
    const cleaned = clean(value);
    return /^(null|undefined|none|n\/a|not available)$/i.test(cleaned)
      ? ""
      : cleaned;
  }

  // Deduplicate candidates and bound collection sizes.
  function add<T>(list: Signal<T>[], value: T, snippet: string) {
    if (list.length >= 20) return;
    if (list.some((item) => item.value === value)) return;

    list.push({
      value,
      sourceUrl,
      snippet: clean(snippet).slice(0, 1500),
    });
  }

  function webUrl(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;

    try {
      const url = new URL(value, sourceUrl);

      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function validYear(value: unknown): number | null {
    const match = text(value).match(/^(\d{4})(?:-|$)/);
    if (!match) return null;

    const year = Number(match[1]);

    return year >= 1000 && year <= new Date().getFullYear() ? year : null;
  }

  // Collect explicitly labeled address elements.
  $("address, [itemprop='streetAddress']").each((_, element) => {
    const copy = $(element).clone();
    copy.find("br").replaceWith(", ");
    copy.find("div, p").before(" ").after(" ");

    const value = clean(copy.text());
    const explicitlyLabeled = $(element).attr("itemprop") === "streetAddress";

    const looksLikeStreet =
      /\d/.test(value) &&
      /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|highway|hwy)\b/i.test(
        value,
      );

    if (
      value.length >= 5 &&
      value.length <= 500 &&
      (explicitlyLabeled || looksLikeStreet)
    ) {
      add(result.addresses, value, value);
    }
  });

  // Founding language is evidence; copyright dates are not.
  $("main p, article p, [itemprop='foundingDate']").each((_, element) => {
    const value = clean($(element).text());
    if (!value || value.length > 1500) return;

    const explicitDate = $(element).attr("itemprop") === "foundingDate";
    const companyName = text(
      $("meta[property='og:site_name']").attr("content"),
    );
    const ownStatement =
      /^(?:we |our (?:company|business|practice|shop) |founded |established )/i.test(
        value,
      ) ||
      Boolean(
        companyName &&
        value.toLowerCase().startsWith(companyName.toLowerCase()),
      );
    if (!explicitDate && !ownStatement) return;

    const match = explicitDate
      ? value.match(/\b(1\d{3}|20\d{2})\b/)
      : value.match(
          /\b(?:founded|established)\s+(?:in\s+)?(1\d{3}|20\d{2})\b/i,
        );

    if (!match) return;

    const year = Number(match[1]);

    if (year <= new Date().getFullYear()) {
      add(result.foundingYears, year, value);
    }
  });

  const brandName = text($("meta[property='og:site_name']").attr("content"));
  const aboutPath = /(?:about|story|history|companyinfo)/i.test(
    new URL(sourceUrl).pathname,
  );
  if (brandName && aboutPath)
    $("p").each((_, element) => {
      const node = $(element);
      if (
        node.closest(
          "blockquote, form, [class*='testimonial'], [class*='review']",
        ).length
      )
        return;
      const passage = clean(node.text());
      if (
        passage.length > 1500 ||
        !passage.toLowerCase().includes(brandName.toLowerCase())
      )
        return;
      const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Keep approximate counts exactly as published ("around 50" remains approximate).
      const count = passage.match(
        new RegExp(
          escaped +
            "[^.!?]{0,180}\\b(?:staff|team|workforce) of (?:around |about |over |approximately )?\\d+(?: people| employees| staff members)?",
          "i",
        ),
      );
      if (count) {
        const value = count[0].match(/(?:staff|team|workforce) of (.+)$/i)?.[1];
        if (value)
          result.companyDetails.push({
            key: "employeeCount",
            signal: { value, sourceUrl, snippet: passage },
          });
      }
      const beginning = passage.match(
        new RegExp(
          "^(?:In [^,]{0,30}?(\\d{4}),?\\s+)" +
            escaped +
            "[^.!?]{0,100}\\b(?:began|was founded|was established|started)\\b",
          "i",
        ),
      );
      if (beginning && Number(beginning[1]) <= new Date().getFullYear())
        add(result.foundingYears, Number(beginning[1]), passage);
      const former = passage.match(
        /\b(?:then known as|formerly known as|formerly called)\s+([^).;]{2,100})/i,
      );
      if (former) add(result.alternativeNames, former[1], passage);
    });

  // Explicit self-reported headcounts; never count portraits or team cards.
  $("main p, article p").each((_, element) => {
    const node = $(element);
    if (
      node.closest("blockquote, [class*='testimonial'], [class*='review']")
        .length
    )
      return;
    const passage = clean(node.text());
    const match = passage.match(
      /^(?:we|our company) (?:employ|have a team of|have) ((?:(?:around|about|over|approximately) )?\d+) (?:employees|staff members|people)\b/i,
    );
    if (match && passage.length <= 1500)
      result.companyDetails.push({
        key: "employeeCount",
        signal: { value: match[1], sourceUrl, snippet: passage },
      });
  });

  // Logo identification remains a heuristic for owner review.
  const logoBrand = (text($("meta[property='og:site_name']").attr("content")) || new URL(sourceUrl).hostname.replace(/^www\./, "").split(".")[0]).toLowerCase().replace(/[^a-z0-9]/g, "");
  $("img").each((_, element) => {
    const image = $(element);
    const label = [image.attr("alt"), image.attr("class"), image.attr("id")]
      .filter(Boolean)
      .join(" ");

    // A logo must identify this business, not a press outlet or a product photo.
    const brand = logoBrand;
    const src = image.attr("data-src") || image.attr("src");
    const url = webUrl(src);
    const asset =
      `${image.attr("alt") ?? ""} ${url ? new URL(url).pathname.split("/").pop() : ""}`.toLowerCase();
    const brandMatch =
      brand.length >= 3 && asset.replace(/[^a-z0-9]/g, "").includes(brand);
    let homeLink = false;
    try {
      const link = new URL(image.closest("a[href]").attr("href") ?? "#not-home", sourceUrl);
      homeLink = link.origin === new URL(sourceUrl).origin && link.pathname === "/" && Boolean(image.closest("a[href]").length);
    } catch {
      /* Invalid link. */
    }
    const headerLogo =
      Boolean(image.closest("header, nav, [role='banner']").length) && homeLink;
    const conciseAlt = (image.attr("alt") ?? "").length < 100;
    if (
      url &&
      /\blogo\b/i.test(label + " " + (src ?? "").replace(/[-_]/g, " ")) &&
      conciseAlt &&
      !/\b(?:all[-_ ]brands|partner[s]?|affiliates?|press|sponsors?)\b/i.test((src ?? "").split("/").pop() ?? "") &&
      (headerLogo || (brandMatch && /logo/i.test(src ?? "")))
    ) {
      add(result.logoUrls, url, `${label} | ${src}`);
    }
  });

  $("meta[name='theme-color']").each((_, element) => {
    const value = $(element).attr("content")?.trim();

    if (
      value &&
      /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
    ) {
      add(result.colors, value.toUpperCase(), `theme-color: ${value}`);
    }
  });

  // Inspect inline and embedded CSS, not external stylesheets.
  const cssBlocks: string[] = [];

  $("style").each((_, element) => {
    cssBlocks.push($(element).text());
  });

  $("[style]").each((_, element) => {
    cssBlocks.push($(element).attr("style") ?? "");
  });

  for (const css of cssBlocks) {
    for (const match of css.matchAll(
      /(?:^|[;{])\s*(?:color|background-color|border-color)\s*:\s*(#[0-9a-f]{8}|#[0-9a-f]{6}|#[0-9a-f]{4}|#[0-9a-f]{3})(?![0-9a-f])/gi,
    )) {
      add(result.colors, match[1].toUpperCase(), match[0]);
    }

    for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
      const stack = clean(match[1]);

      // Inheritance keywords are instructions, not font names.
      const isCssKeyword =
        /^(inherit|initial|unset|revert|revert-layer)$/i.test(stack);

      if (stack && !isCssKeyword && !/var\(/i.test(stack)) {
        add(result.fonts, stack, match[0]);
      }
    }
  }

  // Capture possible conversion actions without executing page behavior.
  $("a[href], button").each((_, element) => {
    const control = $(element);

    if (control.closest("[hidden], [aria-hidden='true']").length) {
      return;
    }

    const label = clean(control.text());
    if (label.length < 3 || label.length > 100) return;

    // Contact information belongs outside the CTA list.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label)) return;

    const actionPattern =
      /^(?:book|schedule|request|get|contact|call|shop|order|buy|subscribe|sign up|join|view|explore|download|start|reserve|visit)\b/i;

    if (!actionPattern.test(label)) return;
    if (/^(?:view|explore|visit)$/i.test(label)) return;

    const href = control.attr("href");

    if (href !== undefined) {
      try {
        const url = new URL(href, sourceUrl);

        if (
          !["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ||
          url.username ||
          url.password
        ) {
          return;
        }
      } catch {
        return;
      }
    }

    add(
      result.callsToAction,
      label,
      href ? `${label} | href: ${href}` : `${label} | button`,
    );
  });

  // Parse JSON-LD as data. Website scripts are never executed.
  const nodes: JsonObject[] = [];

  function walk(value: unknown, depth = 0): void {
    if (depth > 10 || nodes.length >= 300) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
        if (nodes.length >= 300) break;
      }
      return;
    }

    if (!isObject(value)) return;

    nodes.push(value);

    for (const child of Object.values(value)) {
      walk(child, depth + 1);
      if (nodes.length >= 300) break;
    }
  }

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).text();
    if (!raw || raw.length > 500_000) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      walk(parsed);
    } catch {
      // Invalid structured data does not stop other extraction.
    }
  });

  // Resolve references published in the same HTML document.
  const references = new Map<string, JsonObject>();

  for (const node of nodes) {
    const id = text(node["@id"]);

    if (id) {
      const previous = references.get(id);
      references.set(id, { ...previous, ...node });
    }
  }

  function resolve(value: unknown): unknown {
    if (!isObject(value)) return value;

    const id = text(value["@id"]);
    const referenced = id ? references.get(id) : undefined;

    return referenced ? { ...referenced, ...value } : value;
  }

  function types(node: JsonObject): string[] {
    const value = node["@type"];
    const entries = Array.isArray(value) ? value : [value];

    return entries
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.split(/[\/#]/).pop() ?? entry);
  }

  const hostname = new URL(sourceUrl).hostname.replace(/^www\./i, "");

  // Limit organization candidates to this website's hostname.
  function belongsToWebsite(node: JsonObject): boolean {
    return (text(node.url) ? [node.url] : [node["@id"]]).some((candidate) => {
      const url = webUrl(candidate);

      return url
        ? new URL(url).hostname.replace(/^www\./i, "") === hostname
        : false;
    });
  }

  const businessTypes = new Set([
    "Organization",
    "Corporation",
    "LocalBusiness",
    "ProfessionalService",
    "Store",
    "OnlineStore",
    "Restaurant",
    "CafeOrCoffeeShop",
    "FoodEstablishment",
    "Bakery",
    "BarOrPub",
    "Dentist",
    "MedicalBusiness",
    "HealthAndBeautyBusiness",
    "LegalService",
    "FinancialService",
    "RealEstateAgent",
    "HomeAndConstructionBusiness",
    "Electrician",
    "Plumber",
    "HVACBusiness",
    "RoofingContractor",
    "GeneralContractor",
    "AutoRepair",
    "LodgingBusiness",
    "Hotel",
    "EducationalOrganization",
    "NGO",
  ]);

  function companyDetail(
    key: CompanySignalKey,
    value: string,
    snippet: string,
  ) {
    if (!value || result.companyDetails.length >= 20) return;

    if (
      result.companyDetails.some(
        (item) => item.key === key && item.signal.value === value,
      )
    ) {
      return;
    }

    result.companyDetails.push({
      key,
      signal: {
        value,
        sourceUrl,
        snippet: clean(snippet).slice(0, 1500),
      },
    });
  }

  // Explicit labels are useful across industries; unrelated prose is not a legal fact.
  $("main p, main li, main dt").each((_, element) => {
    const node = $(element);
    if (
      node.closest("blockquote, [class*='testimonial'], [class*='review']")
        .length
    )
      return;
    const value = clean(node.text());
    const match = value.match(
      /^(Industry|Legal (?:entity type|form)|Employee count|Company role):\s*(\S.{0,149})$/i,
    );
    if (match) {
      const key: CompanySignalKey = /^industry/i.test(match[1])
        ? "industry"
        : /^legal/i.test(match[1])
          ? "legalEntityType"
          : /^employee/i.test(match[1])
            ? "employeeCount"
            : "companyRole";
      companyDetail(key, match[2].trim(), value);
    }
  });

  function entries(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }

  function addPerson(value: unknown, role: string) {
    const person = resolve(value);

    if (!isObject(person) || !types(person).includes("Person")) {
      return;
    }

    const name = text(person.name);

    if (!name || name.length > 150 || result.people.length >= 20) {
      return;
    }

    if (
      result.people.some(
        (item) =>
          item.name.toLowerCase() === name.toLowerCase() && item.role === role,
      )
    ) {
      return;
    }

    result.people.push({
      name,
      title: text(person.jobTitle) || null,
      gender: text(person.gender) || null,
      role,
      background: text(person.description).slice(0, 1500) || null,
      sourceUrl,
      snippet: JSON.stringify({
        relationship: role,
        person,
      }).slice(0, 1500),
    });
  }

  for (const node of nodes) {
    const nodeTypes = types(node);

    if (
      !nodeTypes.some((type) => businessTypes.has(type)) ||
      !belongsToWebsite(node)
    ) {
      continue;
    }

    for (const value of entries(node.alternateName)) {
      const name = text(value);

      if (name) {
        add(result.alternativeNames, name, `alternateName: ${name}`);
      }
    }

    const year = validYear(node.foundingDate);

    if (year !== null) {
      add(
        result.foundingYears,
        year,
        `JSON-LD foundingDate: ${text(node.foundingDate)}`,
      );
    }

    const publishedLegalName = text(node.legalName);
    const legalForm =
      text(node.legalForm) ||
      publishedLegalName.match(
        /(?:,?\s)(LLC|L\.L\.C\.|LLP|Ltd\.?|Limited|Inc\.?|Incorporated|Corporation|PLC)\s*$/i,
      )?.[1] ||
      "";

    if (legalForm) {
      companyDetail(
        "legalEntityType",
        legalForm,
        text(node.legalForm)
          ? `legalForm: ${legalForm}`
          : `legalName: ${publishedLegalName}`,
      );
    }

    const industry = text(node.industry);

    if (industry) {
      companyDetail("industry", industry, `industry: ${industry}`);
    }

    const classification = text(node.naics) || text(node.isicV4);

    if (classification && !industry) {
      // Preserve the published code without guessing its meaning.
      companyDetail(
        "industry",
        `Industry classification: ${classification}`,
        JSON.stringify({
          naics: node.naics,
          isicV4: node.isicV4,
        }),
      );
    }

    const employees = resolve(node.numberOfEmployees);
    let employeeCount = "";

    if (
      typeof employees === "number" &&
      Number.isInteger(employees) &&
      employees >= 0
    ) {
      employeeCount = String(employees);
    } else if (typeof employees === "string") {
      employeeCount = text(employees);
    } else if (isObject(employees)) {
      if (
        typeof employees.value === "number" ||
        typeof employees.value === "string"
      ) {
        employeeCount = String(employees.value);
      } else if (
        typeof employees.minValue === "number" &&
        typeof employees.maxValue === "number"
      ) {
        employeeCount = `${employees.minValue}–${employees.maxValue}`;
      }
    }

    if (employeeCount) {
      companyDetail(
        "employeeCount",
        employeeCount,
        `numberOfEmployees: ${JSON.stringify(employees)}`,
      );
    }

    for (const value of entries(node.address)) {
      const address = resolve(value);
      if (!isObject(address)) continue;

      const country = resolve(address.addressCountry);
      const countryName = isObject(country)
        ? text(country.name)
        : text(country);

      const parts = [
        text(address.streetAddress),
        text(address.addressLocality),
        text(address.addressRegion),
        text(address.postalCode),
        countryName,
      ].filter(Boolean);

      if (parts.length >= 2) {
        add(result.addresses, parts.join(", "), JSON.stringify(address));
      }
    }

    for (const value of entries(node.areaServed)) {
      const area = resolve(value);
      const name = isObject(area) ? text(area.name) : text(area);

      if (name) {
        add(result.serviceAreas, name, `areaServed: ${JSON.stringify(area)}`);
      }
    }

    const logo = resolve(node.logo);
    const logoUrl = webUrl(
      isObject(logo) ? (logo.contentUrl ?? logo.url) : logo,
    );

    if (logoUrl) {
      add(result.logoUrls, logoUrl, `JSON-LD logo: ${JSON.stringify(logo)}`);
    }

    for (const value of entries(node.founder)) {
      addPerson(value, "Founder");
    }

    for (const value of entries(node.employee)) {
      addPerson(value, "Employee");
    }
  }
  // Add addresses printed in ordinary text, preserving source evidence.
  for (const address of extractVisibleAddresses(html, sourceUrl)) {
    add(result.addresses, address.value, address.snippet);
  }
  return result;
}
