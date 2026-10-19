/** Finds explicitly printed US addresses in small blocks; other formats use JSON-LD. */
import { readableText } from "@/lib/readable-text";
import * as cheerio from "cheerio";

interface AddressCandidate {
  value: string;
  sourceUrl: string;
  snippet: string;
}

// Fallback for US addresses printed as ordinary page text.
// Structured-data extraction still handles other address formats.
export function extractVisibleAddresses(
  html: string,
  sourceUrl: string
): AddressCandidate[] {
  const $ = cheerio.load(html);

  // Avoid collecting script contents or explicitly hidden elements.
  $("script, style, noscript, template, [hidden], [aria-hidden='true']")
    .remove();

  const results = new Map<string, AddressCandidate>();

  // Require a street number, street suffix, city, state, and ZIP.
  // Do not cross lines or consume another bare number as a street-name word.
  // This prevents a phone suffix, location number, or next address joining in.
  // Alphanumeric names such as "42nd" still work; unusual formats may be missed.
  const pattern =
    /\b(\d{1,6}[ \t]+(?:(?=[A-Za-z0-9.'’\-]*[A-Za-z])[A-Za-z0-9.'’\-]+[ \t]+){1,8}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Highway|Hwy|Parkway|Pkwy|Place|Pl|Terrace|Ter|Circle|Cir)\.?(?:[ \t]+(?:N|S|E|W|NE|NW|SE|SW)\b)?(?:[ \t]*(?:,?[ \t]*(?:Suite|Ste|Unit|Apt)\.?[ \t]*|#)[A-Za-z0-9-]+)?)\s*[,;\n]\s*([A-Za-z][A-Za-z .’'-]{1,60}?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/gi;

  const states = new Set(
    (
      "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA " +
      "ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK " +
      "OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC"
    ).split(" ")
  );

  // Search compact blocks, avoiding entire-page text that could
  // incorrectly combine neighboring locations.
  $("p, address, li, div").each((_, element) => {
    if (results.size >= 20) return;

    // Skip large containers before any descendant processing. Never clone a
    // whole directory page for every div: that made large location pages slow.
    if ($(element).text().length > 1200) return;
    const block = readableText($(element), true);

    if (block.length < 15 || block.length > 600) return;

    for (const match of block.matchAll(pattern)) {
      const state = match[3].toUpperCase();
      if (!states.has(state)) continue;

      const street = match[1].replace(/\s+/g, " ").trim();
      const city = match[2].replace(/\s+/g, " ").trim();
      const value = `${street}, ${city}, ${state} ${match[4]}`;
      const key = value.toLowerCase();

      if (!results.has(key)) {
        results.set(key, {
          value,
          sourceUrl,
          snippet: match[0].trim(),
        });
      }

      if (results.size >= 20) break;
    }
  });

  return [...results.values()];
}