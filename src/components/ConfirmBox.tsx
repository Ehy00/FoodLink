"use client";

// "Did you get food here?" The third winning feature: act, then confirm.
// A yes raises the listing's freshness score. A report goes to a human reviewer.
// Neither one is tied to the person who sent it.

import { Check, Flag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import type { Key } from "@/lib/i18n/dictionary";
import { useI18n } from "./I18nProvider";

const REASONS = ["closed", "wrong_hours", "wrong_address", "asked_for_money", "turned_away", "other"] as const;
type Reason = (typeof REASONS)[number];
type Stage = "ask" | "reporting" | "thanks_yes" | "thanks_report" | "already" | "error";

export function ConfirmBox({ listingId }: { listingId: string }) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("ask");
  const [reason, setReason] = useState<Reason>("closed");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(path: "confirm" | "report", body: unknown, done: Stage) {
    setSending(true);
    try {
      const r = await postJson<{ already: boolean }>(`/api/listings/${listingId}/${path}`, body);
      setStage(r.already ? "already" : done);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t("results.rate") : t("results.error"));
      setStage("error");
    } finally {
      setSending(false);
    }
  }

  function submitReport(e: FormEvent) {
    e.preventDefault();
    void send("report", { reason, note: note.trim() || undefined }, "thanks_report");
  }

  return (
    <section aria-labelledby="confirm-title" className="rounded-2xl border border-line bg-paper p-4 shadow-card">
      <h2 id="confirm-title" className="font-display text-[15px] font-semibold text-ink">
        {t("confirm.title")}
      </h2>

      {stage === "ask" && (
        <>
          <p className="mt-0.5 text-xs text-muted">{t("confirm.body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => void send("confirm", {}, "thanks_yes")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mint px-4 text-sm font-bold text-forest active:bg-mint-line disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden />
              {t("confirm.yes")}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setStage("reporting")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-danger/40 bg-paper px-4 text-sm font-bold text-danger active:bg-danger-soft"
            >
              <Flag className="h-4 w-4" aria-hidden />
              {t("confirm.report")}
            </button>
          </div>
        </>
      )}

      {stage === "reporting" && (
        <form onSubmit={submitReport} className="mt-2">
          <fieldset>
            <legend className="text-sm font-medium text-body">{t("report.title")}</legend>
            <div className="mt-2 space-y-1">
              {REASONS.map((r) => (
                <label key={r} className="flex min-h-10 items-center gap-2.5 text-sm text-body">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="h-5 w-5 accent-forest"
                  />
                  {t(`report.${r}` as Key)}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="report-note" className="mt-3 block text-sm font-medium text-body">
            {t("report.note")}
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            aria-describedby="report-note-hint"
            className="mt-1 w-full rounded-xl border border-line bg-cream p-2.5 text-base text-ink"
          />
          <p id="report-note-hint" className="text-xs text-muted">
            {t("report.noteHint")}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={sending} className="min-h-11 rounded-full bg-danger px-5 text-sm font-bold text-white disabled:opacity-60">
              {t("report.send")}
            </button>
            <button type="button" onClick={() => setStage("ask")} className="min-h-11 rounded-full px-4 text-sm font-bold text-muted">
              {t("report.cancel")}
            </button>
          </div>
        </form>
      )}

      <p role="status" className={stage === "ask" || stage === "reporting" ? "sr-only" : "mt-2 text-sm text-body"}>
        {stage === "thanks_yes" && t("confirm.thanks")}
        {stage === "thanks_report" && t("report.thanks")}
        {stage === "already" && t("confirm.already")}
        {stage === "error" && <span className="text-danger">{error}</span>}
      </p>
    </section>
  );
}
