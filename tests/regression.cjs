require("./register.cjs");
const assert = require("node:assert/strict");
const { extractKnowledge } = require("../src/lib/extract-knowledge.ts");
const { extractPageContext } = require("../src/lib/extract-page-context.ts");
const { buildKnowledgeBase } = require("../src/lib/build-knowledge-base.ts");
const {
  applyBusinessSignals,
} = require("../src/lib/apply-business-signals.ts");
const { enrichKnowledgeBase } = require("../src/lib/enrich-knowledge-base.ts");
const {
  compileMarketingBrief,
} = require("../src/lib/compile-marketing-brief.ts");
const { customerDecisionMap } = require("../src/lib/customer-decision-map.ts");
function profile(html, url = "https://sample.example/services") {
  const crawl = {
    pages: [
      {
        knowledge: extractKnowledge(html, url),
        context: extractPageContext(html, url),
        fetchedAt: new Date().toISOString(),
      },
    ],
    warnings: [],
  };
  return applyBusinessSignals(
    enrichKnowledgeBase(buildKnowledgeBase(crawl)),
    crawl,
  );
}
const html = `<meta property="og:site_name" content="Sample Workshop"><main>
<h2>Our story</h2><p>We started in a small workshop to make repairs easier for local families.</p>
<h2>Who we serve</h2><p>Homeowners and small offices.</p><h2>Service areas</h2><p>North Valley and Lake District.</p>
<h2>Problems we solve</h2><p>We help customers keep their equipment working.</p>
<h2>Our partners</h2><p>Published Parts Cooperative.</p><h2>Why choose us</h2><p>We explain each repair before work starts.</p>
<div><h3>Our team</h3><p>Meet the people who care about every customer.</p></div>
<div><h3>How it works</h3><p>Send a request and we discuss your repair options.</p></div>
<details><summary>What should I bring?</summary><p>Bring the item and its model number.</p></details>
<details><summary>What does it cost?</summary><p>The initial visit costs $90.</p></details>
<details><summary>Are results guaranteed?</summary><p>We guarantee perfect results.</p></details>
<script type="application/ld+json">${JSON.stringify([
  {
    "@type": "Organization",
    url: "https://unrelated.example",
    foundingDate: "1901",
    numberOfEmployees: 900,
  },
  {
    "@type": "Service",
    name: "Equipment repair",
    description: "Inspection and repair of household equipment.",
    category: "Repairs",
    additionalProperty: [
      { name: "Includes", value: "Written inspection report" },
    ],
    offers: {
      price: 90,
      priceCurrency: "USD",
      description: "Per visit; parts extra",
    },
  },
  {
    "@type": "Product",
    name: "Unrelated product",
    description: "An unrelated company sells this product.",
    offers: {
      seller: { url: "https://unrelated.example" },
      price: 30,
      priceCurrency: "USD",
    },
  },
])}</script></main>`;
const p = profile(html);
assert.equal(p.company.yearFounded.value, null);
assert.equal(p.company.employeeCount.value, null);
assert.equal(p.company.legalEntityType.value, null);
assert.ok(p.positioning.foundingStory.value.includes("workshop"));
assert.ok(
  p.market.targetBuyers.value.includes("Homeowners and small offices."),
);
assert.ok(p.market.suppliersAndPartners.length);
assert.equal(p.branding.writingStyle.origin, "measured");
assert.equal(p.offerings.length, 1);
assert.equal(p.offerings[0].kind.value, "service");
assert.equal(p.offerings[0].category.value, "Repairs");
assert.deepEqual(p.offerings[0].features.value, [
  "Includes: Written inspection report",
]);
assert.match(p.offerings[0].pricing.text.value, /parts extra/);
assert.ok(
  customerDecisionMap(p).some((item) => item.topic === "Getting started"),
);
let brief = compileMarketingBrief(p, "blog", "Explain the process");
assert.ok(brief.text.includes("model number"));
assert.ok(!brief.text.includes("$90"));
assert.ok(!brief.text.includes("guarantee perfect"));
assert.ok(brief.leftOut.some((item) => item.includes("pricing/commitment")));
const faq = p.content.faqs.find(
  (item) => item.question.value === "What should I bring?",
);
faq.answer.value = "Bring a photograph instead.";
faq.answer.origin = "owner";
faq.answer.confirmedAt = new Date().toISOString();
assert.ok(
  compileMarketingBrief(p, "email", "Help").text.includes("photograph instead"),
);
p.offerings[0].marketing.priority = "pause";
assert.ok(
  compileMarketingBrief(p, "social", "Help").leftOut.includes(
    "Equipment repair: paused.",
  ),
);
const blank = profile("<main><p>Welcome.</p></main>");
assert.equal(blank.company.name.value, null);
assert.equal(blank.offerings.length, 0);
const conflict = profile(
  `<script type="application/ld+json">${JSON.stringify([
    {
      "@type": "Organization",
      url: "https://sample.example",
      foundingDate: "2001",
      legalForm: "LLC",
    },
    {
      "@type": "Organization",
      url: "https://sample.example",
      foundingDate: "2008",
      legalForm: "Corporation",
    },
  ])}</script>`,
);
assert.equal(conflict.company.yearFounded.value, null);
assert.equal(conflict.company.yearFounded.evidence.length, 2);
assert.equal(conflict.company.legalEntityType.value, null);
assert.equal(conflict.company.legalEntityType.evidence.length, 2);
// Exercise the actual persistence functions with a minimal browser storage substitute.
const data = new Map();
global.window = {
  localStorage: {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  },
};
const storage = require("../src/lib/knowledge-storage.ts");
storage.saveProfile(p);
assert.equal(storage.loadProfiles().length, 1);
p.company.name.value = "Edited business";
storage.saveProfile(p);
assert.equal(storage.loadProfiles()[0].company.name.value, "Edited business");
assert.equal(
  JSON.parse(JSON.stringify(storage.loadProfiles()[0])).content.faqs.find(
    (item) => item.id === faq.id,
  ).answer.value,
  "Bring a photograph instead.",
);
storage.deleteProfile(p.id);
assert.equal(storage.loadProfiles().length, 0);
console.log(
  "PASS: extraction, unrelated entities, unknowns, conflicts, decision edits, price/claim filters, pause, save/reopen, JSON round trip and deletion.",
);

// Different business types use the same structured-data path.
for (const [type, name, expected] of [
  ["Product", "Ceramic mug", "product"],
  ["MenuItem", "Lemon tart", "product"],
  ["Service", "Tax preparation", "service"],
]) {
  const item = profile(
    `<script type="application/ld+json">${JSON.stringify({ "@type": type, name, category: "Published category" })}</script>`,
  );
  assert.equal(item.offerings[0].kind.value, expected);
  assert.equal(item.offerings[0].description.value, null);
}
const unrelatedYear = profile(
  "<main><p>Our client was founded in 1901 and expanded nationally.</p></main>",
);
assert.equal(unrelatedYear.company.yearFounded.value, null);
const offer = p.offerings[0];
offer.marketing.priority = "maintain";
offer.marketing.chosenAt = null;
offer.pricing.type = "fixed";
offer.pricing.text.confirmedAt = new Date().toISOString();
assert.ok(compileMarketingBrief(p, "email", "Help").text.includes("USD 90"));
offer.pricing.text.confirmedAt = "2020-01-01T00:00:00Z";
assert.ok(!compileMarketingBrief(p, "email", "Help").text.includes("USD 90"));
offer.marketing.priority = "waitlist";
offer.marketing.chosenAt = new Date().toISOString();
offer.marketing.reviewAfter = new Date(Date.now() + 86400000).toISOString();
assert.ok(
  compileMarketingBrief(p, "social", "Help").text.includes(
    "WAITLIST ONLY: Equipment repair",
  ),
);
console.log(
  "PASS: product, menu, professional service, unrelated founding story, fresh/stale pricing and waitlist.",
);

// Regression cases for misleading website content. Keep small,
// synthetic reproductions so tests do not rely on a live site's availability.
const misleading = profile(`<main>
<div><h2>Get In Touch With Sample Workshop</h2><p>Fill out this form and we will be in touch about our services.</p><form><label>Name</label><input><label>State</label><select><option>Alabama</option></select></form></div>
<form><h2>Free Water Well Estimate</h2><p>Enter your address to request service.</p></form>
<section class="blog"><h2>Why are pests in my house?</h2><p>Sep 21 | Pest control | Read this short preview...</p></section>
<div><h2>Ready to experience our difference?</h2><p>Call now and discover our great services.</p></div>
<section class="faq"><h3>How do I prepare for the visit?</h3><p>Clear access to the equipment before the technician arrives.</p></section>
</main>`);
assert.equal(misleading.offerings.length, 0);
assert.deepEqual(
  misleading.content.faqs.map((faq) => faq.question.value),
  ["How do I prepare for the visit?"],
);
const cards = profile(
  `<main><div class="builder-section"><h2>Our services</h2><div><h4>Drain inspection</h4><p>A camera inspection to identify blockages in household drains.</p><ul><li>Written inspection report</li></ul></div><div><h4>Water sampling</h4><p>Collection and laboratory testing of your water sample.</p></div></div></main>`,
  "https://sample.example/",
);
assert.deepEqual(
  cards.offerings.map((o) => o.name.value),
  ["Drain inspection", "Water sampling"],
);
assert.equal(cards.offerings[0].kind.value, "service");
assert.deepEqual(cards.offerings[0].features.value, [
  "Written inspection report",
]);
const team = profile(
  `<main><div><h3>Alex Rivera</h3><p>Operations Manager</p><p>Alex manages the workshop and coordinates repair appointments for local customers.</p></div><div><h3>Customer Services</h3><p>Our team handles enquiries.</p></div></main>`,
  "https://sample.example/team",
);
assert.equal(team.people.length, 1);
assert.equal(team.people[0].name.value, "Alex Rivera");
assert.equal(team.people[0].gender.value, null);
assert.equal(team.offerings.length, 0);
const explicit = profile(`<main>
<h2>Business model</h2><p>Monthly subscriptions for equipment maintenance.</p>
<h2>Company pitch</h2><p>Understand your equipment before deciding on repairs.</p>
<h2>Ideal customer persona</h2><p>Small offices that need scheduled equipment maintenance.</p>
<h2>Industries served</h2><p>Retail and hospitality.</p>
<h2>Industry outlook</h2><p>Our published outlook is that demand varies by season.</p>
<h2>Marketing channels</h2><p>Our newsletter and local events.</p>
<h2>Sales funnel</h2><p>Enquiry, inspection, written quote, then booking.</p>
<h2>Art style</h2><p>Simple line drawings with muted colors.</p>
<h2>Brand voice</h2><p>Plain language with short, helpful explanations.</p>
<h2>Head office</h2><p>10 Main Street, Sample Town.</p></main>`);
for (const value of [
  explicit.company.businessModel,
  explicit.company.mainAddress,
  explicit.positioning.pitch,
  explicit.market.idealCustomerPersona,
  explicit.market.industryGroupings,
  explicit.market.industryOutlook,
  explicit.market.channels,
  explicit.market.funnels,
  explicit.branding.artStyle,
  explicit.branding.writingStyle,
]) {
  assert.ok(value.value);
  assert.equal(value.origin, "extracted");
  assert.ok(value.evidence.length);
  assert.equal(value.confirmedAt, null);
}
const { addressKey } = require("../src/lib/normalize-extraction.ts");
assert.equal(
  addressKey("185 Angel Fire Rd, Dripping Springs, Texas, 78620, USA"),
  addressKey("185 Angel Fire Rd, Dripping Springs, TX 78620"),
);
assert.notEqual(
  addressKey("10 Main St, Unit 1, Austin TX 78701"),
  addressKey("10 Main St, Unit 2, Austin TX 78701"),
);
const { selectCrawlLinks } = require("../src/lib/crawl-priority.ts");
const links = selectCrawlLinks([
  { url: "https://sample.example/about-us/employment", label: "Employment" },
  { url: "https://sample.example/request-estimate", label: "Request estimate" },
  {
    url: "https://sample.example/drains",
    label: "Drain inspection",
    context: "Services",
  },
  { url: "https://sample.example/about", label: "About" },
  { url: "https://sample.example/staff", label: "Our staff" },
  { url: "https://sample.example/contact/", label: "Contact" },
  { url: "https://sample.example/contact", label: "Contact" },
]);
assert.equal(links.length, 4);
assert.equal(links[1].label, "Drain inspection");
const longDescription =
  "We help local businesses maintain their equipment with regular inspections and clear written reports that explain the next steps.";
const expanded = extractKnowledge(
  `<meta name="description" content="${longDescription.slice(0, 95)}"><main><p>${longDescription}</p></main>`,
  "https://sample.example",
);
assert.equal(expanded.description, longDescription);
const ownHistory = profile(
  `<meta property="og:site_name" content="Sample Workshop"><main><p>In June of 1998, Sample Workshop (then known as Old Workshop) began in a small garage.</p><p>Today Sample Workshop has a staff of around 12 people.</p><p>Our client was founded in 1900 and employs 900 people.</p></main>`,
  "https://sample.example/about",
);
assert.equal(ownHistory.company.yearFounded.value, 1998);
assert.equal(ownHistory.company.employeeCount.value, "around 12 people");
assert.ok(ownHistory.company.alternativeNames.value.includes("Old Workshop"));
assert.ok(ownHistory.positioning.foundingStory.value.includes("small garage"));
const statedGender = profile(
  `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", url: "https://sample.example", founder: { "@type": "Person", name: "Alex Rivera", gender: "Nonbinary" } })}</script>`,
);
assert.equal(statedGender.people[0].gender.value, "Nonbinary");
console.log(
  "PASS: forms, blog previews, CTA questions, page-builder services, staff ownership, explicit baseline labels, exact history, stated gender, address variants, crawl priorities and clipped metadata.",
);
const foundation = profile(
  `<meta property="og:site_name" content="Sample Studio"><meta name="theme-color" content="#123456"><style>body {font-family: Georgia; color:#654321}</style><main><p>Industry: Design</p><p>Legal entity type: Limited company</p><p>Employee count: 4</p><p>Company role: Design consultancy</p><img alt="Sample Studio logo" src="/logo.png"><a href="https://instagram.com/sample_studio/">Instagram</a></main>`,
);
assert.equal(foundation.company.industry.value, "Design");
assert.equal(foundation.company.legalEntityType.value, "Limited company");
assert.equal(foundation.company.employeeCount.value, "4");
assert.equal(foundation.company.companyRole.value, "Design consultancy");
assert.ok(
  foundation.branding.colors.some(
    (x) => x.value === "#123456" && x.origin === "measured",
  ),
);
assert.ok(foundation.branding.fonts.some((x) => x.value === "Georgia"));
assert.equal(foundation.branding.logoUrls[0].origin, "inferred");
assert.equal(
  foundation.socialProfiles[0].url.value,
  "https://instagram.com/sample_studio",
);
const partner = profile(
  '<main><h1>Our partners</h1><a href="https://parts.example">Parts Cooperative</a><a href="https://instagram.com/sample">Instagram</a></main>',
  "https://sample.example/partners",
);
assert.deepEqual(
  partner.market.suppliersAndPartners.map((x) => x.value),
  ["Parts Cooperative"],
);
assert.equal(
  profile('<main><a href="https://parts.example">Parts Cooperative</a></main>')
    .market.suppliersAndPartners.length,
  0,
);
console.log(
  "PASS: explicit foundation labels, measured CSS, logo suggestions, social canonicalization and contextual partner links.",
);

const directory = profile(
  '<main><a href="https://gravatar.com/author"><img alt="author123"></a><table><tr><td>Parts Cooperative</td><td><a href="https://parts.example">parts.example</a></td></tr></table></main>',
  "https://sample.example/partners",
);
assert.deepEqual(
  directory.market.suppliersAndPartners.map((x) => x.value),
  ["Parts Cooperative"],
);

// Business identity must not be copied from a customer-sector landing page.
const buyerPage = profile(
  '<title>Bookkeeping for plumbers | Ledger</title><meta name="description" content="Bookkeeping for plumbers and home service businesses."><main><h1>Helping plumbers manage their books</h1></main>',
  "https://sample.example/industry/home-services",
);
assert.notEqual(buyerPage.company.industry.value, "Plumbing");
const paragraphFaq = profile(
  "<main><h1>FAQ</h1><p><strong>Do I need an appointment?</strong> Walk-ins are welcome for standard services.</p><p>How long does it take? Allow 30 minutes for a standard appointment.</p></main>",
  "https://sample.example/faq",
);
assert.equal(paragraphFaq.content.faqs.length, 2);
const bio = profile(
  "<main><h1>Jordan Lee, CPA</h1><h2>Independent CPA, CFO, and Controller.</h2><p>My experience includes public accounting and financial strategy for growing businesses.</p></main>",
  "https://sample.example/about-us/jordan-lee",
);
assert.equal(bio.people[0].name.value, "Jordan Lee");
assert.match(bio.people[0].background.value, /public accounting/);
assert.equal(bio.people[0].gender.value, null);
const history = profile(
  '<meta property="og:site_name" content="Simple Tools"><main><p>I started Simple Tools in 2008 because I could not find the tools I wanted.</p></main>',
  "https://sample.example/about",
);
assert.equal(history.company.yearFounded.value, 2008);
const falseOffers = profile(
  "<main><div><h2>Select Size</h2><p>For you and your friends to enjoy.</p></div><div><h2>Think Better on Paper</h2><p>A card system built for the way you think.</p></div><div><h2>17 Years Obsessing Over Details</h2><p>I started the company in my apartment.</p></div></main>",
  "https://sample.example/products/kit",
);
assert.equal(falseOffers.offerings.length, 0);
const logoOwnership = profile(
  '<meta property="og:site_name" content="Sample"><main><img alt="News Daily logo" src="https://sample.example/cdn/news-daily-logo.png"><img alt="Tools with engraved Sample logo" src="/cdn/tools.jpg"><img alt="Sample logo" src="/cdn/sample-logo.png"></main>',
);
assert.equal(logoOwnership.branding.logoUrls.length, 1);
assert.match(logoOwnership.branding.logoUrls[0].value, /sample-logo/);
const namedLegal = profile(
  '<meta property="og:site_name" content="Sample Services, LLC">',
);
assert.equal(namedLegal.company.legalEntityType.value, "LLC");
assert.equal(
  profile('<meta property="og:site_name" content="Sample Services">').company
    .legalEntityType.value,
  null,
);
const b2b = profile(
  '<meta property="og:site_name" content="Ledger"><meta name="description" content="Ledger pairs businesses with a dedicated bookkeeper and software.">',
);
assert.equal(b2b.company.companyRole.value, "Service provider");
assert.equal(b2b.company.businessModel.value, "Business-to-business services");
assert.equal(b2b.company.businessModel.origin, "inferred");
// Repeated plans merge. Different prices retain both sources and stay unknown.
const pages = [90, 120].map((price, i) => ({
  knowledge: extractKnowledge(
    '<meta property="og:site_name" content="Workshop">',
    "https://sample.example/" + i,
  ),
  context: extractPageContext(
    `<script type="application/ld+json">${JSON.stringify({ "@type": "Service", name: "Inspection", offers: { price, priceCurrency: "USD" } })}</script>`,
    "https://sample.example/" + i,
  ),
  fetchedAt: new Date().toISOString(),
}));
const merged = buildKnowledgeBase({ pages, warnings: [] });
assert.equal(merged.offerings.length, 1);
assert.equal(merged.offerings[0].pricing.text.value, null);
assert.equal(merged.offerings[0].pricing.text.evidence.length, 2);
assert.ok(
  merged.warnings.some((x) => x.message.includes("Different published prices")),
);
const serviceLinks = extractPageContext(
  '<nav><a href="/pest-control">Pest control</a><a href="/about/employment">Employment</a></nav>',
  "https://sample.example/",
).relatedPages;
assert.equal(serviceLinks[0].url, "https://sample.example/pest-control");
assert.equal(serviceLinks.length, 1);
console.log(
  "PASS: customer-sector isolation, paragraph FAQs, credentialed biographies, founder statements, offering controls/slogans, logo ownership, legal suffix evidence, inferred model/role, price conflicts and service-link discovery.",
);
const headcount = profile(
  "<main><p>We employ approximately 14 employees across two offices.</p><blockquote><p>We employ 900 people at our client company.</p></blockquote></main>",
);
assert.equal(headcount.company.employeeCount.value, "approximately 14");
const legalName = profile(
  '<script type="application/ld+json">{"@type":"Organization","url":"https://sample.example","name":"Sample","legalName":"Sample Services LLC"}</script>',
);
assert.equal(legalName.company.legalEntityType.value, "LLC");
const serviceLanding = profile(
  "<main><h1>Pest Control</h1><p>We inspect properties and provide treatment options based on the pests found.</p><h2>Why choose us?</h2><p>Call to discuss your property.</p></main>",
  "https://sample.example/pest-control",
);
assert.equal(serviceLanding.offerings[0].name.value, "Pest Control");
assert.equal(serviceLanding.offerings[0].kind.value, "service");

// Baseline support must transfer to a new business, not depend on a tested name.
const baseline = profile(`<meta property="og:site_name" content="Cedar Home"><meta name="description" content="Cedar Home offers customized house cleaning services nationwide for homeowners."><main>
<p>Cedar Home was founded in 2014 to simplify home care.</p>
<p>We help families save time and maintain a clean home.</p>
<p>We provide customized services without contracts.</p>
<p>We partner with Local Supply Cooperative for cleaning materials.</p>
<p>Our headquarters is located at 25 Oak Road, Austin, TX 78701.</p>
<h2>How it works</h2><p>First contact us for a quote, then book your appointment.</p>
<div><h3>Recurring Cleaning</h3><p>Weekly cleaning visits for kitchens and bathrooms.</p><ul><li>Kitchen surfaces</li><li>Bathroom cleaning</li></ul></div>
<div><h3>Popular Services</h3><p>Explore the available options for your home.</p></div>
<div><h3>Free Instant Quotes</h3><p>Contact us to discuss your needs and request a quote.</p></div>
<article class="blog-card"><h3>Stain Removal Techniques</h3><p>Read the latest tips for your furniture.</p></article>
<a href="/estimate">Request a quote</a></main>`, "https://cedar.example/services");
assert.equal(baseline.company.yearFounded.value, 2014);
assert.equal(baseline.company.companyRole.value, "Service provider");
assert.equal(baseline.company.businessModel.origin, "inferred");
assert.ok(baseline.company.serviceAreas.value.some(v => v.includes("nationwide")));
assert.ok(baseline.market.targetBuyers.value.length);
assert.ok(baseline.market.customerNeeds.value.length);
assert.ok(baseline.market.suppliersAndPartners.length);
assert.equal(baseline.market.idealCustomerPersona.origin, "inferred");
assert.ok(baseline.positioning.pitch.value.startsWith("Rule-based"));
assert.equal(baseline.positioning.pitch.confirmedAt, null);
assert.equal(baseline.company.employeeCount.value, null);
assert.equal(baseline.company.legalEntityType.value, null);
assert.equal(baseline.market.industryOutlook.value, null);
assert.equal(baseline.branding.artStyle.value, null);
assert.ok(baseline.offerings.some(o => o.name.value === "Recurring Cleaning" && o.kind.value === "service"));
assert.ok(!baseline.offerings.some(o => /Popular|Quotes|Techniques/.test(o.name.value)));
assert.ok(baseline.market.channels.value.includes("Website booking or quote request"));

const variant = profile(`<meta property="og:site_name" content="Cedar Goods"><main><h1>Refill Tablets</h1>
<div><h2>Scent</h2><p>Choose an unscented or botanical scented option.</p></div>
<div><h2>One Powerful Clean</h2><p>A description of the ingredients in this product.</p></div>
<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Refill Tablets", description: "Refill tablets for cleaning. Features: Paper packaging; dissolves in water.", offers: [{ price: 12, priceCurrency: "USD" }, { price: 18, priceCurrency: "USD" }] })}</script></main>`, "https://cedar.example/products/refill-tablets");
assert.equal(variant.offerings.length, 1);
assert.ok(variant.offerings[0].features.value[0].includes("Paper packaging"));
assert.ok(variant.offerings[0].pricing.text.value.includes("12–18"));
assert.equal(variant.offerings[0].pricing.text.confirmedAt, null);
const ownedLogo = profile(`<meta property="og:site_name" content="Cedar"><header><a href="https://partner.example/"><img src="/partner-logo.svg" alt="Partner logo"></a><a href="/"><img src="/brand-logo.svg" alt="Cedar logo"></a></header>`, "https://cedar.example/");
assert.ok(!ownedLogo.branding.logoUrls.some(x => x.value.includes("partner-logo")));
assert.ok(ownedLogo.branding.logoUrls.some(x => x.value.includes("brand-logo")));
const escapedFaq = profile(`<script type="application/ld+json">${JSON.stringify({"@type":"FAQPage", mainEntity:[{"@type":"Question", name:"How do I prepare?", acceptedAnswer:{"@type":"Answer",text:"<p>Clear floors &amp; put pets somewhere comfortable.</p>"}}]})}</script>`);
assert.ok(escapedFaq.content.faqs[0].answer.value.includes("floors & put pets"));
console.log("PASS: cross-business baseline inference, unknown legal facts, audience/needs evidence, product variants/features, false headings, owned logos and decoded FAQs.");
const colorService = profile('<main><div><h3>COLOR</h3><p>Hair coloring appointments with a consultation.</p></div></main>', 'https://salon.example/services');
assert.ok(colorService.offerings.some(o => o.name.value === 'COLOR'));
// Two-page merge must retain later features even if other text is identical.
const mergeSource = { name:'Bookkeeping', description:'Monthly books for local businesses.', priceText:null, sourceUrl:'https://books.example/pricing', snippet:'Monthly books for local businesses.', origin:'inferred' };
const { buildOfferings } = require('../src/lib/build-offerings.ts');
const richer = buildOfferings({pages:[{context:{offeringCandidates:[mergeSource]}},{context:{offeringCandidates:[{...mergeSource,features:['Written financial statements']}]} }],warnings:[]});
assert.equal(richer.length,1);
assert.deepEqual(richer[0].features.value,['Written financial statements']);
const noPartner = profile('<meta property="og:site_name" content="Cedar"><main><p>Cedar is a well-known cleaning company. You partner with Cedar when booking.</p></main>', 'https://cedar.example/');
assert.equal(noPartner.market.suppliersAndPartners.length,0);
console.log('PASS: salon Color service, richer duplicate features and non-partner marketing wording.');
