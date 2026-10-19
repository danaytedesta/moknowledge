import { NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/crawl-website";
import { buildKnowledgeBase } from "@/lib/build-knowledge-base";
import { enrichKnowledgeBase } from "@/lib/enrich-knowledge-base";
import { applyBusinessSignals } from "@/lib/apply-business-signals";

// The scraper uses Node.js networking features.
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    // Read the JSON sent by the frontend.
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request must contain valid JSON." },
      { status: 400 },
    );
  }

  // Verify that the request contains a URL string.
  if (
    typeof body !== "object" ||
    body === null ||
    !("url" in body) ||
    typeof body.url !== "string"
  ) {
    return NextResponse.json(
      { error: "Please provide a website URL." },
      { status: 400 },
    );
  }

  const website = body.url.trim();

  if (!website || website.length > 2048) {
    return NextResponse.json(
      {
        error:
          "Please provide a website URL with no more than 2,048 characters.",
      },
      { status: 400 },
    );
  }

  // Check basic URL formatting.
  // The download helper performs the deeper network-address checks.
  try {
    const url = new URL(website);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return NextResponse.json(
        {
          error:
            "Use an HTTP or HTTPS website without login credentials or a custom port.",
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        error: "Enter a valid website address, such as https://example.com.",
      },
      { status: 400 },
    );
  }

  try {
    // Read the starting page and up to six related pages.
    const result = await crawlWebsite(website);

    // Build the profile, suggest basic details, then attach business signals.
    const profile = applyBusinessSignals(
      enrichKnowledgeBase(buildKnowledgeBase(result)),
      result,
    );

    // Keep the first-page results for the existing interface.
    const firstPage = result.pages[0];

    return NextResponse.json(
      {
        profile,
        data: firstPage.knowledge,
        context: firstPage.context,
        pages: result.pages,
        warnings: result.warnings,
        pageCount: result.pages.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    // Keep detailed errors in the server terminal for troubleshooting.
    console.error("Website scrape failed:", error);

    // Return a user-friendly message without internal error details.
    return NextResponse.json(
      {
        error:
          "We couldn't read this website. It may be unavailable, restricted, too large, or taking too long. Check the address or try another website.",
      },
      { status: 502 },
    );
  }
}
