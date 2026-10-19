import { lookup } from "node:dns";
import { isIP } from "node:net";
import * as ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";

// Keep each download small and reasonably fast.
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 15_000; // 15 seconds
const MAX_REDIRECTS = 3;

// Describe the result returned to our scraper.
export interface WebsiteHtml {
  html: string;
  finalUrl: string;
}

// Allow ordinary public IP addresses.
// Block private networks, localhost, and other special address ranges.
function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

// Check a URL before making a connection.
function validateUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Enter a valid website address, such as https://example.com.",
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS websites are supported.");
  }

  // Do not accept usernames or passwords embedded in a URL.
  if (url.username || url.password) {
    throw new Error("Use a website URL without login credentials.");
  }

  // Standard HTTP/HTTPS ports appear as an empty string in URL.port.
  if (url.port) {
    throw new Error("Use a website with a standard HTTP or HTTPS port.");
  }

  // IPv6 addresses can be enclosed in square brackets in URLs.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // Check direct IP addresses here because they can bypass DNS lookup.
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new Error("Please enter a public company website.");
  }

  // Page fragments are not needed when downloading HTML.
  url.hash = "";

  return url;
}

// Create a connection manager with our own address checks.
function createDispatcher(): Agent {
  return new Agent({
    connect: {
      timeout: 10_000,

      // DNS translates a domain name into its IP addresses.
      lookup(hostname, options, callback) {
        lookup(hostname, { all: true }, (error, addresses) => {
          if (error) {
            callback(error, "", 4);
            return;
          }

          // Reject the hostname if any returned address is not public.
          if (
            addresses.length === 0 ||
            addresses.some((entry) => !isPublicAddress(entry.address))
          ) {
            callback(
              new Error("This website points to a restricted address."),
              "",
              4,
            );
            return;
          }

          // Return the checked addresses directly to the connection.
          // This avoids checking one IP and then connecting to another.
          if (options.all) {
            callback(null, addresses);
          } else {
            const selected =
              addresses.find((entry) => entry.family === 4) ?? addresses[0];

            callback(null, selected.address, selected.family);
          }
        });
      },
    },
  });
}

// Download one HTML page, following a limited number of redirects.
export async function fetchWebsite(
  value: string,
  allowedOrigin?: string,
  timeoutMs = TIMEOUT_MS,
): Promise<WebsiteHtml> {
  let url = validateUrl(value);
  const dispatcher = createDispatcher();

  // One deadline covers the entire download, including redirects.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(TIMEOUT_MS, Math.max(1, timeoutMs)),
  );

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      // Keep related-page requests on the same website,
      // including when a page redirects elsewhere.
      if (allowedOrigin && url.origin !== allowedOrigin) {
        throw new Error("This page redirects outside the selected website.");
      }

      const response = await fetch(url, {
        dispatcher,
        signal: controller.signal,

        // Handle redirects ourselves so every destination is checked.
        redirect: "manual",

        headers: {
          "User-Agent": "MoKnowledgeBot/1.0",
          Accept: "text/html, application/xhtml+xml",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();

        if (!location) {
          throw new Error("The website returned an invalid redirect.");
        }

        if (redirects === MAX_REDIRECTS) {
          throw new Error("The website redirected too many times.");
        }

        // Redirects can be relative URLs, such as /home.
        url = validateUrl(new URL(location, url).href);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();

        throw new Error(
          `The website could not be downloaded (HTTP ${response.status}).`,
        );
      }

      const contentType =
        response.headers.get("content-type")?.toLowerCase() ?? "";

      // We want webpages, not PDFs, images, or other file types.
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        await response.body?.cancel();
        throw new Error("This address does not return an HTML webpage.");
      }

      if (!response.body) {
        throw new Error("The website returned an empty response.");
      }

      // Read in chunks so we can stop before a large page fills memory.
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value: chunk } = await reader.read();

          if (done) break;

          totalBytes += chunk.byteLength;

          if (totalBytes > MAX_BYTES) {
            await reader.cancel();
            throw new Error("This webpage exceeds the 2 MB download limit.");
          }

          chunks.push(chunk);
        }
      } finally {
        reader.releaseLock();
      }

      // Convert the downloaded bytes into HTML text.
      return {
        html: Buffer.concat(chunks).toString("utf8"),
        finalUrl: url.href,
      };
    }

    throw new Error("The website could not be downloaded.");
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The website took too long to respond. Try again.");
    }

    throw error;
  } finally {
    // Always clean up the timer and network connections.
    clearTimeout(timer);
    await dispatcher.destroy();
  }
}
