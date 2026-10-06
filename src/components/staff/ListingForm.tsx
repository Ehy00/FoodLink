"use client";

// Organizer form for a new listing or an update. Submitting does not publish
// anything: it creates a revision that the AI screens and a person reviews.

import { Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import { DEFAULT_CENTER, zipToPoint } from "@/lib/geo";
import type { Audience, Listing, ListingDraft, ListingType, MonthlyHours, Offer, ScreeningResult, Tri, WeeklyHours } from "@/lib/types";
import { ErrorNote, Field, inputClass, primaryButton, ScreeningPanel, secondaryButton, TextInput } from "./ui";

const PinPicker = dynamic(() => import("./PinPicker"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-xl bg-line/60" aria-hidden />,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPES: Array<[ListingType, string]> = [
  ["pantry", "Food pantry"],
  ["food_bank", "Food bank"],
  ["meal", "Free meals"],
  ["campus_pantry", "Campus pantry"],
  ["school_meal", "School or summer meals"],
  ["mobile", "Mobile pantry (regular stop)"],
  ["event", "One-time event"],
];
const OFFERS: Array<[Offer, string]> = [
  ["groceries", "Groceries"],
  ["hot_meal", "Hot meal"],
  ["produce", "Fresh produce"],
  ["baby", "Baby items"],
  ["hygiene", "Hygiene items"],
];
const AUDIENCES: Array<[Audience, string]> = [
  ["anyone", "Anyone"],
  ["families", "Families"],
  ["kids", "Kids"],
  ["seniors", "Seniors"],
  ["students", "Students"],
];
const TRI: Array<[Tri, string]> = [
  ["unknown", "Not sure"],
  ["no", "No"],
  ["yes", "Yes"],
];

function blankDraft(): ListingDraft {
  return {
    name: "",
    type: "pantry",
    address: "",
    city: "Huntsville",
    zip: "",
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
    phone: null,
    website: null,
    hours: { weekly: [], monthly: [] },
    hoursNoteEn: null,
    eligibilityEn: "",
    idRequired: "unknown",
    appointmentRequired: false,
    wheelchair: "unknown",
    offers: ["groceries"],
    audiences: ["anyone"],
    startsAt: null,
    endsAt: null,
  };
}

function fromListing(l: Listing): ListingDraft {
  return {
    name: l.name,
    type: l.type,
    address: l.address,
    city: l.city,
    zip: l.zip,
    lat: l.lat,
    lng: l.lng,
    phone: l.phone,
    website: l.website,
    hours: l.hours,
    hoursNoteEn: l.hoursNoteEn,
    eligibilityEn: l.eligibilityEn,
    idRequired: l.idRequired,
    appointmentRequired: l.appointmentRequired,
    wheelchair: l.wheelchair,
    offers: l.offers,
    audiences: l.audiences,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
  };
}

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function ListingForm({ listing }: { listing?: Listing }) {
  const [d, setD] = useState<ListingDraft>(listing ? fromListing(listing) : blankDraft());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const patch = (p: Partial<ListingDraft>) => setD((prev) => ({ ...prev, ...p }));

  const setWeekly = (i: number, p: Partial<WeeklyHours>) =>
    patch({ hours: { ...d.hours, weekly: d.hours.weekly.map((w, j) => (j === i ? { ...w, ...p } : w)) } });
  const setMonthly = (i: number, p: Partial<MonthlyHours>) =>
    patch({ hours: { ...d.hours, monthly: d.hours.monthly.map((m, j) => (j === i ? { ...m, ...p } : m)) } });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const draft: ListingDraft = {
      ...d,
      phone: d.phone?.trim() || null,
      website: d.website?.trim() || null,
      hoursNoteEn: d.hoursNoteEn?.trim() || null,
      startsAt: d.type === "event" ? d.startsAt : null,
      endsAt: d.type === "event" ? d.endsAt : null,
    };
    try {
      const r = await postJson<{ screening: ScreeningResult }>("/api/organizer/revisions", {
        listingId: listing?.id ?? null,
        draft,
      });
      setResult(r.screening);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4" role="status">
        <h1 className="font-display text-xl font-semibold text-ink">Submitted for review</h1>
        <p className="text-sm text-body">
          Nothing is public yet. Here is what the automated screening found. A FoodLink reviewer will check it and
          then approve or reject the listing.
        </p>
        <ScreeningPanel screening={result} />
        <Link href="/organizer" className={primaryButton}>
          Back to my listings
        </Link>
      </div>
    );
  }

  const section = "rounded-2xl border border-line bg-paper p-5 shadow-card space-y-4";

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">{listing ? `Update ${listing.name}` : "Add a listing"}</h1>

      <section className={section} aria-label="Basics">
        <Field label="Name residents will see" htmlFor="f-name">
          <TextInput id="f-name" value={d.name} onChange={(e) => patch({ name: e.target.value })} required minLength={3} maxLength={100} />
        </Field>
        <Field label="Type" htmlFor="f-type">
          <select id="f-type" value={d.type} onChange={(e) => patch({ type: e.target.value as ListingType })} className={inputClass}>
            {TYPES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" hint="So residents can call ahead." htmlFor="f-phone">
            <TextInput id="f-phone" type="tel" value={d.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} placeholder="256-555-0100" />
          </Field>
          <Field label="Website (optional)" htmlFor="f-web">
            <TextInput id="f-web" type="url" value={d.website ?? ""} onChange={(e) => patch({ website: e.target.value })} placeholder="https://" />
          </Field>
        </div>
      </section>

      <section className={section} aria-label="Where">
        <h2 className="font-display text-base font-semibold text-ink">Where</h2>
        <Field label="Street address" htmlFor="f-address">
          <TextInput id="f-address" value={d.address} onChange={(e) => patch({ address: e.target.value })} required minLength={5} maxLength={120} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" htmlFor="f-city">
            <TextInput id="f-city" value={d.city} onChange={(e) => patch({ city: e.target.value })} required />
          </Field>
          <Field label="ZIP code" htmlFor="f-zip">
            <TextInput
              id="f-zip"
              value={d.zip}
              onChange={(e) => {
                const zip = e.target.value.replace(/\D/g, "").slice(0, 5);
                // Jump the pin to the ZIP's area the first time a known ZIP is typed.
                const point = !listing && zip !== d.zip ? zipToPoint(zip) : null;
                patch(point ? { zip, ...point } : { zip });
              }}
              inputMode="numeric"
              required
              pattern="\d{5}"
            />
          </Field>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Map pin</p>
          <p className="mb-1.5 text-xs text-muted">Click the map or drag the pin to the entrance residents should use.</p>
          <PinPicker value={{ lat: d.lat, lng: d.lng }} onChange={(p) => patch(p)} />
          <div className="mt-2 grid grid-cols-2 gap-4">
            <Field label="Latitude" htmlFor="f-lat">
              <TextInput id="f-lat" type="number" step="0.00001" value={d.lat} onChange={(e) => patch({ lat: Number(e.target.value) })} required />
            </Field>
            <Field label="Longitude" htmlFor="f-lng">
              <TextInput id="f-lng" type="number" step="0.00001" value={d.lng} onChange={(e) => patch({ lng: Number(e.target.value) })} required />
            </Field>
          </div>
        </div>
      </section>

      <section className={section} aria-label="When">
        <h2 className="font-display text-base font-semibold text-ink">When</h2>
        {d.type === "event" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="f-start">
              <TextInput id="f-start" type="datetime-local" value={toLocalInput(d.startsAt)} onChange={(e) => patch({ startsAt: fromLocalInput(e.target.value) })} required />
            </Field>
            <Field label="Ends" hint="The event disappears from FoodLink automatically after this." htmlFor="f-end">
              <TextInput id="f-end" type="datetime-local" value={toLocalInput(d.endsAt)} onChange={(e) => patch({ endsAt: fromLocalInput(e.target.value) })} required />
            </Field>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-bold text-ink">Every week</p>
              {d.hours.weekly.map((w, i) => (
                <div key={i} className="rounded-xl bg-cream p-3">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Days for weekly row ${i + 1}`}>
                    {DAYS.map((day, n) => (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={w.days.includes(n)}
                        onClick={() => setWeekly(i, { days: toggle(w.days, n).sort() })}
                        className={`min-h-9 min-w-11 rounded-full border px-2 text-xs font-bold ${
                          w.days.includes(n) ? "border-forest bg-forest text-white" : "border-line bg-paper text-ink"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <label className="sr-only" htmlFor={`w-open-${i}`}>Opens</label>
                    <input id={`w-open-${i}`} type="time" value={w.open} onChange={(e) => setWeekly(i, { open: e.target.value })} className={`${inputClass} w-32`} required />
                    <span>to</span>
                    <label className="sr-only" htmlFor={`w-close-${i}`}>Closes</label>
                    <input id={`w-close-${i}`} type="time" value={w.close} onChange={(e) => setWeekly(i, { close: e.target.value })} className={`${inputClass} w-32`} required />
                    <button
                      type="button"
                      aria-label={`Remove weekly row ${i + 1}`}
                      onClick={() => patch({ hours: { ...d.hours, weekly: d.hours.weekly.filter((_, j) => j !== i) } })}
                      className="ml-auto grid h-10 w-10 place-items-center rounded-full text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch({ hours: { ...d.hours, weekly: [...d.hours.weekly, { days: [1], open: "09:00", close: "12:00" }] } })}
                className={secondaryButton}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add weekly hours
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-ink">Certain weeks of the month</p>
              {d.hours.monthly.map((m, i) => (
                <div key={i} className="rounded-xl bg-cream p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={m.nth.includes(n)}
                        onClick={() => setMonthly(i, { nth: toggle(m.nth, n).sort() })}
                        className={`min-h-9 min-w-11 rounded-full border px-2 text-xs font-bold ${
                          m.nth.includes(n) ? "border-forest bg-forest text-white" : "border-line bg-paper text-ink"
                        }`}
                      >
                        {["1st", "2nd", "3rd", "4th", "5th"][n - 1]}
                      </button>
                    ))}
                    <label className="sr-only" htmlFor={`m-day-${i}`}>Weekday</label>
                    <select id={`m-day-${i}`} value={m.weekday} onChange={(e) => setMonthly(i, { weekday: Number(e.target.value) })} className={`${inputClass} w-28`}>
                      {DAYS.map((day, n) => (
                        <option key={day} value={n}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <label className="sr-only" htmlFor={`m-open-${i}`}>Opens</label>
                    <input id={`m-open-${i}`} type="time" value={m.open} onChange={(e) => setMonthly(i, { open: e.target.value })} className={`${inputClass} w-32`} required />
                    <span>to</span>
                    <label className="sr-only" htmlFor={`m-close-${i}`}>Closes</label>
                    <input id={`m-close-${i}`} type="time" value={m.close} onChange={(e) => setMonthly(i, { close: e.target.value })} className={`${inputClass} w-32`} required />
                    <button
                      type="button"
                      aria-label={`Remove monthly row ${i + 1}`}
                      onClick={() => patch({ hours: { ...d.hours, monthly: d.hours.monthly.filter((_, j) => j !== i) } })}
                      className="ml-auto grid h-10 w-10 place-items-center rounded-full text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch({ hours: { ...d.hours, monthly: [...d.hours.monthly, { nth: [1], weekday: 6, open: "10:00", close: "12:00" }] } })}
                className={secondaryButton}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add monthly hours
              </button>
            </div>
          </>
        )}
        <Field label="Note about hours (optional)" hint='For example "Until the food runs out" or "Call for holiday hours".' htmlFor="f-hours-note">
          <TextInput id="f-hours-note" value={d.hoursNoteEn ?? ""} onChange={(e) => patch({ hoursNoteEn: e.target.value })} maxLength={200} />
        </Field>
      </section>

      <section className={section} aria-label="Who and what">
        <h2 className="font-display text-base font-semibold text-ink">Who and what</h2>
        <Field label="Who can come, and what should they bring?" hint="Plain words. FoodLink must always be free for residents." htmlFor="f-elig">
          <textarea
            id="f-elig"
            value={d.eligibilityEn}
            onChange={(e) => patch({ eligibilityEn: e.target.value })}
            required
            minLength={3}
            maxLength={400}
            rows={3}
            className={`${inputClass} py-2`}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Is an ID required?" htmlFor="f-id">
            <select id="f-id" value={d.idRequired} onChange={(e) => patch({ idRequired: e.target.value as Tri })} className={inputClass}>
              {TRI.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wheelchair accessible?" htmlFor="f-wheel">
            <select id="f-wheel" value={d.wheelchair} onChange={(e) => patch({ wheelchair: e.target.value as Tri })} className={inputClass}>
              {TRI.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2.5 text-sm text-body">
          <input type="checkbox" checked={d.appointmentRequired} onChange={(e) => patch({ appointmentRequired: e.target.checked })} className="h-5 w-5 accent-forest" />
          By appointment only
        </label>
        <div>
          <p className="text-sm font-bold text-ink">What is offered</p>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {OFFERS.map(([v, label]) => (
              <label key={v} className="flex min-h-10 items-center gap-2 text-sm text-body">
                <input type="checkbox" checked={d.offers.includes(v)} onChange={() => patch({ offers: toggle(d.offers, v) })} className="h-5 w-5 accent-forest" />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Who it is set up for</p>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {AUDIENCES.map(([v, label]) => (
              <label key={v} className="flex min-h-10 items-center gap-2 text-sm text-body">
                <input type="checkbox" checked={d.audiences.includes(v)} onChange={() => patch({ audiences: toggle(d.audiences, v) })} className="h-5 w-5 accent-forest" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Screening…" : "Submit for review"}
        </button>
        <Link href="/organizer" className={secondaryButton}>
          Cancel
        </Link>
      </div>
      <p className="text-xs text-muted">
        Submissions are screened by AI for duplicates, addresses that do not check out, and scam language, then
        approved by a person before anything is shown to residents.
      </p>
    </form>
  );
}
