"use client";

// Step 3 of the resident journey: everything needed to actually get food.

import { Accessibility, ChevronLeft, Clock, IdCard, MapPin, Share2, ShoppingBasket, TriangleAlert, User } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  daysLabel,
  eligibilityText,
  eventParts,
  formatMiles,
  hoursNote,
  nthLabel,
  openLabel,
  relativeDay,
  timeRange,
} from "@/lib/format";
import { haversineMiles } from "@/lib/geo";
import type { Key } from "@/lib/i18n/dictionary";
import type { ListingView } from "@/lib/types";
import { ConfirmBox } from "./ConfirmBox";
import { useI18n } from "./I18nProvider";
import { ActionButtons, FreshnessBadge, VerifiedOrganizer } from "./listing-bits";
import { useSearch } from "./SearchProvider";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse bg-line/60" aria-hidden />,
});

function Row({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className={`flex gap-3 border-b border-line py-3 last:border-b-0 ${children ? "" : "items-center"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-forest">{icon}</span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className="text-sm font-bold text-ink">{title}</p>
        {children && <div className="text-[13px] text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function ListingDetail({ listing }: { listing: ListingView }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { origin } = useSearch();
  const [shared, setShared] = useState(false);

  // Distance is worked out on the device from the search already in memory.
  const miles = origin ? haversineMiles(origin, listing) : null;
  const note = hoursNote(listing, lang);
  const isOpen = listing.open.state === "open";

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {
      /* the resident closed the share sheet */
    }
  }

  const idText = t(`detail.id.${listing.idRequired}` as Key);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <MapView listings={[listing]} origin={null} className="h-56" locked singleZoom={15} />
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label={t("results.back")}
          className="absolute left-4 top-4 z-[500] grid h-11 w-11 place-items-center rounded-full bg-paper text-ink shadow-card"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={share}
          aria-label={t("detail.share")}
          className="absolute right-4 top-4 z-[500] grid h-11 w-11 place-items-center rounded-full bg-paper text-ink shadow-card"
        >
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
        {shared && (
          <p role="status" className="absolute right-4 top-[4.25rem] z-[500] rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
            {t("detail.shared")}
          </p>
        )}
      </div>

      <div className="relative z-10 -mt-5 flex flex-1 flex-col gap-4 rounded-t-3xl bg-cream px-5 pb-8 pt-5">
        <div>
          <h1 className="font-display text-[22px] font-semibold leading-tight text-ink">{listing.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t(`type.${listing.type}` as Key)}
            {miles !== null && <> · {t("detail.away", { n: formatMiles(miles) })}</>}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <FreshnessBadge listing={listing} />
            {listing.verifiedOrganizer && <VerifiedOrganizer />}
          </div>
        </div>

        {(listing.underReview || listing.freshness.level !== "fresh") && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {listing.underReview ? t("alerts.under_review") : `${t(listing.freshness.level === "stale" ? "fresh.stale" : "fresh.check")}.`}{" "}
              <span className="whitespace-nowrap text-xs opacity-80">{t("fresh.score", { n: listing.freshness.score })}</span>
            </span>
          </p>
        )}

        <div className="rounded-2xl border border-line bg-paper px-4 shadow-card">
          <Row icon={<Clock className="h-[18px] w-[18px]" aria-hidden />} title={openLabel(t, listing.open)}>
            {listing.type === "event" && listing.startsAt && listing.endsAt ? (
              <p>
                {(() => {
                  const s = eventParts(listing.startsAt, lang);
                  const e = eventParts(listing.endsAt, lang);
                  return `${s.weekday} ${s.day} ${s.month} · ${s.time} – ${e.time}`;
                })()}
              </p>
            ) : (
              <ul>
                {listing.hours.weekly.map((w, i) => (
                  <li key={`w${i}`}>
                    {daysLabel(w.days, lang)} · {timeRange(w.open, w.close)}
                  </li>
                ))}
                {listing.hours.monthly.map((m, i) => (
                  <li key={`m${i}`}>
                    {nthLabel(m.nth, m.weekday, lang)} · {timeRange(m.open, m.close)}
                  </li>
                ))}
              </ul>
            )}
            {note && <p className={isOpen ? "" : "text-body"}>{note}</p>}
          </Row>
          <Row icon={<MapPin className="h-[18px] w-[18px]" aria-hidden />} title={listing.address}>
            {listing.city}, AL {listing.zip}
            {listing.geoApprox && <> · {t("card.approx")}</>}
          </Row>
          <Row icon={<User className="h-[18px] w-[18px]" aria-hidden />} title={t("detail.who")}>
            {eligibilityText(listing, lang)}
            {listing.appointmentRequired && <p className="font-medium text-amber">{t("detail.appointment")}</p>}
          </Row>
          <Row icon={<IdCard className="h-[18px] w-[18px]" aria-hidden />} title={idText} />
          <Row icon={<ShoppingBasket className="h-[18px] w-[18px]" aria-hidden />} title={t("detail.available")}>
            {listing.offers.map((o) => t(`tag.${o}` as Key)).join(" · ")}
          </Row>
          <Row
            icon={<Accessibility className="h-[18px] w-[18px]" aria-hidden />}
            title={t(`detail.wheelchair.${listing.wheelchair}` as Key)}
          />
        </div>

        <ActionButtons listing={listing} size="lg" />

        <ConfirmBox listingId={listing.id} />

        <footer className="space-y-0.5 text-center text-xs text-muted">
          <p>
            {t(listing.verifiedOrganizer ? "detail.updatedOrganizer" : "detail.updatedTeam", {
              when: relativeDay(listing.lastVerifiedAt, lang),
            })}
          </p>
          {listing.confirmations7d > 0 && (
            <p>
              {listing.confirmations7d === 1
                ? t("detail.confirmed.one")
                : t("detail.confirmed.many", { n: listing.confirmations7d })}
            </p>
          )}
          {listing.website && /^https?:\/\//i.test(listing.website) && (
            <p>
              <a href={listing.website} target="_blank" rel="noopener noreferrer" className="underline">
                {new URL(listing.website).hostname.replace(/^www\./, "")}
              </a>
            </p>
          )}
          {listing.sourceUrl && (
            <p>
              {t("detail.source")}:{" "}
              <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {new URL(listing.sourceUrl).hostname.replace(/^www\./, "")}
              </a>
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
