## Live demo

[Try MoKnowledge](https://moknowledge-mp4xa5pjn-danaytedesta.vercel.app)

Enter a business website, review the extracted information, and save or export a profile. Saved profiles stay in your current browser.
# MoKnowledge

MoKnowledge turns a business website into an editable knowledge profile. I built this for the MoFlo interview assignment while learning TypeScript, with AI assistance. It helps a small-business owner review useful information once and reuse it in instructions for social posts, emails, and blog articles.

## Run locally

Use Node.js 24 LTS (the dependency versions in this project need a recent Node release) and npm. No API key or environment file is required.

```powershell
cd moknowledge
npm ci
npm run dev
```

Open [the builder](http://localhost:3000/knowledge). Saved profiles are at [/knowledge/view](http://localhost:3000/knowledge/view).

`npm ci` installs the dependencies from the lockfile. It is needed for a fresh setup; you do not need to repeat it every time you run the app. For an already working installation with unchanged dependencies, use `npm run dev`.

To run the checks and then try the production version:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm start
```

Stop the development server before starting the production server on the same port. 
## What works

- Enter a public website URL and collect real HTML on the server. The builder shows a loading state, errors, and partial-crawl warnings. Progress is an activity indicator, not a measured download percentage.

- Review a summary first. Six existing editor sections keep detailed fields optional. Only company name and website are required to save.

- Edit fields, inspect evidence, and confirm important information. Editing clears that field's confirmation while retaining its original website evidence.

- Save profiles in this browser, reopen them, search, use cards or a table, edit, delete, and download JSON. There is no cloud synchronization or JSON import screen.

- Set offering priorities (promote more, normal, paused, waitlist), price preferences, voice, audience, claims, and the customer's next action.

- Compile channel-specific writing instructions with reasons for omitted information. This produces a rules-based brief, not finished AI content.

- Use a small customer decision map built from published FAQs and process explanations. Its Q/A records remain in the existing Business details editor; the overview gives a short preview. Topic grouping is rule-based and recomputed from the edited Q/A each time a brief is compiled.

## Architecture

Next.js 15 App Router, TypeScript, Tailwind CSS, React hooks, and React context.

1. `src/app/knowledge/page.tsx` sends the URL to `src/app/api/scrape/route.ts`.

2. `fetch-website.ts` downloads HTML. It validates URLs and resolved public addresses, limits response size, time and redirects, and rejects private destinations.

3. `crawl-website.ts` reads the starting page and attempts at most six related pages, discovered on the starting page or one link level beyond, with a 45-second collection deadline. It considers about, offering, FAQ/process, staff, contact and partner pages. Parent service-menu labels help identify links. Employment, blog and quote-request links are excluded. Download waits have a deadline race, HTML complexity is bounded, and the browser stops waiting after 60 seconds. Synchronous parsing cannot be interrupted by a JavaScript timer, so the server deadline is checked between bounded operations. Large or slow pages can still be skipped with warnings.

4. `extract-knowledge.ts`, `extract-page-context.ts`, and the business/content signal helpers parse metadata, JSON-LD, headings and nearby text with Cheerio.

5. `build-knowledge-base.ts`, `enrich-knowledge-base.ts`, and `apply-business-signals.ts` assemble the typed profile and its evidence. The latter also applies content signals and `refine-profile.ts`, which handles evidence-based company interpretations and calls `refine-baseline.ts` for audience, needs, relationship statements and labeled suggestions. `readable-text.ts` reads text without cloning large page trees.

6. The editors share a profile through React state; `knowledge-context.tsx` coordinates the saved list and `knowledge-storage.ts` uses localStorage.

7. `compile-marketing-brief.ts` selects appropriate information. `customer-decision-map.ts` derives decision topics from the current FAQs, so there is no second copy to become stale.

## Extraction and data quality

A field is `{ value, origin, evidence, confirmedAt, updatedAt }`. Unknown scalar values stay `null`; empty lists mean nothing was collected. Origin can be extracted, inferred, measured, or owner. A confirmation date is a separate owner decision, not independent verification.

Explicit JSON-LD can supply company details, people, products/services, category, feature properties and prices. Same-site organization checks and off-site seller/provider checks reduce unrelated entity matches. Clear headings such as “Who we serve,” “Service areas,” “Our story,” and “Our partners” provide bounded passages. Product/service cards need nearby descriptions; generic headings and navigation actions are rejected. HTML offering identification remains inferred. Repeated offering names merge across pages; differing published prices remain unknown with evidence and a warning. Selection controls and promotional slogans are excluded. Explicit structured offerings are extracted. Missing service categories can receive an inferred label from their own offering names; product categories still need published data. Product-detail subheadings are not separate products when a structured product identifies the page. Published variant prices become a qualified price range when amounts and currency are clear.

Prices retain available wording such as units and qualifications; ambiguous visible prices are left blank. Colors/fonts are measurements from inline/embedded CSS, not verified brand guidelines. Writing-style measurement reports sentence length and direct reader-address patterns, not a guessed personality. Image logo candidates need business-name/asset evidence or a same-origin home-linked header location; structured logos remain supported. Logo identification and title-based business names remain suggestions. Staff/about cards require a name and a nearby published title. Dedicated biographies can use a credentialed name heading and separate role heading. FAQ paragraphs containing both a question and an answer are supported. Form controls, staff cards and blog previews are excluded from offering/FAQ matching. No live AI enrichment runs.

Conflicting founding years and explicit company details stay unknown with retained evidence and warnings. Conflicting FAQ answers retain the first answer plus alternative evidence, become inferred, and require confirmation before entering a brief. Different page descriptions can be legitimate page summaries; the first remains selected with a warning and all candidate evidence. This is conservative conflict handling, not semantic fact checking.

The baseline schema includes every assignment category, but automatic coverage is partial. Founding stories, service areas, buyers, needs, differentiators and partners depend on recognizable labels or supported structured fields. Persona and pitch can receive clearly labeled, unconfirmed rule-based summaries from sourced descriptions and audiences. Contact/order channels can be inferred from published CTAs. Published step sequences can supply a funnel/process description. Industry outlook and art direction still require explicit wording; no forecasts or image analysis are invented. Testimonials, topics and some trust fields still normally require owner input. Gender is collected only from an explicitly stated structured founder/employee record or owner input, never guessed. Employee counts require explicit supported data. Legal-form labels, structured legal names and explicit company-name suffixes are supported; these are published designations, not independent registration checks. Business-model and company-role interpretations are marked inferred. Industry keyword suggestions are restricted to identity pages, not customer-sector pages. We do not invent awards, guarantees or outcomes. See the field-by-field [baseline coverage](baseline-coverage.md) and the development decisions in [development-notes.txt](development-notes.txt).

## How the briefs use the knowledge

MoSocial gets instructions for a concise opening, one relevant customer question, offering priorities and voice choices. MoMail gets guidance for a subject line, a customer concern and one next step. MoBlogs gets guidance for an explanatory article using decision questions. These are writing instructions, not generated posts, emails or articles. All three use the same profile and its current review settings.

Ordinary sourced information may be referenced without confirming every field. Inferred values and owner edits require confirmation. Prices need a selected type and confirmation within 90 days. Claims need explicit approval, confirmation within 365 days and a future review date. Pauses remain paused after their review date. Q/A containing price or financial-commitment language is omitted conservatively; approved offering pricing is the place to control prices. Q/A mentioning paused/waitlisted offerings is also omitted. Matching is rule-based, so aliases and subtle claims can still escape detection: review the brief before using it.

## Schema and future AI

The current JSON shape is in [src/types/knowledge.ts](src/types/knowledge.ts). `schemaVersion` stays 1.0 because the decision map derives from existing FAQ records without a breaking field change.

[database-schema.md](database-schema.md) proposes Supabase/PostgreSQL tables, relationships, memberships, RLS considerations and version history. It is a design only: no database, authentication or migrations are implemented.

[prompts/enrichment-prompts.md](prompts/enrichment-prompts.md) contains future enrichment prompts. They are separate from today's rules-based application. I would use an LLM for evidence-grounded summaries and suggestions, validate its output, and keep uncertainty visible. Other possible sources are owner-approved business listings, verified social profiles and uploaded brand guidelines. Each would need source dates, permission and conflict handling.

## Example and screenshots

The current real-HTML examples include [Molly Maid](examples/molly-maid-scraper-output.json), [Blueland](examples/blueland-scraper-output.json), [Bishops](examples/bishops-scraper-output.json), [Bench](examples/bench-scraper-output.json), and [Ugmonk](examples/ugmonk-scraper-output.json). These were produced with the application extraction pipeline from downloaded HTML, with no owner edits or confirmations. See the provenance notes for collection limitations.

[examples/bee-cave-scraper-output.json](examples/bee-cave-scraper-output.json) is an earlier pipeline output from seven real downloaded Bee Cave Drilling pages, with no owner edits. It includes six offerings, 19 people, published founding information and a deduplicated address. This was an extraction-pipeline check, not a live browser scrape.

[examples/updated-scraper-output.json](examples/updated-scraper-output.json) is the earlier extraction output from four real Phin Smith pages. It has the full schema, not a promise that every field is filled. No owner edits or confirmations were added. See [examples/README.md](examples/README.md) for collection details and the direct-downloader limitation in the development test environment. The original example is preserved too.

Screenshots are in `docs/screenshots/`:

- [Builder](docs/screenshots/builder.png)

- [Overview](docs/screenshots/overview.png)

- [Offerings](docs/screenshots/offerings.png)

- [Saved cards](docs/screenshots/saved-profiles.png)

- [Saved table](docs/screenshots/saved-profiles-table.png)

- [Mobile](docs/screenshots/mobile.png)

The screenshots show selected parts of the interface; they are not a record of automated or mobile interaction testing. 
## Limits

The downloader does not run JavaScript, log in, bypass access blocks, OCR images, read PDFs or crawl a complete site. External stylesheets are not collected. Small collection budgets can miss information. Automatic extraction can still mistake location headings for positioning or ordinary service descriptions for service areas. People, logo and font detection can also be incomplete or include incorrect candidates. Review important results before using them in marketing. A site's own statements are evidence of what it publishes, not proof that they are true. Regex rules can miss varied wording, languages and layouts.

localStorage is browser-specific and may be cleared. Export JSON as a backup. Runtime storage validation is basic, not a complete JSON-schema validator. This is an interview prototype, not a public production service: authentication, rate limiting, crawl permission/robots policy, monitoring and persistent storage would need more work before deployment.

## Simple owner guidance

The website form explains three steps: add the website, check the result, and save. The profile editor prominently says that only business name and website are required. Its short guide links to the relevant sections; optional marketing, pricing, brand and source settings are introduced in a collapsed explanation. Marketing preferences explains choosing a voice and next action, reviewing sensitive information, and copying writing instructions. Saving is clearly distinguished from downloading a backup or publishing content.
