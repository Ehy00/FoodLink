// Shared domain types for FoodLink.

export type Lang = "en" | "es";

export type ListingType =
  | "food_bank"
  | "pantry"
  | "meal"
  | "campus_pantry"
  | "school_meal"
  | "mobile"
  | "event";

/** What a place gives out. */
export type Offer = "groceries" | "hot_meal" | "produce" | "baby" | "hygiene";

/** Who a place says it is set up for. Never used to exclude anyone. */
export type Audience = "anyone" | "families" | "kids" | "seniors" | "students";

/** "unknown" is a real answer: we never guess a policy we have not confirmed. */
export type Tri = "yes" | "no" | "unknown";

export interface WeeklyHours {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** 24h "HH:MM" local time (America/Chicago) */
  open: string;
  close: string;
}

export interface MonthlyHours {
  /** Which occurrences of the weekday in a month: 1 = first ... 5 = fifth */
  nth: number[];
  weekday: number;
  open: string;
  close: string;
}

export interface Hours {
  weekly: WeeklyHours[];
  monthly: MonthlyHours[];
}

export interface Listing {
  id: string;
  name: string;
  type: ListingType;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  geoApprox: boolean;
  phone: string | null;
  website: string | null;
  hours: Hours;
  hoursNoteEn: string | null;
  hoursNoteEs: string | null;
  eligibilityEn: string;
  eligibilityEs: string;
  idRequired: Tri;
  appointmentRequired: boolean;
  wheelchair: Tri;
  offers: Offer[];
  audiences: Audience[];
  /** Only for type "event": ISO timestamps. Expired events are never returned. */
  startsAt: string | null;
  endsAt: string | null;
  organizerId: string | null;
  verifiedOrganizer: boolean;
  lastVerifiedAt: string;
  sourceUrl: string | null;
  underReview: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Listing plus everything computed per request. */
export interface ListingView extends Listing {
  distanceMiles: number | null;
  open: OpenStatus;
  freshness: Freshness;
  confirmations7d: number;
}

export interface OpenStatus {
  state: "open" | "opens_later" | "closed_today" | "unknown";
  /** "HH:MM" local time when it closes (state open) or opens (opens_later). */
  until: string | null;
  openToday: boolean;
}

export interface Freshness {
  /** 0..100 */
  score: number;
  level: "fresh" | "check" | "stale";
  daysSinceVerified: number;
}

/** The structured tags the AI request parser produces. All fields are editable by the user. */
export interface SearchTags {
  needs: Offer[];
  audiences: Audience[];
  noId: boolean;
  wheelchair: boolean;
  when: "any" | "today" | "now";
  zip: string | null;
}

export interface ParseResult {
  tags: SearchTags;
  /** Language the request was written in, as detected by the parser. */
  lang: Lang;
  /** Which engine produced the tags, shown in the UI for transparency. */
  engine: "llm" | "rules";
}

export interface ScreeningFlag {
  code:
    | "duplicate"
    | "address_out_of_area"
    | "address_incomplete"
    | "zip_mismatch"
    | "coords_out_of_area"
    | "scam_language"
    | "asks_for_sensitive_info"
    | "suspicious_link"
    | "phone_suspicious"
    | "low_detail";
  severity: "low" | "medium" | "high";
  detail: string;
}

export interface ScreeningResult {
  risk: "low" | "medium" | "high";
  flags: ScreeningFlag[];
  /** Short plain-language note for the human reviewer. */
  summary: string;
  engine: "llm+rules" | "rules";
  /** The AI never publishes or rejects. This is always "needs_human_review". */
  decision: "needs_human_review";
}

export type Role = "organizer" | "reviewer";

export interface SessionUser {
  id: string;
  role: Role;
  orgName: string;
  email: string;
}

/** Fields an organizer may submit. Everything else is set by the server. */
export interface ListingDraft {
  name: string;
  type: ListingType;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  hours: Hours;
  hoursNoteEn: string | null;
  eligibilityEn: string;
  idRequired: Tri;
  appointmentRequired: boolean;
  wheelchair: Tri;
  offers: Offer[];
  audiences: Audience[];
  startsAt: string | null;
  endsAt: string | null;
}
