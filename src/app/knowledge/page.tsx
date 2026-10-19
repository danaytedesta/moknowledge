"use client";

/** URL entry and build/review/save flow. The client timeout restores the form
 * even if the server or an external website stops responding. */

import { useState, type FormEvent } from "react";
import KnowledgeProfileEditor from "@/components/knowledge-profile-editor";
import type { KnowledgeBase } from "@/types/knowledge";

// Check that a response value is an object.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Validate the text fields used by the current profile editor.
function isTextField(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    (value.value === null || typeof value.value === "string") &&
    typeof value.origin === "string" &&
    ["extracted", "inferred", "measured", "owner"].includes(value.origin) &&
    (value.confirmedAt === null || typeof value.confirmedAt === "string") &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.evidence) &&
    value.evidence.every(
      (item: unknown) =>
        isRecord(item) &&
        typeof item.sourceUrl === "string" &&
        typeof item.snippet === "string",
    )
  );
}

// Check the parts of the profile used by the current interface.
// Validation will expand as we add the remaining category editors.
function isProfile(value: unknown): value is KnowledgeBase {
  if (!isRecord(value)) return false;

  if (
    value.schemaVersion !== "1.0" ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isRecord(value.company)
  ) {
    return false;
  }

  const company = value.company;

  const textFields = [
    "name",
    "description",
    "website",
    "industry",
    "businessModel",
    "companyRole",
    "legalEntityType",
    "employeeCount",
    "mainAddress",
  ];

  if (!textFields.every((key) => isTextField(company[key]))) {
    return false;
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    return false;
  }

  return value.sources.every(
    (source: unknown) =>
      isRecord(source) &&
      typeof source.url === "string" &&
      (source.title === null || typeof source.title === "string") &&
      typeof source.fetchedAt === "string" &&
      Array.isArray(source.headings) &&
      source.headings.every(
        (heading: unknown) => typeof heading === "string",
      ) &&
      Array.isArray(source.paragraphs) &&
      source.paragraphs.every(
        (paragraph: unknown) => typeof paragraph === "string",
      ),
  );
}

export default function KnowledgePage() {
  // Store the website input and complete business profile.
  const [website, setWebsite] = useState("");
  const [profile, setProfile] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    // Give the user a chance to preserve edits before replacing a profile.
    if (
      profile &&
      !window.confirm(
        "Start a new scrape? Download any edits you want to keep first.",
      )
    ) {
      return;
    }

    setError("");
    setProfile(null);
    setIsLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      // Send the URL to our backend.
      const response = await fetch("/api/scrape", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: website.trim(),
        }),
      });

      // A server error may return HTML instead of JSON.
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "The server returned an unexpected response. Please try again.",
        );
      }

      const payload: unknown = await response.json();

      if (!isRecord(payload)) {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "We couldn't read this website. Please try again.",
        );
      }

      // Read the new full profile from the API response.
      if (!isProfile(payload.profile)) {
        throw new Error(
          "The business profile was not returned in the expected format.",
        );
      }

      setProfile(payload.profile);
    } catch (error) {
      setError(
        controller.signal.aborted
          ? "This website took too long. Please try again or try a more specific About or Services page."
          : error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      // Restore the form after success, failure or timeout.
      clearTimeout(timer);
      setIsLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-[#F7F4EF] bg-[radial-gradient(ellipse_at_top_right,_#E5D8C8_0%,_transparent_55%)] text-[#3F352E]"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#DED6CD] py-7">
          <a
            href="/knowledge"
            className="rounded text-2xl tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#785E4B]"
          >
            MoKnowledge<span className="text-[#94765F]">.</span>
          </a>

          <span className="hidden text-sm text-[#756D66] sm:block">
            A foundation for better content
          </span>
        </header>

        <section className="mx-auto pb-16 pt-14 sm:pt-20">
          {/* Introduction */}
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs tracking-[0.22em] text-[#79614F] uppercase">
              You approve. We remember.
            </p>

            <h1 className="mt-5 text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Marketing that
              <br />
              <span className="italic text-[#896C56]">knows you.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[#756D66]">
              Turn your website into a business profile you can review, edit,
              and reuse for posts, emails, and articles.
            </p>
          </div>

          {/* Website form */}
          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-[#D8CBBE] bg-[#FFFDFA]/95 p-6 shadow-[0_20px_60px_-25px_rgba(83,62,43,0.25)] sm:p-9">
            <h2 className="text-2xl">Build your business profile</h2>

            <p className="mt-2 leading-relaxed text-[#756D66]">
              Paste your website address below. We’ll collect what we can so you don’t have to type everything yourself.
            </p>

            <ol className="mt-5 list-decimal space-y-2 pl-5 text-[#695B4F]">
              <li><strong>Add your website.</strong> Select Build profile to read its public pages.</li>
              <li><strong>Check the result.</strong> Correct your business name and website if needed. Other details are optional.</li>
              <li><strong>Save your profile.</strong> Return anytime to edit it or choose how to use it for marketing.</li>
            </ol>

            <form
              onSubmit={handleSubmit}
              className="mt-7"
              aria-busy={isLoading}
            >
              <label htmlFor="website" className="block text-base font-bold">
                Company website
              </label>

              <input
                id="website"
                name="website"
                type="url"
                required
                maxLength={2048}
                autoComplete="url"
                placeholder="https://yourcompany.com"
                aria-describedby="website-hint"
                disabled={isLoading}
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value);
                  setError("");
                }}
                className="mt-3 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-4 py-3.5 text-base text-[#3F352E] outline-none placeholder:text-[#81766C] focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20 disabled:opacity-60"
              />

              <p id="website-hint" className="mt-2 text-sm text-[#756D66]">
                Include https:// at the beginning.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-6 w-full rounded-lg bg-[#705747] px-7 py-3.5 text-base text-[#FFFDFA] transition-colors hover:bg-[#594436] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {isLoading ? "Reading website…" : "Build profile"}
              </button>
            </form>

            {/* Announce progress and completion to screen readers. */}
            <div role="status" aria-live="polite" className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#756D66]">
                  Reading your website and related pages. This may take up to a
                  minute.
                </p>
              )}

              {profile && (
                <p className="text-sm text-[#695B4F]">
                  Your profile is ready to review. We collected{" "}
                  {profile.sources.length} pages.
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-[#DAB8AC] bg-[#F8ECE6] p-4 text-[#843E2D]"
              >
                {error}
              </p>
            )}
          </div>

          {/* One editor displays and updates the complete profile. */}
          {profile && (
            <KnowledgeProfileEditor key={profile.id} initialProfile={profile} />
          )}

          {/* Workflow overview */}
          <div className="mx-auto mt-10 grid max-w-2xl gap-7 sm:grid-cols-3">
            {[
              {
                number: "01",
                title: "Gather",
                description: "Find business details on your website.",
              },
              {
                number: "02",
                title: "Review",
                description: "Edit the details and fill in any gaps.",
              },
              {
                number: "03",
                title: "Save",
                description: "Keep your business knowledge ready to use.",
              },
            ].map((step) => (
              <div key={step.number} className="border-t border-[#DED6CD] pt-4">
                <span className="text-sm text-[#79614F]">{step.number}</span>

                <h3 className="mt-2 text-xl">{step.title}</h3>

                <p className="mt-2 text-base leading-relaxed text-[#756D66]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-[#DED6CD] py-6 text-center text-sm text-[#756D66]">
          Made for your business, in your words.
        </footer>
      </div>
    </main>
  );
}
