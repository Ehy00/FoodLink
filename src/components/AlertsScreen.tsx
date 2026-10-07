"use client";

// Resident alerts stay opt-in. ZIP-only alert browsing works today.
// SMS controls below are a prototype UI until a real SMS provider is connected.

import { BellRing, CalendarDays, CheckCircle2, MessageSquareText, RefreshCw, Sparkle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { postJson } from "@/lib/client-api";
import type { AlertItem } from "@/lib/db/listings";
import { formatMiles, relativeDay } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import { useI18n } from "./I18nProvider";

const STORAGE_KEY = "foodlink.alerts.zip";
const SMS_STORAGE_KEY = "foodlink.alerts.sms-demo";

const ICONS = {
  new: Sparkle,
  updated: RefreshCw,
  under_review: TriangleAlert,
  event_today: CalendarDays,
} as const;

interface SmsDemoPreference {
  zip: string;
  phone: string;
  enabled: boolean;
}

function readSavedZip(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return /^\d{5}$/.test(saved) ? saved : "";
  } catch {
    return "";
  }
}

function readSmsPreference(): SmsDemoPreference | null {
  try {
    const raw = window.localStorage.getItem(SMS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmsDemoPreference;
    if (!/^\d{5}$/.test(parsed.zip) || !parsed.phone || !parsed.enabled) return null;
    return parsed;
  } catch {
    return null;
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `•••-•••-${digits.slice(-4)}`;
}

export function AlertsScreen() {
  const { t, lang } = useI18n();
  const [zip, setZip] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [invalid, setInvalid] = useState(false);

  const [smsZip, setSmsZip] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [smsInvalid, setSmsInvalid] = useState("");
  const [smsPreference, setSmsPreference] = useState<SmsDemoPreference | null>(null);

  useEffect(() => {
    const z = readSavedZip();
    const sms = readSmsPreference();
    setSaved(z);
    setZip(z);
    setSmsZip(sms?.zip || z);
    setSmsPhone(sms?.phone || "");
    setSmsPreference(sms);
  }, []);

  useEffect(() => {
    if (saved === null) return;
    let cancelled = false;
    postJson<{ alerts: AlertItem[] }>("/api/alerts", { zip: saved || null, origin: null })
      .then((r) => !cancelled && setAlerts(r.alerts))
      .catch(() => !cancelled && setAlerts([]));
    return () => {
      cancelled = true;
    };
  }, [saved]);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setInvalid(true);
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, zip);
    } catch {
      /* private browsing: alerts still work for this visit */
    }
    setAlerts(null);
    setSaved(zip);
    if (!smsZip) setSmsZip(zip);
  }

  function forget() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing stored */
    }
    setZip("");
    setAlerts(null);
    setSaved("");
  }

  function enableSmsDemo(e: FormEvent) {
    e.preventDefault();
    setSmsInvalid("");

    if (!/^\d{5}$/.test(smsZip)) {
      setSmsInvalid("Enter a valid 5-digit ZIP code.");
      return;
    }

    const digits = smsPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      setSmsInvalid("Enter a valid mobile number.");
      return;
    }

    if (!smsConsent) {
      setSmsInvalid("Please agree to receive FoodLink alert texts before turning alerts on.");
      return;
    }

    const next: SmsDemoPreference = {
      zip: smsZip,
      phone: smsPhone.trim(),
      enabled: true,
    };

    try {
      window.localStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(STORAGE_KEY, smsZip);
    } catch {
      /* demo remains active for this visit even when local storage is blocked */
    }

    setSmsPreference(next);
    setSaved(smsZip);
    setZip(smsZip);
  }

  function disableSmsDemo() {
    try {
      window.localStorage.removeItem(SMS_STORAGE_KEY);
    } catch {
      /* nothing stored */
    }
    setSmsPreference(null);
    setSmsConsent(false);
  }

  return (
    <div className="px-5 pb-8 pt-4">
      <h1 className="font-display text-[22px] font-semibold text-ink">{t("alerts.title")}</h1>
      <p className="mt-0.5 text-sm text-muted">{t("alerts.subtitle")}</p>

      <form onSubmit={save} className="mt-4 rounded-2xl border border-line bg-paper p-4 shadow-card">
        <label htmlFor="alert-zip" className="text-sm font-bold text-ink">
          {t("alerts.zip.label")}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="alert-zip"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              setInvalid(false);
            }}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby="alert-zip-note"
            className="min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-forest px-4 text-sm font-bold text-white">
            {t("alerts.zip.save")}
          </button>
        </div>
        {invalid && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {t("home.zip.invalid")}
          </p>
        )}
        <p id="alert-zip-note" className="mt-2 text-xs text-muted">
          {t("alerts.zip.note")}
        </p>
        {saved && (
          <button type="button" onClick={forget} className="mt-1 min-h-9 text-xs font-bold text-forest underline">
            {t("alerts.zip.clear")}
          </button>
        )}
      </form>

      <ul className="mt-4 flex flex-col gap-2.5" aria-live="polite">
        {alerts === null && <li className="h-16 animate-pulse rounded-2xl bg-line/60" aria-hidden />}
        {alerts?.length === 0 && (
          <li className="flex items-center gap-2.5 rounded-2xl bg-mint px-4 py-3 text-sm text-body">
            <BellRing className="h-5 w-5 text-forest" aria-hidden />
            {t("alerts.empty")}
          </li>
        )}
        {alerts?.map((a) => {
          const Icon = ICONS[a.kind];
          const warn = a.kind === "under_review";
          return (
            <li key={`${a.kind}-${a.listingId}`}>
              <Link
                href={`/listing/${a.listingId}`}
                className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-3.5 shadow-card active:bg-mint"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${warn ? "bg-amber-soft text-amber" : "bg-mint text-forest"}`}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 leading-snug">
                  <span className="block font-display text-[15px] font-semibold text-ink">{a.name}</span>
                  <span className={`block text-[13px] ${warn ? "text-amber" : "text-body"}`}>{t(`alerts.${a.kind}` as Key)}</span>
                  <span className="block text-xs text-muted">
                    {a.kind !== "event_today" && relativeDay(a.at, lang)}
                    {a.distanceMiles !== null && (
                      <>
                        {a.kind !== "event_today" && " · "}
                        {t("card.miles", { n: formatMiles(a.distanceMiles) })}
                      </>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-ai-line bg-paper shadow-card">
        <div className="bg-ai-soft/70 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ai text-white">
              <MessageSquareText className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Get a text when food is happening near you</h2>
              <p className="mt-1 text-sm text-muted">
                Opt in with your ZIP code and mobile number to receive alerts for nearby food giveaways and important resource updates.
              </p>
            </div>
          </div>
        </div>

        {smsPreference ? (
          <div className="p-5">
            <div className="flex items-start gap-3 rounded-2xl border border-mint-line bg-mint p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
              <div>
                <p className="font-display text-base font-semibold text-ink">FoodLink text alerts are on</p>
                <p className="mt-1 text-sm text-body">
                  ZIP {smsPreference.zip} · {maskPhone(smsPreference.phone)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Prototype mode: this preference is saved on this device, but FoodLink is not connected to an SMS delivery provider yet, so no real text message will be sent.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={disableSmsDemo}
              className="mt-4 min-h-11 rounded-full border-2 border-danger px-4 text-sm font-bold text-danger"
            >
              Turn Off Alerts
            </button>
          </div>
        ) : (
          <form onSubmit={enableSmsDemo} className="space-y-4 p-5">
            <div>
              <label htmlFor="sms-alert-zip" className="text-sm font-bold text-ink">ZIP code</label>
              <input
                id="sms-alert-zip"
                value={smsZip}
                onChange={(e) => {
                  setSmsZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                  setSmsInvalid("");
                }}
                inputMode="numeric"
                placeholder="35801"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink"
              />
            </div>

            <div>
              <label htmlFor="sms-alert-phone" className="text-sm font-bold text-ink">Mobile number</label>
              <input
                id="sms-alert-phone"
                value={smsPhone}
                onChange={(e) => {
                  setSmsPhone(e.target.value.slice(0, 22));
                  setSmsInvalid("");
                }}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(256) 555-0123"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-cream p-3">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => {
                  setSmsConsent(e.target.checked);
                  setSmsInvalid("");
                }}
                className="mt-1 h-4 w-4 accent-[var(--color-forest)]"
              />
              <span className="text-sm leading-relaxed text-body">
                I agree to receive FoodLink food-alert text messages at the number I entered. I can turn alerts off at any time.
              </span>
            </label>

            {smsInvalid && <p role="alert" className="text-sm text-danger">{smsInvalid}</p>}

            <button type="submit" className="min-h-12 w-full rounded-full bg-forest px-5 text-sm font-bold text-white">
              Turn On Alerts
            </button>

            <p className="text-xs leading-relaxed text-muted">
              Demo/prototype only: the sign-up experience is implemented, but actual SMS delivery is not connected yet. A real SMS provider can be added later without changing this resident-facing flow.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
