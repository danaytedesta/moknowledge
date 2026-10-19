# Assignment coverage

Every requested field is present in the editable profile and JSON. The table describes automatic extraction, not a promise that every website supplies every fact. “Partial” means recognizable markup or wording is required. Missing information stays unknown. Owners only need a name and website to save.

| Requested information | Current extraction and limits |
|---|---|
| Company overview | Metadata or owned organization description; About-page paragraph fallback. A clipped metadata excerpt is expanded only when a visible paragraph begins with the same words. |
| Website | Final URL of the starting page. |
| Industry | Explicit labeled text / structured industry or classification code; limited inferred keyword and specific business-type suggestions. Partial. |
| Business model | Explicit “Business model” section; limited subscription/B2B/B2C wording and direct-product-sales suggestions. Partial. |
| Company role | Explicit label, limited manufacturer/retailer self-description, and inferred service-provider/product-designer interpretation from the company overview. Partial. |
| Year founded | Owned organization foundingDate or supported company founding language, including “I started [company] in [year].” Copyright years are excluded. Conflicting years stay unknown. |
| Legal entity type | Explicit legal form or label. Explicit legal-name/company-name suffixes are also recorded as published designations, not independently verified registration status. |
| Employee count | Explicit numberOfEmployees or label; named-company “staff/team/workforce of…” wording retains qualifiers such as “around.” Explicit “We employ…” statements are supported. No headcount from team-card totals. |
| Main address | Explicit head office / headquarters / main-address label. A sole collected location is not automatically called headquarters. |
| Other locations | Structured and recognizable visible addresses. US state-name/abbreviation variants before ZIP codes are deduplicated; unit numbers remain distinct. |
| Service locations | Structured areaServed, labeled service areas and supported self-statements/FAQs, including published nationwide/shipping coverage. Partial. |
| Alternative names | Structured alternateName and “then/formerly known as” in a named-company About passage. Partial. |
| Company pitch | Published pitch/value-proposition/mission label, or a rule-based summary of a sourced description. The summary is labeled inferred, stays unconfirmed, and does not add promises. No live AI. |
| Founding story | Labeled history/story, limited first-person wording, and named-company About history. Exact passage retained. Partial. |
| Target buyers | Labeled customer sections, audience structured data and supported self-statements/FAQs naming who is served. Exact wording retained. Partial. |
| Customer needs | Labeled needs/problem sections and attributable company/FAQ statements about what customers need help with. Exact wording retained. Partial. |
| Ideal customer persona | Explicit ideal-customer/persona section, or a labeled rule-based audience/needs summary using existing sourced fields. No invented demographics. |
| Industry groupings | Explicit industries/sectors-served label. No external taxonomy lookup. |
| Industry outlook | Explicit industry/market-outlook label only. No forecast generation or current market research. |
| Channels and funnels | Explicit labels; published first/then step sequences can supply process wording. Contact/order channels may be inferred from CTAs. These are not a complete measured sales funnel. |
| CTAs | Published action labels and links/buttons. Preferred next action remains the owner's choice. |
| Suppliers and partners | Labeled sections, supported structured relationships, named links on dedicated partner/supplier pages. Social controls and random external links are excluded. Partial. |
| Writing style | Explicit brand-voice/style label when present; otherwise measured sentence length and direct reader-address patterns. Measurements do not identify personality or tone. |
| Art style | Explicit visual/art-style/art-direction text only. No image analysis. |
| Fonts and hex colors | Inline/embedded CSS and theme-color. Measured, not confirmed brand guidelines. External stylesheets are not fetched. |
| Logos | Structured logo URLs and logo-marked images, retained as suggestions. Image candidates require brand/asset or header-home-link evidence. Logo selection still needs review. |
| Social profiles | Recognized profile URL patterns and supported sameAs links; share/post links filtered. Account ownership is not independently verified. |
| People: names, titles and roles | Owned structured founder/employee relationships, self-introductions bounded staff/about cards with published titles, and dedicated credentialed biography headings. Partial. |
| People: gender | Only explicitly stated structured gender attached to an owned founder/employee, or owner entry. Never inferred from names, pronouns or photos. |
| People: background | Structured descriptions and bounded nearby biography passages. Separately wrapped biographies may be missed. |
| Offerings | Product/Service/MenuItem structured records and bounded HTML cards with descriptions. General page-builder service sections supported. Forms, staff pages and generic headings excluded. Repeated names merge; conflicting prices remain unknown with retained evidence. Partial catalog coverage. |
| Offering features | Structured additionalProperty, description lists, explicit Features text, and bounded card lists (including common div-based feature items). Richer later-page features survive duplicate merging. No generated benefits. |
| Offering prices | Supported structured prices and unambiguous nearby price text, with published qualifications when available. Owner approval/type selection required before brief use. |
| Offering category and product/service kind | Structured category/serviceType and types; service-page context and an offering’s own name/description can suggest kind/category, labeled inferred. Otherwise unknown. |

## What was checked

`npm test` includes synthetic cases for explicit baseline labels, structured products/services/menu items, people and stated gender, missing information, conflicting facts, unrelated organizations/sellers, form headings, blog previews, promotional questions, page-builder cards, source evidence, CSS/social data, address variants, save/reopen/delete, edited decision questions, and brief filtering. API tests use a fixture downloader and separately test real private-address rejection.

The new Bee Cave example was produced from seven downloaded real HTML pages through the application pipeline. It is not a browser/API end-to-end test. It contains six offering candidates, 19 staff records, the published 1980 founding year and approximate staff count, and one deduplicated address. No owner edits or confirmations were added. Current Account-it and Planet Orange live downloads were unavailable in this environment; synthetic regression cases cover relevant failure patterns. These examples do not establish a general extraction accuracy percentage.

## Additional real-HTML checks

Bishops: 20 FAQ records and three merged service categories. Bench: accounting/bookkeeping classification, six plan entries and a price-conflict warning. Ugmonk: four product entries, the published 2008 founding year, inferred product-designer/direct-sales fields and one business logo. These are observed fixture results, not guarantees for future website versions. Account-it biography extraction was checked against reconstructed source passages; fresh Account-it and Planet Orange HTML remained unavailable. Service-link and second-level discovery have deterministic tests.

## Broader baseline validation

The baseline has extraction paths for every requested field, but support is conditional, not complete recall across websites. Explicit facts, supported interpretations and measurements stay distinct. A reference profile may include manually researched or enriched facts that raw HTML alone cannot supply. Unknown gender, unpublished headcount/legal form, market outlook and unexpressed art direction are intentional gaps.

Additional real HTML examples: Molly Maid has five service candidates and 20 FAQs; Blueland has two structured products and 17 FAQs. Misleading product-option headings and unrelated logos are rejected. Molly Maid’s published US expansion in 1984 is retained as history rather than asserted to be the global company founding date. The examples do not claim complete catalogs.

Tests also cover new-business audience/needs statements, inferred summaries, product variant price ranges, same-origin logo links, a legitimate salon Color service, duplicate feature enrichment, a non-settling downloader and oversized markup. See verification.txt for the exact environment limitations.
