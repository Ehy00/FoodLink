"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";

export function SecurityShowcase() {
  const { t } = useI18n();
  return (
    <section className="security-shell relative overflow-hidden rounded-[28px] border border-mint-line bg-mint/80 p-5 shadow-card backdrop-blur-xl md:col-span-2 md:p-6">
      <div className="pointer-events-none absolute -end-14 -top-16 h-40 w-40 rounded-full bg-forest/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex max-w-3xl items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest text-white shadow-card">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t("home.private.title")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-body">{t("home.private.body")}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{t("security.simple.body")}</p>
          </div>
        </div>
        <Link
          href="/privacy"
          className="rounded-full border border-forest/20 bg-paper/80 px-4 py-2 text-xs font-bold text-forest transition hover:-translate-y-0.5 hover:bg-paper hover:shadow-card"
        >
          {t("privacy.link")} →
        </Link>
      </div>
    </section>
  );
}
