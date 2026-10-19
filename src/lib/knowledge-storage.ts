import type { KnowledgeBase } from "@/types/knowledge";

const STORAGE_KEY = "moknowledge.profiles.v1";

// Browser storage can be unavailable or contain damaged data.
// Throw an error rather than silently overwriting unreadable records.
export function loadProfiles(): KnowledgeBase[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);

  // Basic checks for records created by this app.
  // This is not a complete schema validator or a JSON import feature.
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        item.schemaVersion === "1.0" &&
        typeof item.id === "string" &&
        typeof item.updatedAt === "string" &&
        typeof item.company === "object" &&
        item.company !== null &&
        typeof item.company.name === "object" &&
        item.company.name !== null &&
        typeof item.company.name.value === "string" &&
        typeof item.company.website === "object" &&
        item.company.website !== null &&
        typeof item.company.website.value === "string" &&
        Array.isArray(item.sources)
    )
  ) {
    throw new Error("Saved profiles could not be read. Existing data was preserved.");
  }

  return parsed as KnowledgeBase[];
}

// Replace a record with the same ID; otherwise add a new record.
export function saveProfile(profile: KnowledgeBase): KnowledgeBase {
  if (!profile.company.name.value?.trim()) {
    throw new Error("Enter a company name before saving.");
  }

  const website = new URL(profile.company.website.value ?? "");

  if (
    !["http:", "https:"].includes(website.protocol) ||
    website.username ||
    website.password
  ) {
    throw new Error("Enter a valid HTTP or HTTPS company website.");
  }

  const year = profile.company.yearFounded.value;

  if (
    year !== null &&
    (!Number.isInteger(year) || year < 1 || year > new Date().getFullYear())
  ) {
    throw new Error("Enter a valid founding year or leave it blank.");
  }

  const profiles = loadProfiles();
  const saved = { ...profile, updatedAt: new Date().toISOString() };
  const exists = profiles.some((item) => item.id === saved.id);

  const updated = exists
    ? profiles.map((item) => (item.id === saved.id ? saved : item))
    : [...profiles, saved];

  // A storage failure throws; callers only show success after this completes.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return saved;
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles();
  const remaining = profiles.filter((profile) => profile.id !== id);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}