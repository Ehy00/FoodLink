// Input validation. Every API route validates its body against one of these
// schemas before touching the database. Anything not listed here is dropped.

import { z } from "zod";
import { MAX_REQUEST_CHARS } from "./ai/redact";

const OFFERS = ["groceries", "hot_meal", "produce", "baby", "hygiene"] as const;
const AUDIENCES = ["anyone", "families", "kids", "seniors", "students"] as const;
const TYPES = ["food_bank", "pantry", "meal", "campus_pantry", "school_meal", "mobile", "event"] as const;
const TRI = ["yes", "no", "unknown"] as const;

/** Plain text only: no control characters and no angle brackets (blocks HTML and script injection). */
function text(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/.test(s), "Contains characters that are not allowed.");
}

const zip = z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.");

export const tagsSchema = z.object({
  needs: z.array(z.enum(OFFERS)).max(5),
  audiences: z.array(z.enum(AUDIENCES)).max(5),
  noId: z.boolean(),
  wheelchair: z.boolean(),
  when: z.enum(["any", "today", "now"]),
  zip: zip.nullable(),
});

export const parseSchema = z.object({
  text: text(1, MAX_REQUEST_CHARS),
});

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const searchSchema = z.object({
  tags: tagsSchema,
  /** A device location, already rounded on the device. Optional. */
  origin: pointSchema.nullable(),
});

export const askSchema = z.object({
  text: text(1, MAX_REQUEST_CHARS),
  previousTags: tagsSchema.nullable(),
  continueConversation: z.boolean(),
  /** A device location, already rounded on the device. Optional. */
  origin: pointSchema.nullable(),
});

export const eventsSchema = z.object({
  zip: zip.nullable(),
  origin: pointSchema.nullable(),
});

export const reportSchema = z.object({
  reason: z.enum(["closed", "wrong_hours", "wrong_address", "asked_for_money", "turned_away", "other"]),
  note: text(0, 300).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const applySchema = z.object({
  orgName: text(3, 100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9()+.\- ]{7,20}$/, "Enter a phone number."),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200)
    .refine((p) => new Set(p).size >= 6, "That password is too repetitive."),
});

const weeklySchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    open: hhmm,
    close: hhmm,
  })
  .refine((w) => w.open < w.close, "Closing time must be after opening time.");

const monthlySchema = z
  .object({
    nth: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    weekday: z.number().int().min(0).max(6),
    open: hhmm,
    close: hhmm,
  })
  .refine((m) => m.open < m.close, "Closing time must be after opening time.");

const isoDate = z.string().datetime({ offset: true });

export const listingDraftSchema = z
  .object({
    name: text(3, 100),
    type: z.enum(TYPES),
    address: text(5, 120),
    city: text(2, 60),
    zip,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9()+.\- ]{7,20}$/, "Enter a phone number.")
      .nullable(),
    // Web links only. Blocks javascript:, data: and other schemes that could run code when clicked.
    website: z
      .string()
      .trim()
      .max(200)
      .refine((u) => {
        try {
          return ["http:", "https:"].includes(new URL(u).protocol);
        } catch {
          return false;
        }
      }, "Enter a web address that starts with https://")
      .nullable(),
    hours: z.object({
      weekly: z.array(weeklySchema).max(14),
      monthly: z.array(monthlySchema).max(6),
    }),
    hoursNoteEn: text(0, 200).nullable(),
    eligibilityEn: text(3, 400),
    idRequired: z.enum(TRI),
    appointmentRequired: z.boolean(),
    wheelchair: z.enum(TRI),
    offers: z.array(z.enum(OFFERS)).min(1).max(5),
    audiences: z.array(z.enum(AUDIENCES)).min(1).max(5),
    startsAt: isoDate.nullable(),
    endsAt: isoDate.nullable(),
  })
  .refine((d) => d.type !== "event" || (d.startsAt !== null && d.endsAt !== null), {
    message: "An event needs a start and an end time.",
    path: ["startsAt"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, {
    message: "The event must end after it starts.",
    path: ["endsAt"],
  });

export const revisionSubmitSchema = z.object({
  /** Null for a brand-new listing, or the id of the listing being updated. */
  listingId: z.string().max(80).nullable(),
  draft: listingDraftSchema,
});

export const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: text(0, 300).optional(),
});

export const reportDecisionSchema = z.object({
  decision: z.enum(["resolve", "dismiss", "unpublish"]),
});

export const idParam = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
