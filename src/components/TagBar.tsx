"use client";

// "FoodLink AI understood": shows the AI's reading of a request as tags the
// resident can remove or add. The AI proposes; the person decides.

import { Lock, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { Key } from "@/lib/i18n/dictionary";
import type { Audience, Offer, SearchTags } from "@/lib/types";
import { useI18n } from "./I18nProvider";

const OFFERS: Offer[] = ["groceries", "hot_meal", "produce", "baby", "hygiene"];
const AUDIENCES: Exclude<Audience, "anyone">[] = ["kids", "families", "seniors", "students"];

interface ActiveTag {
  id: string;
  label: string;
  remove: (t: SearchTags) => SearchTags;
}

export function activeTags(tags: SearchTags, t: (k: Key, v?: Record<string, string | number>) => string): ActiveTag[] {
  const out: ActiveTag[] = [];
  for (const need of tags.needs) {
    out.push({ id: `need-${need}`, label: t(`tag.${need}` as Key), remove: (x) => ({ ...x, needs: x.needs.filter((n) => n !== need) }) });
  }
  for (const a of tags.audiences) {
    if (a === "anyone") continue;
    out.push({ id: `aud-${a}`, label: t(`tag.${a}` as Key), remove: (x) => ({ ...x, audiences: x.audiences.filter((n) => n !== a) }) });
  }
  if (tags.noId) out.push({ id: "noid", label: t("tag.no_id"), remove: (x) => ({ ...x, noId: false }) });
  if (tags.wheelchair) out.push({ id: "wheel", label: t("tag.wheelchair"), remove: (x) => ({ ...x, wheelchair: false }) });
  if (tags.when !== "any") out.push({ id: "when", label: t(tags.when === "now" ? "tag.now" : "tag.today"), remove: (x) => ({ ...x, when: "any" }) });
  if (tags.zip) out.push({ id: "zip", label: tags.zip, remove: (x) => ({ ...x, zip: null }) });
  return out;
}

interface Props {
  tags: SearchTags;
  onChange: (tags: SearchTags) => void;
  /** True when the tags came from a plain-words request (shows the AI framing). */
  fromAi: boolean;
  engine: "llm" | "rules" | null;
}

export function TagBar({ tags, onChange, fromAi, engine }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [zipDraft, setZipDraft] = useState(tags.zip ?? "");
  const active = activeTags(tags, t);

  const toggle = <K extends "needs" | "audiences">(field: K, value: SearchTags[K][number]) => {
    const list = tags[field] as string[];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    onChange({ ...tags, [field]: next } as SearchTags);
  };

  const option = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 rounded-full border px-3 text-[13px] font-medium ${
        on ? "border-ai bg-ai text-white" : "border-ai-line bg-paper text-ai-dark"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-label={fromAi ? t("ai.understood") : t("filters.title")}
      className={`rounded-2xl border p-3.5 ${fromAi ? "border-ai-line bg-ai-soft" : "border-line bg-paper"}`}
    >
      {fromAi && (
        <>
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-ai-dark">
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("ai.understood")}
          </p>
          <p className="mt-1 text-sm leading-snug text-body" aria-live="polite">
            {active.length > 0 ? (
              <>
                {active.map((a) => a.label).join(", ")}. {t("ai.tapToChange")}
              </>
            ) : (
              t("ai.nothing")
            )}
          </p>
        </>
      )}

      <div className={`flex flex-wrap gap-1.5 ${fromAi ? "mt-2.5" : ""}`}>
        {active.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onChange(tag.remove(tags))}
            aria-label={t("tag.remove", { tag: tag.label })}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-ai-line bg-paper pl-3 pr-2 text-[13px] font-medium text-ai-dark active:bg-ai-soft"
          >
            {tag.label}
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-ai px-3 text-[13px] font-bold text-ai-dark"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {editing ? t("filters.done") : t("tag.add")}
        </button>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-ai-line pt-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-muted">{t("filters.need")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {OFFERS.map((o) => option(t(`tag.${o}` as Key), tags.needs.includes(o), () => toggle("needs", o)))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-muted">{t("filters.who")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCES.map((a) => option(t(`tag.${a}` as Key), tags.audiences.includes(a), () => toggle("audiences", a)))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-muted">{t("filters.other")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {option(t("tag.no_id"), tags.noId, () => onChange({ ...tags, noId: !tags.noId }))}
              {option(t("tag.wheelchair"), tags.wheelchair, () => onChange({ ...tags, wheelchair: !tags.wheelchair }))}
              {option(t("tag.today"), tags.when === "today", () => onChange({ ...tags, when: tags.when === "today" ? "any" : "today" }))}
              {option(t("tag.now"), tags.when === "now", () => onChange({ ...tags, when: tags.when === "now" ? "any" : "now" }))}
            </div>
          </fieldset>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (zipDraft === "" || /^\d{5}$/.test(zipDraft)) onChange({ ...tags, zip: zipDraft || null });
            }}
          >
            <label htmlFor="filter-zip" className="text-xs font-bold text-muted">
              {t("filters.zip")}
            </label>
            <input
              id="filter-zip"
              value={zipDraft}
              onChange={(e) => setZipDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              autoComplete="off"
              className="min-h-9 w-24 rounded-lg border border-ai-line bg-paper px-2 text-base text-ink"
            />
            <button type="submit" className="min-h-9 rounded-full bg-ai px-3 text-[13px] font-bold text-white">
              {t("filters.done")}
            </button>
          </form>
        </div>
      )}

      {fromAi && (
        <div className="mt-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-forest">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t("ai.notSaved")}
          </p>
          {engine && <p className="mt-0.5 pl-5 text-muted">{t(engine === "llm" ? "ai.engine.llm" : "ai.engine.rules")}</p>}
        </div>
      )}
    </section>
  );
}
