"use client";

// App chrome shared by every resident screen: brand, language, appearance and navigation.

import { Bell, CalendarDays, Globe2, House, Map as MapIcon, MapPin, Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Key } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/types";
import { useI18n } from "./I18nProvider";
import { useTheme, type ThemeChoice } from "./ThemeProvider";

const LANGUAGES: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ru", label: "Русский" },
  { code: "sw", label: "Kiswahili" },
];

export function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="FoodLink Alabama">
      <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl bg-forest text-white shadow-card transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
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
    <label className="relative flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper/90 px-3 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">
      <Globe2 className="h-4 w-4 text-forest" aria-hidden />
      <span className="sr-only">{t("lang.switch")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("lang.switch")}
        className="cursor-pointer appearance-none bg-transparent pe-4 text-sm font-bold text-ink outline-none"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-3 text-[9px] text-muted">▼</span>
    </label>
  );
}

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex rounded-full border border-line bg-paper/90 p-1 shadow-card backdrop-blur" aria-label="Appearance">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className={`grid h-8 w-8 place-items-center rounded-full transition-all duration-200 ${
            theme === value ? "bg-forest text-white shadow-card" : "text-muted hover:bg-mint hover:text-forest"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function HeaderControls() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ThemeToggle />
      <LangToggle />
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
      className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:static md:flex md:justify-center md:gap-1 md:border-t-0 md:pb-0"
    >
      {TABS.map(({ href, key, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium transition-all md:min-h-12 md:flex-row md:gap-2 md:px-5 md:text-sm ${
              active ? "text-forest" : "text-muted hover:text-forest"
            }`}
          >
            {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-forest md:inset-x-4" aria-hidden />}
            <Icon className="h-[22px] w-[22px] transition-transform group-hover:-translate-y-0.5" strokeWidth={active ? 2.4 : 1.8} fill={active && Icon === House ? "currentColor" : "none"} aria-hidden />
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
