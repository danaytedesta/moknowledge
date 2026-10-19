"use client";

import { useState } from "react";
import Link from "next/link";
import KnowledgeProfileEditor from "@/components/knowledge-profile-editor";
import { useKnowledge } from "@/context/knowledge-context";
import type { KnowledgeBase } from "@/types/knowledge";

const buttonStyle =
  "rounded-lg border border-[#CEC3B7] px-4 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

export default function SavedKnowledgePage() {
  // Saved records now come from shared context rather than duplicate state.
  const {
    profiles,
    ready,
    error: storageError,
    refreshProfiles,
    deleteProfile,
  } = useKnowledge();

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [error, setError] = useState("");

  function removeProfile(profile: KnowledgeBase) {
    if (
      !window.confirm(
        `Delete "${profile.company.name.value}" from saved profiles?`,
      )
    ) {
      return;
    }

    try {
      deleteProfile(profile.id);
      setError("");
    } catch {
      setError("The profile could not be deleted. Please try again.");
    }
  }

  const search = query.trim().toLowerCase();

  const filtered = profiles.filter((profile) =>
    [
      profile.company.name.value,
      profile.company.website.value,
      profile.company.description.value,
      profile.company.industry.value,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search),
  );

  function actions(profile: KnowledgeBase) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(profile);
            setError("");
          }}
          aria-label={`Edit ${profile.company.name.value}`}
          className={buttonStyle}
        >
          Edit / details
        </button>

        <button
          type="button"
          onClick={() => removeProfile(profile)}
          aria-label={`Delete ${profile.company.name.value}`}
          className={buttonStyle}
        >
          Delete
        </button>
      </div>
    );
  }

  const displayedError = error || storageError;

  return (
    <main
      className="min-h-screen bg-[#F7F4EF] px-6 py-8 text-[#3F352E] sm:px-10"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DED6CD] pb-6">
          <Link href="/knowledge" className="text-2xl">
            MoKnowledge.
          </Link>

          <Link href="/knowledge" className={buttonStyle}>
            Build a new profile
          </Link>
        </header>

        <h1 className="mt-10 text-4xl">Your business knowledge.</h1>

        <p className="mt-3 text-[#756D66]">
          Profiles saved in this browser. Open a profile to review, edit, or
          download it.
        </p>

        {displayedError && (
          <div
            role="alert"
            className="mt-5 rounded-lg bg-[#F8ECE6] p-4 text-[#843E2D]"
          >
            <p>{displayedError}</p>

            {storageError && (
              <button
                type="button"
                onClick={refreshProfiles}
                className={`${buttonStyle} mt-3`}
              >
                Try loading again
              </button>
            )}
          </div>
        )}

        {!ready ? (
          <p role="status" className="mt-8">
            Loading saved profiles…
          </p>
        ) : editing ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (
                  !window.confirm(
                    "Return to the list? Save any changes you want to keep first.",
                  )
                ) {
                  return;
                }

                setEditing(null);
                refreshProfiles();
              }}
              className={`${buttonStyle} mt-6`}
            >
              Back to profiles
            </button>

            <KnowledgeProfileEditor key={editing.id} initialProfile={editing} />
          </>
        ) : storageError ? (
          <p className="mt-6 text-[#756D66]">
            Existing browser data has been preserved. Resolve the loading error
            before managing saved profiles.
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="profile-search" className="block font-bold">
                  Search profiles
                </label>

                <input
                  id="profile-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, website, industry…"
                  className="mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FFFDFA] px-4 py-3 outline-none focus:ring-2 focus:ring-[#785E4B]/20"
                />
              </div>

              <div className="flex gap-2" role="group" aria-label="View mode">
                <button
                  type="button"
                  aria-pressed={view === "cards"}
                  onClick={() => setView("cards")}
                  className={`${buttonStyle} ${
                    view === "cards" ? "bg-[#E8DED2]" : ""
                  }`}
                >
                  Cards
                </button>

                <button
                  type="button"
                  aria-pressed={view === "table"}
                  onClick={() => setView("table")}
                  className={`${buttonStyle} ${
                    view === "table" ? "bg-[#E8DED2]" : ""
                  }`}
                >
                  Table
                </button>
              </div>
            </div>

            <p role="status" className="mt-4 text-sm text-[#756D66]">
              {filtered.length} {filtered.length === 1 ? "profile" : "profiles"}
            </p>

            {filtered.length === 0 ? (
              <p className="mt-6 rounded-xl border border-[#DED6CD] p-6">
                {profiles.length === 0
                  ? "No saved profiles yet. Build a profile and click Save profile."
                  : "No profiles match your search."}
              </p>
            ) : view === "cards" ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {filtered.map((profile) => (
                  <article
                    key={profile.id}
                    className="min-w-0 rounded-2xl border border-[#DED6CD] bg-[#FFFDFA] p-6"
                  >
                    <h2 className="break-words text-2xl">
                      {profile.company.name.value}
                    </h2>

                    <p className="mt-2 break-all text-sm text-[#756D66]">
                      {profile.company.website.value}
                    </p>

                    <p className="mt-4 line-clamp-3 break-words text-[#695B4F]">
                      {profile.company.description.value ||
                        "No description added."}
                    </p>

                    <p className="mt-4 text-sm text-[#756D66]">
                      Updated: {new Date(profile.updatedAt).toLocaleString()}
                    </p>

                    <div className="mt-5">{actions(profile)}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-xl border border-[#DED6CD] bg-[#FFFDFA]">
                <table className="w-full text-left">
                  <caption className="sr-only">Saved business profiles</caption>

                  <thead className="bg-[#EEE8DF]">
                    <tr>
                      <th scope="col" className="p-4">
                        Company
                      </th>
                      <th scope="col" className="p-4">
                        Industry
                      </th>
                      <th scope="col" className="p-4">
                        Updated
                      </th>
                      <th scope="col" className="p-4">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((profile) => (
                      <tr
                        key={profile.id}
                        className="border-t border-[#DED6CD]"
                      >
                        <td className="p-4">{profile.company.name.value}</td>
                        <td className="p-4">
                          {profile.company.industry.value || "Unknown"}
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {new Date(profile.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">{actions(profile)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
