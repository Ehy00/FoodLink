"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/client-api";
import type { EventView } from "@/lib/db/listings";
import { TIME_ZONE } from "@/lib/hours";
import { EventRow } from "./EventRow";
import { useI18n } from "./I18nProvider";
import { useSearch } from "./SearchProvider";

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

export function EventsScreen() {
  const { t, lang } = useI18n();
  const { tags, deviceOrigin } = useSearch();
  const [events, setEvents] = useState<EventView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    postJson<{ events: EventView[] }>("/api/events", { zip: tags.zip, origin: deviceOrigin })
      .then((r) => !cancelled && setEvents(r.events))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [tags.zip, deviceOrigin]);

  // Read the clock once, when the screen opens.
  const [openedAt] = useState(() => Date.now());
  const today = dayKey(new Date(openedAt).toISOString());
  const tomorrow = dayKey(new Date(openedAt + 86_400_000).toISOString());
  const groups = new Map<string, EventView[]>();
  for (const e of events ?? []) {
    const key = dayKey(e.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const heading = (key: string, iso: string) => {
    if (key === today) return t("events.today");
    if (key === tomorrow) return t("events.tomorrow");
    return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
      timeZone: TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  };

  return (
    <div className="px-5 pb-8 pt-4">
      <h1 className="font-display text-[22px] font-semibold text-ink">{t("events.title")}</h1>
      <p className="mt-0.5 text-sm text-muted">{t("events.subtitle")}</p>

      <div className="mt-4 space-y-5" aria-live="polite">
        {events === null && <div className="h-20 animate-pulse rounded-2xl bg-line/60" aria-hidden />}
        {events?.length === 0 && <p className="text-sm text-muted">{t("events.empty")}</p>}
        {[...groups.entries()].map(([key, list]) => (
          <section key={key}>
            <h2 className="mb-2 text-sm font-bold capitalize text-ink">{heading(key, list[0].startsAt)}</h2>
            <div className="flex flex-col gap-2.5">
              {list.map((e) => (
                <EventRow key={e.key} event={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
