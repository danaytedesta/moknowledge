/** Shared text normalization and conservative filters for scraper candidates. */
import * as cheerio from "cheerio";

// Decode published entities once without interpreting angle brackets as markup.
// React still renders every returned value as text.
export function decodePublishedText(value: string): string {
  const escaped = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return cheerio
    .load(escaped, undefined, false)
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

// Compare address variants without altering the displayed, sourced wording.
// Keep unit/section numbers: two suites in the same building are not duplicates.
export function addressKey(value: string): string {
  // Normalize state names only immediately before a US ZIP code.
  // This avoids changing a street named "Texas Road" or collapsing different units.
  const states: Record<string, string> = Object.fromEntries(
    "Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|Connecticut:CT|Delaware:DE|Florida:FL|Georgia:GA|Hawaii:HI|Idaho:ID|Illinois:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|Louisiana:LA|Maine:ME|Maryland:MD|Massachusetts:MA|Michigan:MI|Minnesota:MN|Mississippi:MS|Missouri:MO|Montana:MT|Nebraska:NE|Nevada:NV|New Hampshire:NH|New Jersey:NJ|New Mexico:NM|New York:NY|North Carolina:NC|North Dakota:ND|Ohio:OH|Oklahoma:OK|Oregon:OR|Pennsylvania:PA|Rhode Island:RI|South Carolina:SC|South Dakota:SD|Tennessee:TN|Texas:TX|Utah:UT|Vermont:VT|Virginia:VA|Washington:WA|West Virginia:WV|Wisconsin:WI|Wyoming:WY|District of Columbia:DC"
      .toLowerCase()
      .split("|")
      .map((pair) => pair.split(":")),
  );
  const normalized = value
    .toLowerCase()
    .replace(
      new RegExp(
        "\\b(" + Object.keys(states).join("|") + ")(?=[, ]+\\d{5}\\b)",
        "g",
      ),
      (state) => states[state],
    );
  return normalized
    .toLowerCase()
    .replace(/^[^:]{1,80}:\s*(?=\d)/, "")
    .replace(/,\s*(?:us|usa|united states(?: of america)?)\.?\s*$/, "")
    .replace(/\(\s*(?:inside|located in)\s+[^)]{1,120}\)/g, " ")
    .replace(
      /\b(?:suite|ste|unit|apartment|apt)\.?\s*#?\s*([a-z0-9-]+)/g,
      " unit $1 ",
    )
    .replace(/#\s*([a-z0-9-]+)/g, " unit $1 ")
    .replace(/\b(?:street|st)\b/g, "st")
    .replace(/\b(?:avenue|ave)\b/g, "ave")
    .replace(/\b(?:boulevard|blvd)\b/g, "blvd")
    .replace(/\b(?:road|rd)\b/g, "rd")
    .replace(/\b(?:drive|dr)\b/g, "dr")
    .replace(/\b(?:north|south|east|west)\b/g, (word) => word[0])
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// These are extraction candidates, not owner-created offering records.
export function isOfferingName(value: string): boolean {
  if (/^(?:popular|featured|residential|commercial) services$|^(?:scent|size|quantity|count|fragrance|options?)(?:\b|$)|^(?:this product|operating with|formulated in|made in)|\b(?:tips|guidelines|techniques|lower emissions|powerful clean|ingredient layers?)\b|^free .*quotes?$/i.test(value)) return false;
  if (
    /^(?:select|choose|get|think|what|how|why|behind|paying|three ways|\d+ years)\b/i.test(
      value,
    )
  )
    return false;
  if (
    /\b(?:you|your|we|our|obsessing|actually|pricing|money|newsletter)\b/i.test(
      value,
    )
  )
    return false;
  // Variant selector labels can appear outside a form on subscription pages.
  if (/\b(?:scent|size|quantity)\s*:?$/i.test(value)) return false;
  if (value.split(/\s+/).length > 9) return false;
  if (
    /\?|\b(?:testimonials?|careers?|why choose|our team|latest news|privacy|guarantee|customer reviews|how it works|our process|benefits|contact us|get in touch|free .*estimate|newsletter|form)\b/i.test(
      value,
    )
  )
    return false;
  if (
    /^(?:welcome|learn more|read more|what we do|who we are|quality|experience|our story|frequently asked questions)$/i.test(
      value,
    )
  )
    return false;
  if (value.length < 3 || value.length > 120) return false;
  if (
    /^(?:call|contact|book|request|learn|view|click|order now|shop now|sign up|join now|get (?:a |an |your )?(?:free |instant )?(?:quote|estimate|discount))\b/i.test(
      value,
    )
  )
    return false;
  if (/^(?:save\b|we will\b|we are\b|why choose\b)/i.test(value)) return false;
  if (/(?:[$£€]\s*\d|\d+\s*%).*\b(?:off|discount|savings?)\b/i.test(value))
    return false;
  if (/\b(?:show up on time|on[- ]time guarantee)\b/i.test(value)) return false;
  if (/^(?:all|our|expert)\s+.*\b(?:services?|repairs?)\b/i.test(value))
    return false;
  return !/^(?:menu|services|products|pricing|shop|contact|about|locations)$/i.test(
    value,
  );
}

// Return canonical profile URLs; posts, reels, videos, and share controls are
// content links, so they do not belong in the business's social-profile list.
export function socialProfileUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    return null;
  let host = url.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);
  const first = (segments[0] ?? "").toLowerCase();
  let path = url.pathname.replace(/\/+$/, "");
  let query = "";
  if (host === "instagram.com") {
    if (
      segments.length !== 1 ||
      [
        "p",
        "reel",
        "reels",
        "stories",
        "tv",
        "explore",
        "accounts",
        "direct",
      ].includes(first)
    )
      return null;
    path = `/${first}`;
  } else if (host === "twitter.com" || host === "x.com") {
    if (
      segments.length !== 1 ||
      [
        "intent",
        "share",
        "home",
        "i",
        "hashtag",
        "search",
        "explore",
        "login",
      ].includes(first)
    )
      return null;
    host = "x.com";
    path = `/${first}`;
  } else if (host === "facebook.com") {
    if (
      !segments.length ||
      /(?:^|\/)(?:posts|reels?|videos?|watch|sharer(?:\.php)?|share(?:\.php)?|dialog|groups|events|photo(?:\.php)?|photos)(?:\/|$)/i.test(
        path,
      )
    )
      return null;
    if (first === "profile.php") {
      const id = url.searchParams.get("id");
      if (!id || !/^\d+$/.test(id)) return null;
      query = `?id=${id}`;
    } else if (
      segments.length !== 1 &&
      !(first === "pages" && segments.length === 3)
    )
      return null;
    path = path.toLowerCase();
  } else if (host === "youtube.com") {
    if (
      !(segments.length === 1 && first.startsWith("@")) &&
      !(segments.length === 2 && ["channel", "user", "c"].includes(first))
    )
      return null;
  } else if (host === "tiktok.com") {
    if (segments.length !== 1 || !first.startsWith("@")) return null;
    path = `/${first}`;
  } else if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    if (
      segments.length !== 2 ||
      !["company", "in", "school", "showcase"].includes(first)
    )
      return null;
    host = "linkedin.com";
    path = path.toLowerCase();
  } else if (host === "pinterest.com") {
    if (segments.length !== 1 || ["pin", "search", "ideas"].includes(first))
      return null;
    path = `/${first}`;
  } else return null;
  return `https://${host}${path}${query}`;
}
