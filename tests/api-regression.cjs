require("./register.cjs");
const assert = require("node:assert/strict");
const downloader = require("../src/lib/fetch-website.ts");
const originalFetch = downloader.fetchWebsite;
const { POST } = require("../src/app/api/scrape/route.ts");
async function request(body) {
  return POST(
    new Request("http://localhost/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}
(async () => {
  for (const body of [
    "not-json",
    "{}",
    JSON.stringify({ url: "ftp://example.com" }),
    JSON.stringify({ url: "https://user:pass@example.com" }),
    JSON.stringify({ url: "https://example.com:3001" }),
  ])
    assert.equal((await request(body)).status, 400);
  // These checks use the real downloader's validation and never contact a private host.
  for (const url of ["http://127.0.0.1", "http://192.168.1.1", "http://[::1]"])
    await assert.rejects(originalFetch(url), /public company website/);
  const calls = [];
  const links = [
    "about",
    "services",
    "faq",
    "team",
    "contact",
    "partners",
    "products",
    "about/employment",
  ];
  downloader.fetchWebsite = async (url, allowedOrigin) => {
    calls.push(url);
    if (allowedOrigin) assert.equal(new URL(url).origin, allowedOrigin);
    if (url.endsWith("/contact"))
      throw new Error("Synthetic unavailable related page");
    return {
      finalUrl: url,
      html:
        url === "https://sample.example/"
          ? `<meta property="og:site_name" content="Sample Workshop"><main>${links.map((path) => `<a href="/${path}">${path}</a>`).join("")}<a href="https://elsewhere.example/services">External services</a></main>`
          : `<main><h2>How it works</h2><p>Send the model number before booking your appointment.</p></main>`,
    };
  };
  const response = await request(
    JSON.stringify({ url: "https://sample.example/" }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.profile.company.name.value, "Sample Workshop");
  assert.equal(calls.length, 7); // Starting page plus six attempts, including the failed one.
  assert.ok(
    !calls.some(
      (url) => url.includes("employment") || url.includes("elsewhere"),
    ),
  );
  assert.ok(calls.some((url) => url.endsWith("/faq")));
  assert.equal(result.pageCount, 6);
  assert.ok(result.warnings.some((w) => w.url.endsWith("/contact")));
  assert.ok(result.profile.content.faqs.length);
  // Discover a useful service page linked only from a collected About page.
  const discovered = [];
  downloader.fetchWebsite = async (url) => {
    discovered.push(url);
    return {
      finalUrl: url,
      html: url.endsWith("/about")
        ? '<main><a href="/drain-inspections">Drain inspections</a></main>'
        : url.endsWith("/drain-inspections")
          ? "<main><p>Camera inspections identify obstructions before repair work.</p></main>"
          : '<main><a href="/about">About</a></main>',
    };
  };
  assert.equal(
    (await request(JSON.stringify({ url: "https://sample.example/" }))).status,
    200,
  );
  assert.ok(discovered.includes("https://sample.example/drain-inspections"));
  assert.ok(discovered.length <= 7);
  const { crawlWebsite } = require("../src/lib/crawl-website.ts");
  // A non-settling download must not trap the API forever.
  downloader.fetchWebsite = () => new Promise(() => {});
  const started = Date.now();
  await assert.rejects(crawlWebsite("https://sample.example/", 25), /deadline exceeded/);
  assert.ok(Date.now() - started < 1000);
  // Pathological markup is rejected before expensive DOM scanning.
  downloader.fetchWebsite = async url => ({ finalUrl: url, html: "<div></div>".repeat(18001) });
  await assert.rejects(crawlWebsite("https://sample.example/"), /too many HTML/);
  console.log("PASS: non-settling download deadline and HTML complexity guard.");
  console.log(
    "PASS: API validation, private-address rejection, seven-page bound, page selection, successful profile response and partial-download warnings (fixture downloader).",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    downloader.fetchWebsite = originalFetch;
  });
