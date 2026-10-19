/** Extracts supported business facts from JSON-LD and bounded HTML sections.
 * Heuristic interpretations remain unconfirmed and keep their source evidence. */
import { readableText as readable } from "@/lib/readable-text";
import { serviceLinkPattern } from "@/lib/crawl-priority";
import { socialProfileUrl, isOfferingName } from "@/lib/normalize-extraction";
import * as cheerio from "cheerio";
import type { OfferingCandidate } from "@/lib/extract-page-context";
import type { PersonSignal, Signal } from "@/lib/extract-business-signals";

export interface ContentSignals {
  foundingStory: Signal<string>[];
  serviceAreas: Signal<string>[];
  targetBuyers: Signal<string>[];
  customerNeeds: Signal<string>[];
  differentiators: Signal<string>[];
  partners: Signal<string>[];
  offerings: OfferingCandidate[];
  people: PersonSignal[];
  faqs: {
    question: string;
    answer: string;
    sourceUrl: string;
    snippet: string;
  }[];
  claims: Signal<string>[];
  industry: Signal<string>[];
  businessModel: Signal<string>[];
  companyRole: Signal<string>[];
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const text = (value: unknown) =>
  typeof value === "string" &&
  !/^(null|undefined|none|n\/a)$/i.test(value.trim())
    ? clean(value)
    : "";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

import { claimPattern } from "@/lib/marketing-safety";

/** Read additional evidence without executing scripts or fetching more URLs. */
export function extractContentSignals(
  html: string,
  sourceUrl: string,
): ContentSignals {
  const $ = cheerio.load(html);
  const result: ContentSignals = {
    foundingStory: [],
    serviceAreas: [],
    targetBuyers: [],
    customerNeeds: [],
    differentiators: [],
    partners: [],
    offerings: [],
    people: [],
    faqs: [],
    claims: [],
    industry: [],
    businessModel: [],
    companyRole: [],
  };
  function addFaq(question: string, answer: string, snippet: string) {
    if (
      result.faqs.length >= 20 ||
      question.length < 8 ||
      question.length > 300 ||
      answer.length < 10 ||
      answer.length > 2000 ||
      result.faqs.some(
        (item) => item.question.toLowerCase() === question.toLowerCase(),
      )
    )
      return;
    result.faqs.push({
      question,
      answer,
      sourceUrl,
      snippet: snippet.slice(0, 2500),
    });
  }
  function addOffering(
    name: string,
    description: string,
    snippet: string,
    origin: "extracted" | "inferred" = "inferred",
    priceText: string | null = null,
  ) {
    if (
      !isOfferingName(name) ||
      result.offerings.length >= 40 ||
      name.length < 3 ||
      name.length > 120 ||
      (origin !== "extracted" && description.length < 20) ||
      description.length > 1500 ||
      result.offerings.some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;
    result.offerings.push({
      name,
      description: description || null,
      sourceUrl,
      snippet: snippet.slice(0, 2500),
      priceText,
      origin,
    });
  }

  // Bound structured-data traversal and ignore malformed or unrelated entities.
  const nodes: Record<string, unknown>[] = [];
  function walk(value: unknown, depth = 0) {
    if (depth > 10 || nodes.length >= 300) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
        if (nodes.length >= 300) break;
      }
    } else if (record(value)) {
      nodes.push(value);
      for (const child of Object.values(value)) {
        walk(child, depth + 1);
        if (nodes.length >= 300) break;
      }
    }
  }
  $("script").each((_, element) => {
    if ($(element).attr("type")?.trim().toLowerCase() !== "application/ld+json")
      return;
    const raw = $(element).text();
    if (raw.length > 500_000) return;
    try {
      walk(JSON.parse(raw) as unknown);
    } catch {
      /* Continue with readable HTML. */
    }
  });
  const references = new Map<string, Record<string, unknown>>();
  for (const node of nodes) {
    const id = text(node["@id"]);
    if (id) references.set(id, { ...references.get(id), ...node });
  }
  const resolve = (value: unknown): unknown =>
    record(value) ? { ...references.get(text(value["@id"])), ...value } : value;
  function sameWebsite(value: unknown) {
    try {
      if (!text(value)) return false;
      const url = new URL(text(value), sourceUrl);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.hostname.replace(/^www\./, "") ===
          new URL(sourceUrl).hostname.replace(/^www\./, "")
      );
    } catch {
      return false;
    }
  }
  for (const node of nodes) {
    const types = (
      Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]
    ).map((item) => text(item).split(/[/#]/).pop());
    const ownOrganization =
      types.some((type) =>
        /Organization|Business|Store|Service|Restaurant|Plumber|Dentist|Hotel/.test(
          type ?? "",
        ),
      ) &&
      (text(node.url) ? sameWebsite(node.url) : sameWebsite(node["@id"])) &&
      !types.includes("Service");
    if (ownOrganization) {
      const addNames = (value: unknown, target: Signal<string>[]) => {
        const values = Array.isArray(value) ? value : [value];
        for (const entry of values) {
          const resolved = resolve(entry);
          const name = record(resolved)
            ? text(resolved.name) || text(resolved.audienceType)
            : text(resolved);
          if (name)
            target.push({
              value: name,
              sourceUrl,
              snippet: JSON.stringify(entry),
            });
        }
      };
      addNames(node.audience, result.targetBuyers);
      // Specific schema.org business types are classification suggestions,
      // not legal entity types. Generic Organization/LocalBusiness tell us little.
      for (const type of types) {
        if (
          type &&
          ![
            "Organization",
            "Corporation",
            "LocalBusiness",
            "ProfessionalService",
          ].includes(type)
        )
          result.industry.push({
            value: type.replace(/([a-z])([A-Z])/g, "$1 $2"),
            sourceUrl,
            snippet: JSON.stringify({ "@type": node["@type"], url: node.url }),
          });
      }
      // Relationships must be published; script vendors and external links are not partners.
      addNames(node.sponsor, result.partners);
      addNames(node.memberOf, result.partners);
    }
    if (types.includes("Question")) {
      const answer = resolve(node.acceptedAnswer);
      if (record(answer))
        addFaq(
          text(node.name),
          cheerio.load(text(answer.text), undefined, false).text().replace(/\s+/g, " ").trim(),
          JSON.stringify(node),
        );
    }
    if (
      types.some((type) =>
        ["Product", "Service", "MenuItem"].includes(type ?? ""),
      )
    ) {
      // A published off-site seller/provider or item URL is not this company's offering.
      if (text(node.url) && !sameWebsite(node.url)) continue;
      const provider = resolve(node.provider ?? node.seller);
      if (record(provider) && text(provider.url) && !sameWebsite(provider.url))
        continue;
      const offers = resolve(
        Array.isArray(node.offers) && node.offers.length === 1
          ? node.offers[0]
          : node.offers,
      );
      let price: string | null = null;
      if (record(offers)) {
        const seller = resolve(offers.seller);
        if (record(seller) && text(seller.url) && !sameWebsite(seller.url))
          continue;
        const amount =
          typeof offers.price === "number"
            ? String(offers.price)
            : text(offers.price);
        const currency = text(offers.priceCurrency);
        if (/^\d+(?:\.\d{1,2})?$/.test(amount) && /^[A-Z]{3}$/.test(currency))
          price = `${currency} ${amount}`;
      }
      // Product variants often share a price; preserve a range when they differ.
      // Missing currency/amount or an external seller prevents a price summary.
      if (Array.isArray(node.offers) && node.offers.length > 1) {
        const variants = node.offers.map(resolve).filter(record);
        const currencies = new Set(variants.map((o) => text(o.priceCurrency)));
        const amounts = variants.map((o) => Number(o.price));
        if (variants.length === node.offers.length && currencies.size === 1 && /^[A-Z]{3}$/.test([...currencies][0]) && variants.every((o) => o.price !== null && o.price !== undefined && /^\d+(?:\.\d{1,2})?$/.test(String(o.price)) && (!record(resolve(o.seller)) || !text((resolve(o.seller) as Record<string, unknown>).url) || sameWebsite((resolve(o.seller) as Record<string, unknown>).url)))) {
          const low = Math.min(...amounts), high = Math.max(...amounts);
          price = `${[...currencies][0]} ${low}${low === high ? "" : `–${high}`} (published variants; check selected option)`;
        }
      }
      const before = result.offerings.length;
      addOffering(
        text(node.name),
        cheerio.load(text(node.description), undefined, false).text(),
        JSON.stringify(node),
        "extracted",
        price,
      );
      if (result.offerings.length > before) {
        const item = result.offerings[result.offerings.length - 1];
        item.kind = types.includes("Service") ? "service" : "product";
        item.category = text(node.category) || text(node.serviceType) || null;
        const properties = Array.isArray(node.additionalProperty)
          ? node.additionalProperty
          : [];
        item.features = properties
          .filter(record)
          .map((property) =>
            [
              text(property.name),
              typeof property.value === "number"
                ? String(property.value)
                : text(property.value),
            ]
              .filter(Boolean)
              .join(": "),
          )
          .filter(Boolean)
          .slice(0, 12);
        if (!item.features.length && typeof node.description === "string") {
          const detail = cheerio.load(node.description);
          item.features = detail("li")
            .map((_, el) => clean(detail(el).text()))
            .get()
            .filter((value) => value.length >= 5 && value.length <= 300)
            .slice(0, 12);
        }
        if (!item.features?.length && item.description?.includes("Features:")) {
          const features = item.description.split("Features:")[1]?.trim();
          if (features && features.length <= 1500) item.features = [features];
        }
        if (record(offers)) {
          const context = [
            text(offers.description),
            text(offers.availability),
            text(offers.priceValidUntil)
              ? `Valid until ${text(offers.priceValidUntil)}`
              : "",
          ];
          if (price)
            item.priceText = [price, ...context].filter(Boolean).join("; ");
        }
      }
    }
  }

  $(
    "script, style, noscript, template, nav, header, footer, form, [role='form'], input, select, textarea, [hidden], [aria-hidden='true']",
  ).remove();
  // Testimonials and job advertisements must not become team or product records.
  $(
    "[class*='testimonial'], [class*='review'], [class*='career'], [class*='vacancy'], [class*='blog'], [class*='post-preview'], [class*='post-card']",
  ).remove();
  const content = $("main").length ? $("main").first() : $("body");
  // Social follow controls are not partner names or descriptive passages.
  content.find("a[href]").each((_, el) => {
    try {
      if (socialProfileUrl(new URL($(el).attr("href") ?? "", sourceUrl).href))
        $(el).remove();
    } catch {
      /* Ignore malformed links. */
    }
  });
  const path = new URL(sourceUrl).pathname.replace(/[-_/]+/g, " ");
  const aboutPage = /\b(about|team|story|people|staffbios|companyinfo)\b/i.test(
    path,
  );

  // Keep published wording. A labeled section is evidence, not a generated persona.
  const labels: [
    RegExp,
    keyof Pick<
      ContentSignals,
      | "foundingStory"
      | "serviceAreas"
      | "targetBuyers"
      | "customerNeeds"
      | "differentiators"
      | "partners"
    >,
  ][] = [
    [
      /^(?:our |the )?(?:story|history|beginnings|how we started)$/i,
      "foundingStory",
    ],
    [
      /^(?:our )?(?:service areas?|areas we serve|where we work|where we serve)$/i,
      "serviceAreas",
    ],
    [
      /^(?:who we (?:serve|help|work with)|our customers|our clients|ideal for)$/i,
      "targetBuyers",
    ],
    [
      /^(?:customer needs|problems we solve|challenges we solve|how we help)$/i,
      "customerNeeds",
    ],
    [
      /^(?:why choose us|what makes us different|our difference)$/i,
      "differentiators",
    ],
    [/^(?:our )?(?:partners|suppliers|technology partners)$/i, "partners"],
  ];
  content.find("h1, h2, h3, h4").each((_, element) => {
    const heading = $(element);
    const key = labels.find(([pattern]) =>
      pattern.test(readable(heading)),
    )?.[1];
    if (!key) return;
    let anchor = heading;
    for (let depth = 0; depth < 3 && !anchor.next().length; depth++)
      anchor = anchor.parent();
    const siblings = anchor.nextUntil("h1, h2, h3, h4");
    const passages: string[] = [];
    siblings.each((_, sibling) => {
      const block = $(sibling);
      if (block.find("h1, h2, h3, h4").length) return;
      const value = readable(block);
      if (value.length >= 5 && value.length <= 1500) passages.push(value);
    });
    for (const value of passages.slice(0, 5)) {
      result[key].push({
        value,
        sourceUrl,
        snippet: `${readable(heading)} ${value}`,
      });
    }
  });
  // Published process explanations become editable Q/A references, not a new questionnaire.
  content.find("h2, h3").each((_, element) => {
    const heading = $(element);
    const label = readable(heading);
    if (
      !/^(?:how it works|our process|pricing explained|how pricing works|what happens next)$/i.test(
        label,
      )
    )
      return;
    const answer = heading
      .nextUntil("h1, h2, h3")
      .map((_, el) => readable($(el)))
      .get()
      .join(" ");
    if (answer && answer.length <= 2000)
      addFaq(`${label}?`, answer, `${label} ${answer}`);
  });

  // Self-introductions on team/about pages are explicit names, not name guesses.
  if (aboutPage)
    content.find("p").each((_, element) => {
      const passage = readable($(element));
      const match = passage.match(
        /\b[Mm]y name is\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})(?=[\s,.!]|$)/u,
      );
      if (!match || passage.length > 2000 || result.people.length >= 20) return;
      const name = match[1];
      if (
        result.people.some(
          (person) => person.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return;
      // Do not borrow a nearby person's title or infer a role from a relationship.
      const role =
        passage.match(
          /\b(?:I am|I'm|I’m)\s+(?:the |a |an )?((?:co[- ]?)?founder|photographer|owner|director|manager|designer|editor)\b/i,
        )?.[1] ?? "Team member";
      result.people.push({
        name,
        title: null,
        role,
        background: passage,
        sourceUrl,
        snippet: passage,
      });
    });

  // A dedicated partners/suppliers page supplies relationship context.
  // Ordinary external links elsewhere are not treated as partnerships.
  if (/partners|suppliers/i.test(new URL(sourceUrl).pathname))
    content.find("a[href]").each((_, el) => {
      const link = $(el);
      const row = link.closest("tr");
      // Directory rows may publish a name beside the URL. Avatar alt text is not a partner.
      const name = row.length
        ? readable(row.children("td").first())
        : readable(link);
      if (
        name.length < 3 ||
        name.length > 120 ||
        /^(?:learn more|read more|website|logo|click here|contact)$/i.test(name)
      )
        return;
      try {
        const url = new URL(link.attr("href") ?? "", sourceUrl);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.hostname === new URL(sourceUrl).hostname ||
          /(?:facebook|instagram|linkedin|youtube|twitter)\.com$/i.test(
            url.hostname,
          )
        )
          return;
        if (!result.partners.some((item) => item.value === name))
          result.partners.push({
            value: name,
            sourceUrl,
            snippet: row.length
              ? readable(row)
              : `${name} | ${link.attr("href")}`,
          });
      } catch {
        /* Malformed links are not evidence. */
      }
    });

  // Staff cards need both a name-shaped heading and a nearby published job title.
  // We never derive gender from the name, portrait, or pronouns in a biography.
  const staffPage = /\b(team|people|staff|staffbios|bios)\b/i.test(path);
  if (staffPage || aboutPage)
    content.find("h1,h2,h3,h4,h5,h6").each((_, element) => {
      const heading = $(element);
      const name = readable(heading);
      if (!/^[\p{Lu}][\p{L}’'-]+(?:\s+[\p{Lu}][\p{L}’'-]+){1,3}$/u.test(name))
        return;
      if (
        /\b(our|team|office|department|services?|project|crew|bio)\b/i.test(
          name,
        )
      )
        return;
      let container = heading.parent();
      for (let depth = 0; depth < 3 && container.length; depth++) {
        const headings = container
          .find("h1,h2,h3,h4,h5,h6")
          .filter((_, el) => !/^bio$/i.test(readable($(el))));
        if (headings.length > 1) break;
        const passages = container
          .find("p, [class*='position'], [class*='title']")
          .map((_, el) => readable($(el)))
          .get();
        const title = passages.find(
          (value) =>
            value.length < 120 &&
            /\b(owner|founder|president|officer|director|manager|administrator|accountant|designer|engineer|technician|representative|partner|CPA)\b/i.test(
              value,
            ),
        );
        if (title) {
          if (
            !result.people.some((person) => person.name === name) &&
            result.people.length < 20
          )
            result.people.push({
              name,
              title,
              role: title,
              background:
                passages.find(
                  (value) => value.length >= 120 && value.length <= 1500,
                ) ?? null,
              sourceUrl,
              snippet: readable(container),
            });
          break;
        }
        container = container.parent();
      }
    });

  // A dedicated biography can use "Name, credential" and a separate role heading.
  if (aboutPage) {
    const heading = content.find("h1").first();
    const fullName = readable(heading);
    const name = fullName.replace(/,\s*(?:CPA|PhD|MD|DDS|Esq\.?).*$/i, "");
    if (
      /^[\p{Lu}][\p{L}’'-]+(?:\s+[\p{Lu}][\p{L}’'-]+){1,3}$/u.test(name) &&
      !/\b(about|our|company|story|team|services)\b/i.test(name)
    ) {
      const title = content
        .find("h2,h3")
        .map((_, el) => readable($(el)))
        .get()
        .find(
          (value) =>
            value.length < 150 &&
            /\b(CPA|CFO|controller|founder|owner|director|accountant|doctor|designer)\b/i.test(
              value,
            ),
        );
      const biography = content
        .find("p")
        .map((_, el) => readable($(el)))
        .get()
        .filter(
          (value) =>
            value.length >= 50 &&
            value.length <= 1500 &&
            /^(?:I |my |I’m|I'm)/i.test(value),
        )
        .slice(0, 2)
        .join(" ");
      if (
        title &&
        biography &&
        !result.people.some((person) => person.name === name)
      )
        result.people.push({
          name,
          title,
          role: title,
          background: biography,
          sourceUrl,
          snippet: `${fullName} ${title} ${biography}`,
        });
    }
  }

  // Native disclosure widgets provide an unambiguous question/answer boundary.
  content.find("details").each((_, element) => {
    const block = $(element);
    const summary = block.children("summary").first();
    const question = readable(summary);
    if (!question.endsWith("?")) return;
    const answer = block.clone();
    answer.find("summary").first().remove();
    addFaq(question, readable(answer), readable(block));
  });
  // On a clearly labeled FAQ page, follow document order until the next heading.
  // This supports page builders that put each question/answer in separate wrappers.
  const faqPage =
    /\bfaqs?\b/i.test(path) ||
    /frequently asked questions/i.test(content.find("h1, h2").text());
  if (faqPage) {
    // Some FAQ pages put a bold question and its answer in one paragraph.
    content.find("p").each((_, el) => {
      const value = readable($(el));
      const match = value.match(
        /^((?:what|how|where|when|why|who|do|does|can|is|are|will|should|which)\b[^?]{5,280}\?)\s+(.{10,2000})$/i,
      );
      if (match) addFaq(match[1], match[2], value);
    });
    let question = "";
    let answers: string[] = [];
    const flush = () => {
      if (question && answers.length)
        addFaq(question, answers.join(" "), `${question} ${answers.join(" ")}`);
    };
    content
      .find("h1, h2, h3, h4, h5, p, summary, button")
      .each((_, element) => {
        const node = $(element);
        const value = readable(node);
        if (!value) return;
        if (element.tagName !== "p") {
          flush();
          answers = [];
          question = value.endsWith("?") ? value : "";
        } else if (
          question &&
          !node.find("p").length &&
          answers.join(" ").length + value.length <= 2000
        ) {
          answers.push(value);
        }
      });
    flush();
  }
  // Other FAQ layouts: require exactly one question and an answer in a small block.
  content.find("h2, h3, h4, button, [itemprop='name']").each((_, element) => {
    const question = readable($(element));
    if (!question.endsWith("?") || question.length > 300) return;
    // A question mark alone does not make a blog title or sales CTA a FAQ.
    if (
      !faqPage &&
      !$(element).closest(
        "[class*='faq'], [id*='faq'], [class*='accordion'], [itemtype*='Question']",
      ).length
    )
      return;
    if (/^(?:ready to|want to|looking for|need help)/i.test(question)) return;
    let container = $(element).parent();
    for (let depth = 0; depth < 3 && container.length; depth++) {
      const block = readable(container);
      if (block.length > 2500) break;
      const questions = container
        .find("h2, h3, h4, button")
        .filter((_, candidate) => readable($(candidate)).endsWith("?"));
      if (questions.length > 1) break;
      const answers = container
        .find("p, [itemprop='text'], [class*='answer']")
        .filter(
          (_, candidate) =>
            $(candidate).find("p, h2, h3, h4, button").length === 0,
        )
        .map((_, candidate) => readable($(candidate)))
        .get()
        .filter((value) => value.length >= 10 && value !== question);
      if (answers.length) {
        addFaq(question, answers.join(" "), block);
        break;
      }
      container = container.parent();
    }
  });

  // A dedicated service landing page may describe one offering under its H1.
  // Require a service-bearing path AND title, plus a nearby published description.
  if (
    serviceLinkPattern.test(path) &&
    !/\b(?:industry|industries|blog|news)\b/i.test(path)
  ) {
    const heading = content.find("h1").first();
    const name = readable(heading);
    if (serviceLinkPattern.test(name) && isOfferingName(name)) {
      let anchor = heading;
      for (let depth = 0; depth < 3 && !anchor.next().length; depth++)
        anchor = anchor.parent();
      const nearby = anchor.nextUntil("h1,h2,h3");
      const description = nearby
        .filter("p")
        .add(nearby.find("p"))
        .map((_, el) => readable($(el)))
        .get()
        .find((value) => value.length >= 30 && value.length <= 1500);
      if (description) {
        const before = result.offerings.length;
        addOffering(name, description, `${name} ${description}`);
        if (result.offerings.length > before)
          result.offerings[result.offerings.length - 1].kind = "service";
      }
    }
  }

  // On general pages, only consider headings with a commercial context.
  const offeringWord =
    /\b(?:services?|products?|membership|training|photography|portraits?|sessions?|packages?|consulting|repair|installation|cleaning|catering|lessons?|classes?|plans?)\b/i;
  content.find("h2, h3, h4").each((_, element) => {
    if (staffPage) return;
    // Product detail headings describe one product's options, ingredients or benefits.
    if (/\/products?\/[^/]+/.test(new URL(sourceUrl).pathname) && result.offerings.some((item) => item.origin === "extracted" && item.kind === "product")) return;
    const heading = $(element);
    const name = readable(heading);
    const section = heading.closest(
      "section, article, [class*='section'], [class*='product'], [class*='service'], [class*='membership'], [class*='pricing']",
    );
    const contextLabel = `${section.attr("class") ?? ""} ${section.find("h1, h2").first().text()}`;
    let compactCard = heading.parent();
    let priceCard = false;
    for (let depth = 0; depth < 4 && compactCard.length; depth++) {
      if (compactCard.find("h1, h2, h3, h4").length !== 1) break;
      const cardText = readable(compactCard);
      if (cardText.length > 3000) break;
      if (
        /[$£€]/.test(cardText) &&
        /(?:\/\s*(?:mo|month|year)|per month|monthly)/i.test(cardText) &&
        (compactCard.find("li").length >= 2 ||
          compactCard
            .find("p")
            .toArray()
            .some((item) => readable($(item)).length >= 20))
      ) {
        priceCard = true;
        break;
      }
      compactCard = compactCard.parent();
    }
    const commercialContext =
      /\b(?:services?|products?|memberships?|pricing|plans?|packages?)\b/i.test(
        contextLabel,
      ) || priceCard;
    if (
      (!offeringWord.test(name) && !commercialContext) ||
      /\?|\b(?:why|about|meet|team|reviews?|testimonials?|careers?|jobs?|faq)\b/i.test(
        name,
      ) ||
      /^(?:our |all )?(?:services?|products?|memberships?|packages?|plans?|photography)$/i.test(
        name,
      ) ||
      /\b(?:founder|editor|owner|team member)\b/i.test(name) ||
      /^(?:our )?photographers?$/i.test(name)
    )
      return;
    let container = priceCard ? compactCard : heading.parent();
    for (let depth = 0; depth < 4 && container.length; depth++) {
      if (container.find("h1, h2, h3, h4").length !== 1) break;
      const block = readable(container);
      if (block.length > 3000) break;
      const description =
        container
          .find("p, [class*='description'], [itemprop='description']")
          .filter(
            (_, candidate) =>
              $(candidate).find("p, h1, h2, h3, h4").length === 0,
          )
          .map((_, candidate) => readable($(candidate)))
          .get()
          .find((value) => value.length >= 20 && value !== name) ??
        (priceCard
          ? container
              .find("li")
              .slice(0, 5)
              .map((_, item) => readable($(item)))
              .get()
              .join("; ")
          : "");
      if (description) {
        const before = result.offerings.length;
        addOffering(name, description, block);
        if (result.offerings.length > before) {
          const item = result.offerings[result.offerings.length - 1];
          item.features = container
            .find("li")
            .map((_, li) => readable($(li)))
            .get()
            .filter((v) => v.length >= 5 && v.length <= 300)
            .slice(0, 12);
          const price = container
            .find("[class*='price'], [itemprop='price']")
            .map((_, el) => readable($(el)))
            .get()
            .find(
              (value) =>
                value.length <= 200 &&
                (value.match(/[$£€]\s*\d[\d,]*(?:\.\d{1,2})?/g)?.length ??
                  0) === 1,
            );
          if (price) item.priceText = price;
          if (/\bservices?\b/i.test(contextLabel)) item.kind = "service";
          else if (/\bproducts?\b/i.test(contextLabel)) item.kind = "product";
        }
        break;
      }
      container = container.parent();
    }
  });

  const brandName = text($("meta[property='og:site_name']").attr("content"));
  if (aboutPage && brandName)
    content.find("p").each((_, el) => {
      const passage = readable($(el));
      if (
        passage.length > 1500 ||
        !passage.toLowerCase().includes(brandName.toLowerCase())
      )
        return;
      if (
        /\b(?:began|founded|established|started|origins)\b/i.test(passage) &&
        /\b(?:19|20)\d{2}\b/.test(passage)
      )
        result.foundingStory.push({
          value: passage,
          sourceUrl,
          snippet: passage,
        });
    });

  // Preserve relevant sentences; do not invent services by rewriting them.
  content.find("p, li").each((_, element) => {
    if ($(element).find("p, li").length) return;
    const passage = readable($(element));
    if (passage.length < 20 || passage.length > 1500) return;
    const sentences = passage.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [passage];
    for (const raw of sentences) {
      const sentence = clean(raw);
      if (
        claimPattern.test(sentence) &&
        result.claims.length < 20 &&
        !result.claims.some(
          (item) => item.value.toLowerCase() === sentence.toLowerCase(),
        )
      ) {
        result.claims.push({ value: sentence, sourceUrl, snippet: passage });
      }
      // Explicit self-descriptions supplement labeled sections without guessing a persona.
      // Avoid quoted customer/reviewer passages collected inside blockquotes.
      if (!$(element).closest("blockquote").length) {
        const ownSignals: [
          RegExp,
          "foundingStory" | "targetBuyers" | "customerNeeds",
        ][] = [
          [
            /^(?:we (?:started|founded|established)|our (?:company|business|practice) (?:began|started|was founded))\b/i,
            "foundingStory",
          ],
          [
            /^we (?:work with|serve|support)\s+.*\b(?:customers|businesses|homeowners|families|students|patients|teams|organizations|clients)\b/i,
            "targetBuyers",
          ],
          [
            /^we help\s+.{3,150}\b(?:solve|manage|reduce|avoid|understand|maintain|repair)\b/i,
            "customerNeeds",
          ],
        ];
        for (const [pattern, key] of ownSignals) {
          if (
            pattern.test(sentence) &&
            result[key].length < 20 &&
            !result[key].some((item) => item.value === sentence)
          )
            result[key].push({ value: sentence, sourceUrl, snippet: passage });
        }
      }
      // Only an explicit first-person service statement becomes a suggestion.
      const match = sentence.match(
        /\bwe (?:offer|provide|speciali[sz]e in)\s+([^.!?]{5,100})/i,
      );
      if (match && offeringWord.test(match[1]) && !/[,;]|\b(?:any|every|more|and|for)\b/i.test(match[1]))
        addOffering(match[1], sentence, passage);
      // Category names must be explicit in a company statement, not staff titles.
      if (/\b(?:we|our)\b/i.test(sentence)) {
        const servicePhrase = sentence.match(
          /\b(?:wedding|event|portrait|family|commercial|product|real estate|newborn|sports)(?:\s+(?:and|&|wedding|event|portrait|family|commercial|product|real estate|newborn|sports)){0,4}\s+photograph(?:y|ers?)\b/i,
        )?.[0];
        if (servicePhrase) addOffering(servicePhrase, sentence, passage);
      }
      if (
        /\b(?:we are|we're|we’re|our company is)\s+(?:a |an )?(?:manufacturer|retailer|wholesaler|distributor|service provider)\b/i.test(
          sentence,
        )
      ) {
        const role = sentence.match(
          /\b(manufacturer|retailer|wholesaler|distributor|service provider)\b/i,
        )?.[0];
        if (role && result.companyRole.length < 5)
          result.companyRole.push({
            value: role,
            sourceUrl,
            snippet: sentence,
          });
      }
      if (
        /\b(?:subscription[- ]based|membership[- ]based|business[- ]to[- ]business|business[- ]to[- ]consumer)\b/i.test(
          sentence,
        )
      ) {
        const model = sentence.match(
          /\b(?:subscription[- ]based|membership[- ]based|business[- ]to[- ]business|business[- ]to[- ]consumer)\b/i,
        )?.[0];
        if (model && result.businessModel.length < 5)
          result.businessModel.push({
            value: model,
            sourceUrl,
            snippet: sentence,
          });
      }
    }
  });
  // Explicit category words provide suggestions, never verified industry labels.
  const meta =
    $("meta[name='description'], meta[property='og:description']")
      .first()
      .attr("content") ?? "";
  const summary = clean(
    `${$("title").text()} ${meta} ${content.find("h1").first().text()}`,
  );
  const categories: [RegExp, string][] = [
    [
      /\b(?:bookkeeping|accounting|tax preparation)\b/i,
      "Accounting / bookkeeping",
    ],
    [/\bpest control\b/i, "Pest control"],
    [/\b(?:house|home|residential|commercial|office) ?cleaning(?: services?)?\b/i, "Cleaning services"],
    [/\b(?:cleaning products|detergent)\b/i, "Household cleaning products"],
    [/\b(?:dental|dentist)\b/i, "Dental care"],
    [/\b(?:law firm|legal services)\b/i, "Legal services"],
    [/\b(?:landscaping|lawn care)\b/i, "Landscaping"],
    [/\b(?:software|saas)\b/i, "Software"],
    [/\b(?:salon|barbershop|haircuts?)\b/i, "Hair salon / barbershop"],
    [/\b(?:coffee shop|cafe|café)\b/i, "Café / coffee shop"],
    [/\brestaurant\b/i, "Restaurant"],
    [/\b(?:photography|photographers?)\b/i, "Photography"],
    [/\b(?:fitness|gym)\b/i, "Fitness"],
    [/\b(?:plumbing|plumbers?)\b/i, "Plumbing"],
    [/\b(?:bakery|bakeries)\b/i, "Bakery"],
  ];
  // Customer-sector pages describe buyers, not the publisher's industry.
  const identityPage =
    new URL(sourceUrl).pathname === "/" ||
    /^\/(?:about|about-us|our-story)\/?$/i.test(new URL(sourceUrl).pathname);
  const identitySummary = summary.split(
    /\b(?:for|serving|customers include)\b/i,
  )[0];
  for (const [pattern, value] of categories)
    if (identityPage && pattern.test(identitySummary))
      result.industry.push({
        value,
        sourceUrl,
        snippet: summary.slice(0, 1500),
      });
  return result;
}
