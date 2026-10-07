"use client";

import { BadgeCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { EventView } from "@/lib/db/listings";
import { eventParts, formatMiles } from "@/lib/format";
import { useI18n } from "./I18nProvider";

export function EventRow({ event }: { event: EventView }) {
  const { t, lang } = useI18n();
  const start = eventParts(event.startsAt, lang);
  const end = eventParts(event.endsAt, lang);
  return (
    <Link
      href={`/listing/${event.listingId}`}
      className="interactive-card flex items-center gap-3.5 rounded-2xl border border-line bg-paper/90 p-3 shadow-card backdrop-blur hover:bg-mint/40 active:bg-mint"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-mint text-center leading-none text-ink">
        <span>
          <span className="block text-[10px] font-bold tracking-wide text-forest">{start.weekday}</span>
          <span className="mt-0.5 block font-display text-xl font-semibold">{start.day}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold text-ink">{event.title}</span>
        <span className="block truncate text-xs text-muted">
          {event.place}
          {event.distanceMiles !== null && <> · {t("card.miles", { n: formatMiles(event.distanceMiles) })}</>}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-body">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {start.time} – {end.time}
          {event.recurring && <span className="ml-1 rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-medium text-muted">{t("events.recurring")}</span>}
        </span>
      </span>
      {event.verifiedOrganizer && (
        <BadgeCheck className="h-5 w-5 shrink-0 text-forest" aria-label={t("card.verifiedOrganizer")} />
      )}
    </Link>
  );
}
