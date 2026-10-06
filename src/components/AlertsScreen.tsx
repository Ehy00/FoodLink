"use client";

// Alerts without accounts. The ZIP code is kept in this browser's own storage
// (and only after the resident chooses to save it), then sent to /api/alerts
// to ask "what changed near here?". The server keeps no list of who asked.

import { BellRing, CalendarDays, MessageSquareText, RefreshCw, Sparkle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { postJson } from "@/lib/client-api";
import type { AlertItem } from "@/lib/db/listings";
import { formatMiles, relativeDay } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import { useI18n } from "./I18nProvider";

const STORAGE_KEY = "foodlink.alerts.zip";

const ICONS = {
  new: Sparkle,
  updated: RefreshCw,
  under_review: TriangleAlert,
  event_today: CalendarDays,
} as const;

function readSavedZip(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return /^\d{5}$/.test(saved) ? saved : "";
  } catch {
    return "";
  }
}

export function AlertsScreen() {
  const { t, lang } = useI18n();
  const [zip, setZip] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Read the device's saved ZIP once, after hydration.
  useEffect(() => {
    const z = readSavedZip();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only storage
    setSaved(z);
    setZip(z);
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

      <div className="mt-5 flex gap-3 rounded-2xl border border-dashed border-line p-4 text-sm">
        <MessageSquareText className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <p>
          <span className="block font-bold text-ink">{t("alerts.text.title")}</span>
          <span className="text-muted">{t("alerts.text.body")}</span>
        </p>
      </div>
    </div>
  );
}
