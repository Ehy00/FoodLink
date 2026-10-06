"use client";

// Building blocks used wherever a listing is shown.

import { BadgeCheck, Clock, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { directionsUrl, formatMiles, telUrl, verifiedLabel, whenLabel } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import type { ListingView } from "@/lib/types";
import { useI18n } from "./I18nProvider";

/**
 * The trust signal on every listing. Green only when the freshness score says
 * the listing was checked recently; otherwise it tells the resident to call.
 */
export function FreshnessBadge({ listing }: { listing: Pick<ListingView, "freshness" | "underReview"> }) {
  const { t } = useI18n();
  const { freshness, underReview } = listing;
  let label: string;
  let style: string;
  if (underReview) {
    label = t("fresh.review");
    style = "bg-danger-soft text-danger";
  } else if (freshness.level === "fresh") {
    label = verifiedLabel(t, freshness);
    style = "bg-forest text-white";
  } else if (freshness.level === "check") {
    label = verifiedLabel(t, freshness);
    style = "bg-amber-soft text-amber";
  } else {
    label = t("fresh.stale");
    style = "bg-line text-muted";
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-none ${style}`}
      title={t("fresh.score", { n: freshness.score })}
    >
      {label}
    </span>
  );
}

export function VerifiedOrganizer() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-forest">
      <BadgeCheck className="h-4 w-4" aria-hidden />
      {t("card.verifiedOrganizer")}
    </span>
  );
}

export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "ai" | "warn" }) {
  const styles = {
    plain: "border-line bg-cream text-body",
    ai: "border-ai-line bg-paper text-ai-dark",
    warn: "border-amber-soft bg-amber-soft text-amber",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

/** Up to three short facts shown as chips on a card. */
export function listingChips(l: ListingView, t: (k: Key) => string): string[] {
  const chips: string[] = [];
  for (const offer of l.offers) chips.push(t(`tag.${offer}` as Key));
  if (l.idRequired === "no") chips.splice(1, 0, t("tag.no_id"));
  for (const a of l.audiences) if (a !== "anyone") chips.push(t(`tag.${a}` as Key));
  return chips.slice(0, 3);
}

export function ActionButtons({ listing, size = "md" }: { listing: ListingView; size?: "md" | "lg" }) {
  const { t } = useI18n();
  const height = size === "lg" ? "min-h-12 text-[15px]" : "min-h-11 text-sm";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <a
        href={directionsUrl(listing)}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 rounded-full bg-forest font-bold text-white active:bg-forest-dark ${height}`}
      >
        <Navigation className="h-4 w-4" fill="currentColor" aria-hidden />
        {t("card.directions")}
      </a>
      {listing.phone ? (
        <a
          href={telUrl(listing.phone)}
          className={`flex items-center justify-center gap-2 rounded-full border-2 border-forest bg-paper font-bold text-forest active:bg-mint ${height}`}
        >
          <Phone className="h-4 w-4" aria-hidden />
          {t("card.call")}
        </a>
      ) : (
        <span
          className={`flex items-center justify-center rounded-full border-2 border-line bg-cream px-2 text-center font-medium text-muted ${height}`}
        >
          {t("card.noPhone")}
        </span>
      )}
    </div>
  );
}

export function ListingCard({ listing }: { listing: ListingView }) {
  const { t, lang } = useI18n();
  const chips = listingChips(listing, t);
  return (
    <article className="rounded-2xl border border-line bg-paper p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold leading-snug text-ink">
          <Link href={`/listing/${listing.id}`} className="underline-offset-2 hover:underline">
            {listing.name}
          </Link>
        </h3>
        <FreshnessBadge listing={listing} />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {listing.distanceMiles !== null && <>{t("card.miles", { n: formatMiles(listing.distanceMiles) })} · </>}
          {whenLabel(t, listing, lang)}
        </span>
      </p>
      {listing.verifiedOrganizer && (
        <p className="mt-1.5">
          <VerifiedOrganizer />
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Pill key={c}>{c}</Pill>
        ))}
      </div>
      <div className="mt-3.5">
        <ActionButtons listing={listing} />
      </div>
    </article>
  );
}
