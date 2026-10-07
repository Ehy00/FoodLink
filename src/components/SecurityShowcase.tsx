"use client";

import { EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";

const ITEMS = [
  { icon: EyeOff, title: "security.search.title", body: "security.search.body" },
  { icon: LockKeyhole, title: "security.encryption.title", body: "security.encryption.body" },
  { icon: KeyRound, title: "security.2fa.title", body: "security.2fa.body" },
  { icon: UserCheck, title: "security.review.title", body: "security.review.body" },
] as const;

export function SecurityShowcase() {
  const { t } = useI18n();
  return (
    <section className="security-shell relative overflow-hidden rounded-[28px] border border-mint-line bg-mint/80 p-5 shadow-card backdrop-blur-xl md:col-span-2 md:p-6">
      <div className="pointer-events-none absolute -end-14 -top-16 h-40 w-40 rounded-full bg-forest/10 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest text-white shadow-card">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest">{t("security.badge")}</p>
              <h2 className="mt-0.5 font-display text-lg font-semibold text-ink">{t("security.title")}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">{t("security.body")}</p>
            </div>
          </div>
          <Link href="/privacy" className="rounded-full border border-forest/20 bg-paper/80 px-4 py-2 text-xs font-bold text-forest transition hover:-translate-y-0.5 hover:bg-paper hover:shadow-card">
            {t("privacy.link")} →
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="interactive-card rounded-2xl border border-line/80 bg-paper/80 p-4 shadow-card backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-forest">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-[10px] font-bold text-muted">0{index + 1}</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-ink">{t(title)}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
