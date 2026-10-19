# Example knowledge profiles

These JSON files show how MoKnowledge organizes website information into business profiles. Each profile includes source URLs, supporting evidence and information origins.

Unknown information stays null or empty. Extracted facts, inferred suggestions and measured style information are labeled separately. No owner edits, confirmations or claim approvals were added to these examples.

## Included examples

| File | What it demonstrates |
|---|---|
| `molly-maid-scraper-output.json` | Cleaning services, FAQs, customer needs and inferred business classifications. |
| `blueland-scraper-output.json` | Products, features, variant pricing, founding story and FAQs. |
| `ugmonk-scraper-output.json` | Products, published founding year, audience information and shipping questions. |
| `bench-scraper-output.json` | Bookkeeping plans, business classifications and conflicting price evidence. |
| `bishops-scraper-output.json` | Salon service categories and customer FAQs. |
| `bee-cave-scraper-output.json` | Services, staff, company history and published partner information. |
| `updated-scraper-output.json` | Phin Smith’s business information and menu offerings. |

## How they were produced

These examples were generated from real website HTML downloaded during testing and processed through the application's extraction pipeline. They were not manually filled in. Direct downloading through the application was unavailable in that test environment, so HTML was collected using curl.

Molly Maid, Blueland, Ugmonk, Bench and Bishops were processed with the latest baseline update. Bee Cave and Phin Smith are earlier examples. The original `phin-smith-knowledge (11).json` is also preserved as a historical reference.

Separate local tests successfully scraped and exported Molly Maid, Blueland and Ugmonk through the running application. Those local exports are separate from the downloaded-HTML examples listed above.

## Limitations

These are examples of scraper output, not complete or independently verified business records. The crawler reads a limited number of pages, so products, people and other information may be missing. Extraction can also misclassify website text.

Website content changes over time, so later runs may produce different results. Sources and timestamps are included in each JSON file. See `../verification.txt` for testing details.