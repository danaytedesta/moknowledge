require("./register.cjs");
const fs = require("node:fs");
const { crawlWebsite } = require("../src/lib/crawl-website.ts");
const { buildKnowledgeBase } = require("../src/lib/build-knowledge-base.ts");
const { enrichKnowledgeBase } = require("../src/lib/enrich-knowledge-base.ts");
const {
  applyBusinessSignals,
} = require("../src/lib/apply-business-signals.ts");
(async () => {
  const crawl = await crawlWebsite(process.argv[2] || "https://phinsmith.com/");
  const profile = applyBusinessSignals(
    enrichKnowledgeBase(buildKnowledgeBase(crawl)),
    crawl,
  );
  fs.writeFileSync(
    "examples/updated-scraper-output.json",
    JSON.stringify(profile, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        pages: profile.sources.length,
        name: profile.company.name.value,
        offerings: profile.offerings.length,
        warnings: profile.warnings,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
