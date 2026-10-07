"use client";

// App chrome shared by every resident screen: logo, language switch, bottom tabs.

import { Bell, CalendarDays, House, Map as MapIcon, MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Key } from "@/lib/i18n/dictionary";
import { useI18n } from "./I18nProvider";

export function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="FoodLink Alabama">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-white">
        <MapPin className="h-5 w-5" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold text-ink">FoodLink</span>
        <span className="block text-xs text-muted">{t("brand.region")}</span>
      </span>
    </Link>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("lang.switch")} className="flex rounded-full bg-mint p-0.5 text-xs font-bold">
      {(["en", "es"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`min-h-9 min-w-10 rounded-full px-2.5 uppercase transition-colors ${
            lang === code ? "bg-forest text-white" : "text-forest"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

const TABS: Array<{ href: string; key: Key; icon: typeof House; match: (p: string) => boolean }> = [
  { href: "/", key: "nav.search", icon: House, match: (p) => p === "/" || p.startsWith("/search") || p.startsWith("/listing") },
  { href: "/map", key: "nav.map", icon: MapIcon, match: (p) => p.startsWith("/map") },
  { href: "/events", key: "nav.events", icon: CalendarDays, match: (p) => p.startsWith("/events") },
  { href: "/alerts", key: "nav.alerts", icon: Bell, match: (p) => p.startsWith("/alerts") },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:flex md:justify-center md:gap-1 md:border-t-0 md:pb-0"
    >
      {TABS.map(({ href, key, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium md:min-h-12 md:flex-row md:gap-2 md:px-5 md:text-sm ${
              active ? "text-forest" : "text-muted"
            }`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} fill={active && Icon === House ? "currentColor" : "none"} aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function PrototypeBanner() {
  const { t } = useI18n();
  return (
    <p className="bg-ink px-4 py-1.5 text-center text-[11px] font-medium text-mint">{t("proto.banner")}</p>
  );
}
