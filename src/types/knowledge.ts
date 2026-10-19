// Where a value originally came from.
// Owner confirmation is tracked separately.
export type InformationOrigin =
  | "extracted"
  | "inferred"
  | "measured"
  | "owner";

// Evidence stays attached even after the owner edits a value.
export interface Evidence {
  sourceUrl: string;
  snippet: string;
}

// Reusable wrapper for knowledge fields.
// null means unknown. No confirmation date means unconfirmed.
export interface KnowledgeField<T> {
  value: T | null;
  origin: InformationOrigin;
  evidence: Evidence[];
  confirmedAt: string | null;
  updatedAt: string;
}

// Store addresses as separate fields for easier editing.
export interface BusinessLocation {
  id: string;
  label: KnowledgeField<string>;
  address: KnowledgeField<string>;
}

// A marketing preference is separate from whether the offering
// itself has been confirmed.
export type OfferingPriority =
  | "push"
  | "maintain"
  | "pause"
  | "waitlist";

export type PriceType =
  | "fixed"
  | "starting_at"
  | "quote_only"
  | "hidden";

export interface Offering {
  id: string;
  name: KnowledgeField<string>;
  description: KnowledgeField<string>;
  category: KnowledgeField<string>;
  kind: KnowledgeField<"product" | "service" | "other">;
  features: KnowledgeField<string[]>;

  marketing: {
    priority: OfferingPriority;
    chosenAt: string | null;
    reviewAfter: string | null;
    // An overdue review must not automatically reactivate a pause.
  };

  pricing: {
    type: PriceType | null;
    text: KnowledgeField<string>;
    // The compiler will check text.confirmedAt before using a price.
  };
}

export interface KeyPerson {
  id: string;
  name: KnowledgeField<string>;
  title: KnowledgeField<string>;
  role: KnowledgeField<string>;
  background: KnowledgeField<string>;

  // Only record explicitly stated information.
  // Never infer gender from a name or photograph.
  gender: KnowledgeField<string>;
}

export interface SocialProfile {
  id: string;
  platform: string;
  url: KnowledgeField<string>;
}

export interface MarketingClaim {
  id: string;
  text: KnowledgeField<string>;
  status: "approved" | "needs_proof" | "banned";
  reviewAfter: string | null;
  // Approval is an owner's decision, not independent verification.
}

export interface Promotion {
  id: string;
  text: KnowledgeField<string>;
  startsAt: string | null;
  expiresAt: string | null;
}

export interface FrequentlyAskedQuestion {
  id: string;
  question: KnowledgeField<string>;
  answer: KnowledgeField<string>;
}

// Simple presets can fill these settings later.
export interface VoicePreferences {
  formality: "professional" | "conversational" | "casual";
  emoji: "none" | "occasional" | "frequent";
  length: "short" | "balanced" | "detailed";
  pronoun: "we" | "I" | null;
  callsCustomers: string;
  avoid: string[];
  writingSamples: string[];
  chosenAt: string | null;
}

// Retain page evidence without treating it all as approved marketing.
export interface SourcePage {
  url: string;
  title: string | null;
  fetchedAt: string;
  headings: string[];
  paragraphs: string[];
}

export interface KnowledgeBase {
  schemaVersion: "1.0";
  id: string;
  createdAt: string;
  updatedAt: string;

  // COMPANY FOUNDATION
  company: {
    name: KnowledgeField<string>;
    description: KnowledgeField<string>;
    website: KnowledgeField<string>;
    industry: KnowledgeField<string>;
    businessModel: KnowledgeField<string>;
    companyRole: KnowledgeField<string>;
    yearFounded: KnowledgeField<number>;
    legalEntityType: KnowledgeField<string>;
    employeeCount: KnowledgeField<string>;
    mainAddress: KnowledgeField<string>;
    otherLocations: BusinessLocation[];
    serviceAreas: KnowledgeField<string[]>;
    alternativeNames: KnowledgeField<string[]>;
  };

  // POSITIONING
  positioning: {
    pitch: KnowledgeField<string>;
    foundingStory: KnowledgeField<string>;
    differentiators: KnowledgeField<string>[];
  };

  // MARKET AND CUSTOMERS
  market: {
    targetBuyers: KnowledgeField<string[]>;
    customerNeeds: KnowledgeField<string[]>;
    idealCustomerPersona: KnowledgeField<string>;
    industryGroupings: KnowledgeField<string[]>;
    industryOutlook: KnowledgeField<string>;
    channels: KnowledgeField<string[]>;
    funnels: KnowledgeField<string[]>;
    callsToAction: KnowledgeField<string>[];
    suppliersAndPartners: KnowledgeField<string>[];
  };

  // BRANDING AND STYLE
  branding: {
    writingStyle: KnowledgeField<string>;
    artStyle: KnowledgeField<string>;
    fonts: KnowledgeField<string>[];
    colors: KnowledgeField<string>[];
    logoUrls: KnowledgeField<string>[];
  };

  // ONLINE PRESENCE, PEOPLE, AND OFFERINGS
  socialProfiles: SocialProfile[];
  people: KeyPerson[];
  offerings: Offering[];

  // EXTRA WEBSITE KNOWLEDGE
  content: {
    topics: KnowledgeField<string>[];
    faqs: FrequentlyAskedQuestion[];
    testimonials: KnowledgeField<string>[];
    trustSignals: KnowledgeField<string>[];
  };

  // SMALL, OPTIONAL OWNER CONTROLS
  marketing: {
    voice: VoicePreferences;
    claims: MarketingClaim[];
    promotions: Promotion[];
    preferredCallToAction: KnowledgeField<string>;
    customersWanted: KnowledgeField<string[]>;
    customersNotSuitable: KnowledgeField<string[]>;
    triggerMoments: KnowledgeField<string[]>;
    genericPhrasesToAvoid: string[];
  };

  // ORIGINAL SOURCES AND COLLECTION WARNINGS
  sources: SourcePage[];
  warnings: {
    url: string;
    message: string;
  }[];
}