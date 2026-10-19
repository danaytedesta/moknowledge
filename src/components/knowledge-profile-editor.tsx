"use client";

import { useEffect, useId, useRef, useState } from "react";
import BusinessDetailsEditor from "@/components/business-details-editor";
import BrandAssetsEditor from "@/components/brand-assets-editor";
import FaqEditor from "@/components/faq-editor";
import OfferingsEditor from "@/components/offerings-editor";
import MarketingBriefEditor from "@/components/marketing-brief-editor";
import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import KnowledgeListEditor from "@/components/knowledge-list-editor";
import KnowledgeFieldHeading from "@/components/knowledge-field-heading";
import { useKnowledge } from "@/context/knowledge-context";
import type {
  KnowledgeBase,
  KnowledgeField,
  OfferingPriority,
} from "@/types/knowledge";

interface ProfileEditorProps {
  initialProfile: KnowledgeBase;
}

const companyFields = [
  { key: "name", label: "Company name" },
  { key: "description", label: "Company description", multiline: true },
  { key: "website", label: "Website" },
  { key: "industry", label: "Industry" },
  { key: "businessModel", label: "Business model" },
  { key: "companyRole", label: "Company role" },
  { key: "legalEntityType", label: "Legal entity type" },
  { key: "employeeCount", label: "Employee count" },
  { key: "mainAddress", label: "Main address", multiline: true },
] as const;

type CompanyTextKey = (typeof companyFields)[number]["key"];

const controlStyle =
  "mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-4 py-3 text-[#3F352E] outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20";

const smallButtonStyle =
  "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

const mainButtonStyle =
  "rounded-lg bg-[#705747] px-6 py-3 text-[#FFFDFA] hover:bg-[#594436] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

const sections = [
  {
    id: "overview",
    label: "Overview",
    description: "Check the essentials and choose what to promote.",
  },
  {
    id: "offerings",
    label: "Products and services",
    description: "Review what you offer and how it should be promoted.",
  },
  {
    id: "business",
    label: "Business details",
    description:
      "Add useful context. Only company name and website are needed to save.",
  },
  {
    id: "brand",
    label: "Brand and style",
    description: "Keep your writing and visual references in one place.",
  },
  {
    id: "marketing",
    label: "Marketing preferences",
    description:
      "Choose how you sound, who to reach, and which statements to use.",
  },
  {
    id: "sources",
    label: "Sources",
    description: "See the website passages behind your profile.",
  },
] as const;
type SectionId = (typeof sections)[number]["id"];

export default function KnowledgeProfileEditor({
  initialProfile,
}: ProfileEditorProps) {
  const id = useId();
  const [offeringSearch, setOfferingSearch] = useState("");
  const [offeringLimit, setOfferingLimit] = useState(8);
  const priorityHeadingRef = useRef<HTMLHeadingElement>(null);

  // Saving updates browser storage and the shared saved-profile list.
  const { saveProfile, profiles, ready } = useKnowledge();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const contentRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDetailsElement>(null);

  // Section changes affect visibility only; all panels stay mounted so even
  // unfinished list entries survive a trip to another section.
  function selectSection(section: SectionId) {
    if (section === activeSection) {
      contentRef.current?.scrollIntoView?.({ block: "start" });
    }
    setActiveSection(section);
  }
  const previousSection = useRef(activeSection);
  useEffect(() => {
    if (previousSection.current !== activeSection) {
      // Wait for the new panel to render before moving it into view.
      contentRef.current?.scrollIntoView?.({ block: "start" });
      previousSection.current = activeSection;
    }
  }, [activeSection]);

  // One profile powers every editor, the saved record, and JSON export.
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function updateCompany(key: CompanyTextKey, field: KnowledgeField<string>) {
    setProfile((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      company: { ...current.company, [key]: field },
    }));

    clearFeedback();
  }

  function updateCompanyList(
    key: "alternativeNames" | "serviceAreas",
    field: KnowledgeField<string[]>,
  ) {
    setProfile((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      company: { ...current.company, [key]: field },
    }));

    clearFeedback();
  }

  function updateYear(value: string) {
    const year = value === "" ? null : Number(value);
    if (year !== null && !Number.isInteger(year)) return;

    const now = new Date().toISOString();

    setProfile((current) => ({
      ...current,
      updatedAt: now,
      company: {
        ...current.company,
        yearFounded: {
          ...current.company.yearFounded,
          value: year,
          origin: "owner",
          confirmedAt: null,
          updatedAt: now,
        },
      },
    }));

    clearFeedback();
  }

  const year = profile.company.yearFounded;
  const currentYear = new Date().getFullYear();

  const validYear =
    year.value !== null &&
    Number.isInteger(year.value) &&
    year.value >= 1 &&
    year.value <= currentYear;

  function toggleYearConfirmation() {
    if (!validYear) return;

    const now = new Date().toISOString();

    setProfile((current) => ({
      ...current,
      updatedAt: now,
      company: {
        ...current.company,
        yearFounded: {
          ...current.company.yearFounded,
          confirmedAt: current.company.yearFounded.confirmedAt ? null : now,
          updatedAt: now,
        },
      },
    }));

    clearFeedback();
  }

  function emptyText(): KnowledgeField<string> {
    return {
      value: null,
      origin: "owner",
      evidence: [],
      confirmedAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  function addLocation() {
    const location = {
      id: crypto.randomUUID(),
      label: emptyText(),
      address: emptyText(),
    };

    setProfile((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      company: {
        ...current.company,
        otherLocations: [...current.company.otherLocations, location],
      },
    }));

    clearFeedback();
  }

  function updateLocation(
    locationId: string,
    key: "label" | "address",
    field: KnowledgeField<string>,
  ) {
    setProfile((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      company: {
        ...current.company,
        otherLocations: current.company.otherLocations.map((location) =>
          location.id === locationId ? { ...location, [key]: field } : location,
        ),
      },
    }));

    clearFeedback();
  }

  function removeLocation(locationId: string) {
    if (!window.confirm("Remove this location from the profile?")) return;

    setProfile((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      company: {
        ...current.company,
        otherLocations: current.company.otherLocations.filter(
          (location) => location.id !== locationId,
        ),
      },
    }));

    clearFeedback();
  }

  // The quick control changes the same preference as the detailed editor.
  function updatePriority(offeringId: string, priority: OfferingPriority) {
    const now = new Date();

    setProfile((current) => ({
      ...current,
      updatedAt: now.toISOString(),
      offerings: current.offerings.map((offering) =>
        offering.id === offeringId
          ? {
              ...offering,
              marketing: {
                ...offering.marketing,
                priority,
                chosenAt: now.toISOString(),
                reviewAfter: new Date(
                  now.getTime() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            }
          : offering,
      ),
    }));

    clearFeedback();
  }

  function applyDescription(text: string, sourceUrl: string) {
    const existing = profile.company.description.value ?? "";

    if (
      existing.trim() &&
      existing !== text &&
      !window.confirm("Replace your current description with this passage?")
    ) {
      return;
    }

    updateCompany("description", {
      value: text,
      origin: "extracted",
      evidence: [{ sourceUrl, snippet: text }],
      confirmedAt: null,
      updatedAt: new Date().toISOString(),
    });

    setMessage("Description updated.");
  }

  function validateProfile(): boolean {
    if (!profile.company.name.value?.trim()) {
      setError("Add your company name in Business details → Business basics.");
      selectSection("business");
      return false;
    }

    if (year.value !== null && !validYear) {
      setError(
        `In Business details → More about your company, enter a founding year between 1 and ${currentYear}, or clear it.`,
      );
      selectSection("business");
      if (yearRef.current) yearRef.current.open = true;
      return false;
    }

    try {
      const website = new URL(profile.company.website.value ?? "");

      if (
        !["https:", "http:"].includes(website.protocol) ||
        website.username ||
        website.password
      ) {
        throw new Error("Invalid website");
      }
    } catch {
      setError(
        "Add a valid HTTP or HTTPS website in Business details → Business basics.",
      );
      selectSection("business");
      return false;
    }

    return true;
  }

  function saveCurrentProfile() {
    clearFeedback();
    if (!validateProfile()) return;

    try {
      const saved = saveProfile(profile);
      setProfile(saved);
      setMessage("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The profile could not be saved. Try downloading a JSON copy.",
      );
    }
  }

  function downloadProfile() {
    clearFeedback();
    if (!validateProfile()) return;

    try {
      const blob = new Blob([JSON.stringify(profile, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const safeName =
        (profile.company.name.value ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "business";

      link.href = objectUrl;
      link.download = `${safeName}-knowledge.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Download requested. Check your browser’s downloads.");
    } catch {
      setError("The file could not be created. Please try again.");
    }
  }

  const savedProfile = profiles.find((item) => item.id === profile.id);
  const isSaved =
    Boolean(savedProfile) &&
    JSON.stringify(savedProfile) === JSON.stringify(profile);
  const selectedSection = sections.find((item) => item.id === activeSection)!;
  const matchingOfferings = profile.offerings.filter((item) =>
    (item.name.value ?? "")
      .toLowerCase()
      .includes(offeringSearch.toLowerCase()),
  );

  function updateProfile(updated: KnowledgeBase) {
    setProfile(updated);
    clearFeedback();
  }

  const collectionNotes = profile.warnings.length > 0 && (
    <section className="kb-notice" aria-label="Collection notes">
      <h4 className="font-bold">
        Collection notes ({profile.warnings.length})
      </h4>
      <ul className="mt-3 space-y-3 text-sm text-[#695B4F]">
        {profile.warnings.map((warning, index) => (
          <li key={`${warning.url}-${index}`}>
            <p>{warning.message}</p>
            <p className="mt-1 break-all text-[#756D66]">{warning.url}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="knowledge-editor mt-12"
    >
      <header className="kb-editor-header">
        <div>
          <p className="kb-eyebrow">Your business profile</p>
          <h2
            id={`${id}-heading`}
            className="mt-3 break-words text-3xl tracking-tight sm:text-4xl"
          >
            {profile.company.name.value || "Your business profile"}
          </h2>
          <p className="mt-3 max-w-xl text-[#756D66]">
            Review what matters to your business. You don’t need to confirm
            every field.
          </p>
        </div>
        <a href="/knowledge/view" className="kb-text-button shrink-0">
          Saved profiles ↗
        </a>
      </header>

      {/* A short guide explains the required task without making optional review a gate. */}
      <section aria-labelledby={`${id}-guide`} className="kb-group my-6">
        <h3 id={`${id}-guide`} className="text-2xl font-bold">Your next steps</h3>
        <p className="mt-3 text-lg font-bold">You don’t need to fill in every field.</p>
        <p className="mt-2 text-[#695B4F]">Only your business name and website are required to save. Leave anything unknown blank. You don’t need to confirm every detail.</p>
        <ol className="mt-5 list-decimal space-y-4 pl-5">
          <li>
            <strong>Check your business name and website.</strong>
            <p className="mt-1 text-[#695B4F]">Read the summary below. Correct anything you know is wrong.</p>
            <button type="button" className="kb-text-button mt-2" onClick={() => selectSection("business")}>Check name and website →</button>
          </li>
          <li>
            <strong>Choose what to promote — optional.</strong>
            <p className="mt-1 text-[#695B4F]">Leave offerings on Normal, choose Promote more for a priority, or Paused for something you don’t want advertised. You can do this later.</p>
            <button type="button" className="kb-text-button mt-2" onClick={() => selectSection("overview")}>See what to promote →</button>
          </li>
          <li>
            <strong>Save your profile.</strong>
            <p className="mt-1 text-[#695B4F]">Use Save profile at the bottom of the screen. Find it again under Saved profiles in this browser. Saving does not publish anything or approve every detail.</p>
          </li>
        </ol>
        <details className="kb-optional mt-5">
          <summary className="cursor-pointer font-bold">Optional settings: make your marketing more useful</summary>
          <p className="mt-3 text-[#695B4F]">Start with Marketing preferences when you’re ready. Nothing here is required to save your profile.</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[#695B4F]">
            <li><strong>Marketing preferences:</strong> choose how your writing sounds, who you want to reach, and what customers should do next, such as call or book.</li>
            <li><strong>Products and services:</strong> review suggestions and decide whether prices should appear. Unconfirmed prices are left out of writing instructions.</li>
            <li><strong>Business details:</strong> correct useful facts and customer questions if needed.</li>
            <li><strong>Brand and style:</strong> add colors, fonts or examples of writing you like.</li>
            <li><strong>Sources:</strong> see where information came from. You don’t need to review every source.</li>
          </ul>
          <p className="mt-3 text-[#695B4F]">Promises such as guarantees need separate approval before use. You can leave them out instead.</p>
          <button type="button" className="kb-text-button mt-3" onClick={() => selectSection("marketing")}>Choose marketing preferences →</button>
        </details>
      </section>

      <div className="kb-workspace">
        <nav className="kb-section-nav" aria-label="Profile sections">
          {sections.map((section) => (
            <button
              key={section.id}
              id={`${id}-nav-${section.id}`}
              type="button"
              aria-current={activeSection === section.id ? "page" : undefined}
              aria-controls={`${id}-panel-${section.id}`}
              onClick={() => selectSection(section.id)}
            >
              {section.label}
            </button>
          ))}
          <p className="kb-nav-note">
            Name and website are all you need to save.
          </p>
        </nav>

        <div className="kb-main-panel" ref={contentRef}>
          <div className="kb-panel-heading">
            <p className="kb-eyebrow">Business profile</p>
            <h3 className="mt-2 text-3xl tracking-tight">
              {selectedSection.label}
            </h3>
            <p className="mt-3 max-w-xl text-[#756D66]">
              {selectedSection.description}
            </p>
          </div>

          {/* Hidden panels keep their controls and unfinished drafts mounted. */}
          <section
            id={`${id}-panel-overview`}
            aria-labelledby={`${id}-nav-overview`}
            hidden={activeSection !== "overview"}
          >
            <div className="kb-summary">
              <h4 className="text-2xl">Your business, at a glance.</h4>
              <p className="mt-4 whitespace-pre-line break-words leading-relaxed text-[#695B4F]">
                {profile.company.description.value ||
                  "Add a short description in Business details."}
              </p>
              <p className="mt-4 break-all text-sm text-[#756D66]">
                {profile.company.website.value}
              </p>
              {profile.company.mainAddress.value && (
                <p className="mt-2 text-sm text-[#756D66]">
                  {profile.company.mainAddress.value}
                </p>
              )}
              <p className="mt-4 text-sm text-[#756D66]">
                {profile.offerings.length} products and services ·{" "}
                {profile.sources.length}{" "}
                {profile.sources.length === 1 ? "source page" : "source pages"}
              </p>
              <button
                type="button"
                className="kb-text-button mt-2"
                onClick={() => selectSection("business")}
              >
                Edit business details →
              </button>
            </div>

            {profile.content.faqs.length > 0 && (
              <section className="kb-group">
                <h4 className="kb-group-title">Help customers decide</h4>
                <p className="mt-3 text-sm text-[#756D66]">
                  {profile.content.faqs.length} published questions or process
                  explanations found. Relevant answers feed your writing brief
                  automatically.
                </p>
                <ul className="mt-3 list-disc pl-5">
                  {profile.content.faqs.slice(0, 3).map((faq) => (
                    <li key={faq.id}>{faq.question.value}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="kb-text-button mt-3"
                  onClick={() => selectSection("business")}
                >
                  Review customer questions →
                </button>
              </section>
            )}

            <section className="kb-group">
              <h4
                ref={priorityHeadingRef}
                tabIndex={-1}
                className="kb-group-title kb-list-summary"
              >
                What would you like to promote?
              </h4>
              <p className="mt-3 text-[#756D66]">
                Choose a focus or pause anything you don’t want promoted.
              </p>
              <p className="mt-2 text-sm text-[#756D66]">
                Suggested names need your confirmation in Products and services
                before they can appear in the brief.
              </p>
              {profile.offerings.length > 8 && (
                <label className="mt-5 block font-bold">
                  Find a product or service
                  <input
                    type="search"
                    value={offeringSearch}
                    onChange={(event) => {
                      setOfferingSearch(event.target.value);
                      setOfferingLimit(8);
                    }}
                    placeholder="Search products and services"
                    className={controlStyle}
                  />
                </label>
              )}
              {matchingOfferings.length === 0 && (
                <p className="mt-5 text-[#756D66]">
                  {profile.offerings.length
                    ? "No matching products or services."
                    : "No products or services found. Add one in Products and services if useful."}
                </p>
              )}
              <div className="mt-4 divide-y divide-[#E8E0D6]">
                {matchingOfferings.slice(0, offeringLimit).map((offering) => (
                  <label key={offering.id} className="kb-priority-row">
                    <span className="min-w-0 break-words font-bold">
                      {offering.name.value || "Unnamed offering"}
                    </span>
                    <select
                      className={controlStyle}
                      value={offering.marketing.priority}
                      onChange={(event) =>
                        updatePriority(
                          offering.id,
                          event.target.value as OfferingPriority,
                        )
                      }
                    >
                      <option value="maintain">Normal</option>
                      <option value="push">Promote more</option>
                      <option value="pause">Don’t promote</option>
                      <option value="waitlist">Waitlist only</option>
                    </select>
                  </label>
                ))}
              </div>
              {matchingOfferings.length > offeringLimit && (
                <button
                  type="button"
                  className={`${smallButtonStyle} mt-4`}
                  onClick={() => setOfferingLimit(offeringLimit + 8)}
                >
                  Show more offerings
                </button>
              )}
              {offeringLimit > 8 && matchingOfferings.length > 8 && (
                <button
                  type="button"
                  className={`${smallButtonStyle} mt-4 ml-2`}
                  onClick={() => {
                    setOfferingLimit(8);
                    priorityHeadingRef.current?.focus({ preventScroll: true });
                    priorityHeadingRef.current?.scrollIntoView?.({
                      block: "start",
                    });
                  }}
                >
                  Show less
                </button>
              )}
              <button
                type="button"
                className="kb-text-button mt-4 block"
                onClick={() => selectSection("offerings")}
              >
                Review products and services →
              </button>
            </section>
            {collectionNotes}
          </section>

          <section
            id={`${id}-panel-offerings`}
            aria-labelledby={`${id}-nav-offerings`}
            hidden={activeSection !== "offerings"}
          >
            <OfferingsEditor
              offerings={profile.offerings}
              onChange={(offerings) => {
                setProfile((current) => ({
                  ...current,
                  offerings,
                  updatedAt: new Date().toISOString(),
                }));
                clearFeedback();
              }}
            />
          </section>

          <section
            id={`${id}-panel-business`}
            aria-labelledby={`${id}-nav-business`}
            hidden={activeSection !== "business"}
          >
            <section className="kb-group kb-group-first">
              <h4 className="kb-group-title">Business basics</h4>
              <div className="kb-fields">
                {companyFields
                  .filter((item) =>
                    [
                      "name",
                      "website",
                      "description",
                      "industry",
                      "mainAddress",
                    ].includes(item.key),
                  )
                  .map((item) => (
                    <KnowledgeFieldEditor
                      key={item.key}
                      label={item.label}
                      field={profile.company[item.key]}
                      multiline={"multiline" in item && item.multiline}
                      onChange={(field) => updateCompany(item.key, field)}
                    />
                  ))}
                <KnowledgeListEditor
                  label="Service areas"
                  field={profile.company.serviceAreas}
                  onChange={(field) => updateCompanyList("serviceAreas", field)}
                />
              </div>
            </section>
            <details className="kb-optional" ref={yearRef}>
              <summary>
                More about your company{" "}
                <span className="kb-optional-tag">Optional</span>
              </summary>
              <div className="kb-fields">
                {companyFields
                  .filter((item) =>
                    [
                      "businessModel",
                      "companyRole",
                      "legalEntityType",
                      "employeeCount",
                    ].includes(item.key),
                  )
                  .map((item) => (
                    <KnowledgeFieldEditor
                      key={item.key}
                      label={item.label}
                      field={profile.company[item.key]}
                      onChange={(field) => updateCompany(item.key, field)}
                    />
                  ))}
                <div>
                  <KnowledgeFieldHeading
                    label="Year founded"
                    inputId={`${id}-year`}
                    field={year}
                    hasValue={year.value !== null}
                    onConfirm={validYear ? toggleYearConfirmation : undefined}
                  />
                  <input
                    id={`${id}-year`}
                    type="number"
                    min={1}
                    max={currentYear}
                    step={1}
                    value={year.value ?? ""}
                    onChange={(event) => updateYear(event.target.value)}
                    placeholder="Leave blank if unknown"
                    aria-describedby={`${id}-year-status`}
                    className={controlStyle}
                  />
                  <p
                    id={`${id}-year-status`}
                    className="mt-2 text-sm text-[#756D66]"
                  >
                    {year.value !== null && !validYear
                      ? `Enter a year between 1 and ${currentYear}.`
                      : "Leave blank if unknown."}
                  </p>
                </div>
                <KnowledgeListEditor
                  label="Alternative company names"
                  field={profile.company.alternativeNames}
                  onChange={(field) =>
                    updateCompanyList("alternativeNames", field)
                  }
                />
              </div>
            </details>
            <section className="kb-group">
              <h4 className="kb-group-title">Other locations</h4>
              {profile.company.otherLocations.length === 0 && (
                <p className="mt-3 text-[#756D66]">No other locations added.</p>
              )}
              {profile.company.otherLocations.map((location) => (
                <details key={location.id} className="kb-item mt-3">
                  <summary>
                    {location.label.value ||
                      location.address.value ||
                      "New location"}
                  </summary>
                  <div className="kb-item-body kb-fields">
                    <KnowledgeFieldEditor
                      label="Location name"
                      field={location.label}
                      onChange={(field) =>
                        updateLocation(location.id, "label", field)
                      }
                    />
                    <KnowledgeFieldEditor
                      label="Location address"
                      field={location.address}
                      multiline
                      onChange={(field) =>
                        updateLocation(location.id, "address", field)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeLocation(location.id)}
                      className="kb-danger-button"
                    >
                      Remove location
                    </button>
                  </div>
                </details>
              ))}
              <button
                type="button"
                onClick={addLocation}
                className={`${smallButtonStyle} mt-4`}
              >
                Add location
              </button>
            </section>
            <BusinessDetailsEditor
              profile={profile}
              onChange={updateProfile}
              section="business"
            />
            <FaqEditor
              faqs={profile.content.faqs}
              onChange={(faqs) => {
                setProfile((current) => ({
                  ...current,
                  updatedAt: new Date().toISOString(),
                  content: { ...current.content, faqs },
                }));
                clearFeedback();
              }}
            />
          </section>

          <section
            id={`${id}-panel-brand`}
            aria-labelledby={`${id}-nav-brand`}
            hidden={activeSection !== "brand"}
          >
            <BusinessDetailsEditor
              profile={profile}
              onChange={updateProfile}
              section="brand"
            />
            <BrandAssetsEditor
              branding={profile.branding}
              onChange={(branding) => {
                setProfile((current) => ({
                  ...current,
                  branding,
                  updatedAt: new Date().toISOString(),
                }));
                clearFeedback();
              }}
            />
          </section>

          <section
            id={`${id}-panel-marketing`}
            aria-labelledby={`${id}-nav-marketing`}
            hidden={activeSection !== "marketing"}
          >
            <MarketingBriefEditor profile={profile} onChange={updateProfile} />
          </section>

          <section
            id={`${id}-panel-sources`}
            aria-labelledby={`${id}-nav-sources`}
            hidden={activeSection !== "sources"}
          >
            <p className="mb-5 text-[#756D66]">
              Open a page to read its passages. Use a passage as your company
              description if it fits.
            </p>
            <div className="space-y-3">
              {profile.sources.map((source) => (
                <details key={source.url} className="kb-item">
                  <summary>{source.title || source.url}</summary>
                  <div className="kb-item-body">
                    <p className="break-all text-sm text-[#756D66]">
                      {source.url}
                    </p>
                    {source.paragraphs.length > 0 ? (
                      source.paragraphs.map((paragraph, index) => (
                        <div key={index} className="kb-source-passage">
                          <blockquote className="break-words leading-relaxed">
                            {paragraph}
                          </blockquote>
                          <button
                            type="button"
                            onClick={() =>
                              applyDescription(paragraph, source.url)
                            }
                            aria-label={`Use passage ${index + 1} from ${source.title || source.url} as the company description`}
                            className="kb-text-button mt-2"
                          >
                            Use as description
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="mt-4 text-[#756D66]">
                        No matching paragraphs were extracted.
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
            {collectionNotes}
          </section>
        </div>
      </div>

      {/* One persistent action bar serves every section. Export does not save. */}
      <div className="kb-save-bar">
        <div className="kb-save-inner">
          <div className="min-w-0 flex-1">
            <p className="font-bold" role="status" aria-live="polite">
              {!ready
                ? "Checking saved profile…"
                : isSaved
                  ? "All changes saved"
                  : "You have unsaved changes"}
            </p>
            <p className="mt-1 text-sm text-[#756D66]">
              Save keeps your changes in this browser. Download JSON makes a backup file; it does not save your changes here.
            </p>
            {message && (
              <p role="status" className="mt-1 text-sm text-[#695B4F]">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-1 text-sm text-[#843E2D]">
                {error}
              </p>
            )}
          </div>
          <div className="kb-save-actions">
            <button
              type="button"
              onClick={downloadProfile}
              className={smallButtonStyle}
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={saveCurrentProfile}
              className={mainButtonStyle}
            >
              Save profile
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
