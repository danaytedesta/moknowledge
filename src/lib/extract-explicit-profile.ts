/** Maps published labels to rare baseline fields without filling them by guesswork. */
import * as cheerio from "cheerio";
import type { Signal } from "@/lib/extract-business-signals";

export type ExplicitKey =
  | "pitch"
  | "persona"
  | "industryGroupings"
  | "industryOutlook"
  | "channels"
  | "funnels"
  | "artStyle"
  | "writingStyle"
  | "businessModel"
  | "mainAddress";
export type ExplicitProfile = Record<ExplicitKey, Signal<string>[]>;

// Rare baseline fields need an explicit label, not a plausible guess.
// For example, a stock photo does not tell us the company's art direction.
export function extractExplicitProfile(
  html: string,
  sourceUrl: string,
): ExplicitProfile {
  const $ = cheerio.load(html);
  $(
    "script, style, nav, footer, header, form, blockquote, [hidden], [class*='testimonial'], [class*='blog']",
  ).remove();
  const result: ExplicitProfile = {
    pitch: [],
    persona: [],
    industryGroupings: [],
    industryOutlook: [],
    channels: [],
    funnels: [],
    artStyle: [],
    writingStyle: [],
    businessModel: [],
    mainAddress: [],
  };
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const labels: [RegExp, ExplicitKey][] = [
    [/^(?:our |company )?(?:pitch|value proposition|mission|our mission|purpose)$/, "pitch"],
    [
      /^(?:our )?(?:ideal customer|ideal customer persona|ideal client|who is this for|who we help)$/,
      "persona",
    ],
    [
      /^(?:our )?(?:industry groupings|sectors|industries served|industries we serve|sectors we serve)$/,
      "industryGroupings",
    ],
    [/^(?:industry|market) outlook$/, "industryOutlook"],
    [/^(?:our |sales |marketing )?channels$/, "channels"],
    [/^(?:our |sales |marketing )?funnels?$/, "funnels"],
    [/^(?:our )?(?:art style|visual style|art direction|visual identity|design language)$/, "artStyle"],
    [/^(?:our )?(?:writing style|brand voice|tone of voice|voice and tone)$/, "writingStyle"],
    [/^(?:our )?business model$/, "businessModel"],
    [/^(?:headquarters|head office|main office|main address)$/, "mainAddress"],
  ];
  $("h1,h2,h3,h4,dt,p,li").each((_, el) => {
    const node = $(el);
    if (node.find("p,li,h1,h2,h3,h4").length) return;
    const full = clean(node.text());
    const colon = full.indexOf(":");
    const label = (colon >= 0 ? full.slice(0, colon) : full).toLowerCase();
    const key = labels.find(([regex]) => regex.test(label))?.[1];
    if (!key) return;
    let value = colon >= 0 ? full.slice(colon + 1).trim() : "";
    if (!value) {
      let anchor = node;
      // Handle a heading wrapped alone in a page-builder div.
      for (let depth = 0; depth < 3 && !anchor.next().length; depth++)
        anchor = anchor.parent();
      value = anchor
        .nextUntil("h1,h2,h3,h4,dt")
        .map((_, sibling) => {
          const block = $(sibling);
          return block.find("h1,h2,h3,h4,dt").length ? "" : clean(block.text());
        })
        .get()
        .filter(Boolean)
        .slice(0, 3)
        .join(" ");
    }
    if (value.length >= 5 && value.length <= 1500 && result[key].length < 10)
      result[key].push({
        value,
        sourceUrl,
        snippet: `${full}${colon >= 0 ? "" : " " + value}`,
      });
  });
  return result;
}
