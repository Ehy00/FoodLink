"use client";

// The human-review step. Every button here is a decision made by a person;
// the AI screening panel beside it is advice only.

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import type { ReportView, RevisionView } from "@/lib/db/moderation";
import type { ApplicantView } from "@/lib/db/users";
import { formatTime } from "@/lib/hours";
import type { Hours, ListingDraft } from "@/lib/types";
import { ErrorNote, ScreeningPanel } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NTH = ["1st", "2nd", "3rd", "4th", "5th"];
const REASONS: Record<string, string> = {
  closed: "It was closed",
  wrong_hours: "The hours were wrong",
  wrong_address: "The address was wrong",
  asked_for_money: "They asked for money or personal details",
  turned_away: "The visitor was turned away",
  other: "Something else",
};

function hoursText(h: Hours): string {
  const parts = [
    ...h.weekly.map((w) => `${w.days.map((d) => DAYS[d]).join(", ")} ${formatTime(w.open)}–${formatTime(w.close)}`),
    ...h.monthly.map((m) => `${m.nth.map((n) => NTH[n - 1]).join(" & ")} ${DAYS[m.weekday]} ${formatTime(m.open)}–${formatTime(m.close)}`),
  ];
  return parts.length ? parts.join("; ") : "None given";
}

function facts(d: ListingDraft): Array<[string, string]> {
  return [
    ["Address", `${d.address}, ${d.city}, AL ${d.zip}`],
    ["Map pin", `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`],
    ["Phone", d.phone ?? "None"],
    ["Website", d.website ?? "None"],
    ["Hours", d.startsAt && d.endsAt ? `${new Date(d.startsAt).toLocaleString("en-US")} to ${new Date(d.endsAt).toLocaleString("en-US")}` : hoursText(d.hours)],
    ["Hours note", d.hoursNoteEn ?? "None"],
    ["Who can come", d.eligibilityEn],
    ["ID required", d.idRequired],
    ["Wheelchair access", d.wheelchair],
    ["Offers", d.offers.join(", ")],
  ];
}

function useDecision() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function decide(path: string, body: unknown, key: string) {
    setBusy(key);
    setError("");
    try {
      await postJson(path, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, decide };
}

const approve = "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-bold text-white disabled:opacity-60";
const reject = "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-danger bg-paper px-4 text-sm font-bold text-danger disabled:opacity-60";
const neutral = "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-paper px-4 text-sm font-bold text-ink disabled:opacity-60";

function RevisionCard({ revision }: { revision: RevisionView }) {
  const { busy, error, decide } = useDecision();
  const [note, setNote] = useState("");
  const d = revision.draft;
  const send = (decision: "approve" | "reject") =>
    decide(`/api/review/revisions/${revision.id}`, { decision, note: note.trim() || undefined }, decision);
  return (
    <li className="rounded-2xl border border-line bg-paper p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ink">{d.name}</h3>
        <span className="text-xs text-muted">
          {revision.kind === "new" ? "New listing" : "Update to an existing listing"} · from {revision.organizerName}
        </span>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5 text-sm">
          {facts(d).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
              <dt className="text-muted">{k}</dt>
              <dd className="break-words text-body">{v}</dd>
            </div>
          ))}
        </dl>
        <ScreeningPanel screening={revision.screening} />
      </div>
      <div className="mt-4">
        <label htmlFor={`note-${revision.id}`} className="text-sm font-bold text-ink">
          Note to the organizer (optional)
        </label>
        <input
          id={`note-${revision.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <button type="button" disabled={busy !== null} onClick={() => send("approve")} className={approve}>
          <Check className="h-4 w-4" aria-hidden /> Approve and publish
        </button>
        <button type="button" disabled={busy !== null} onClick={() => send("reject")} className={reject}>
          <X className="h-4 w-4" aria-hidden /> Reject
        </button>
      </div>
      <div className="mt-2">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </li>
  );
}

function ReportCard({ report }: { report: ReportView }) {
  const { busy, error, decide } = useDecision();
  const send = (decision: "resolve" | "dismiss" | "unpublish") =>
    decide(`/api/review/reports/${report.id}`, { decision }, decision);
  return (
    <li className="rounded-2xl border border-line bg-paper p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">{report.listingName}</h3>
      <p className="mt-1 text-sm text-body">
        <span className="font-bold">{REASONS[report.reason] ?? report.reason}</span> · reported {report.createdDay}
      </p>
      {report.note && <p className="mt-1 rounded-xl bg-cream px-3 py-2 text-sm text-body">“{report.note}”</p>}
      <div className="mt-3 flex flex-wrap gap-2.5">
        <button type="button" disabled={busy !== null} onClick={() => send("resolve")} className={approve}>
          <Check className="h-4 w-4" aria-hidden /> I checked: listing is correct
        </button>
        <button type="button" disabled={busy !== null} onClick={() => send("unpublish")} className={reject}>
          <X className="h-4 w-4" aria-hidden /> Take listing down
        </button>
        <button type="button" disabled={busy !== null} onClick={() => send("dismiss")} className={neutral}>
          Dismiss report
        </button>
      </div>
      <div className="mt-2">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </li>
  );
}

function ApplicantCard({ applicant }: { applicant: ApplicantView }) {
  const { busy, error, decide } = useDecision();
  const send = (decision: "approve" | "reject") => decide(`/api/review/applicants/${applicant.id}`, { decision }, decision);
  return (
    <li className="rounded-2xl border border-line bg-paper p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">{applicant.orgName}</h3>
      <p className="mt-1 text-sm text-body">
        {applicant.email} · {applicant.phone ?? "no phone"}
      </p>
      <p className="mt-1 text-xs text-muted">
        Call the organization on a number you found yourself (not only the one above) before approving.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <button type="button" disabled={busy !== null} onClick={() => send("approve")} className={approve}>
          <Check className="h-4 w-4" aria-hidden /> Verified: approve
        </button>
        <button type="button" disabled={busy !== null} onClick={() => send("reject")} className={reject}>
          <X className="h-4 w-4" aria-hidden /> Decline
        </button>
      </div>
      <div className="mt-2">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </li>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        {title}
        <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-forest">{count}</span>
      </h2>
      {count === 0 ? <p className="mt-2 text-sm text-muted">{empty}</p> : <ul className="mt-3 space-y-3">{children}</ul>}
    </section>
  );
}

export function ReviewQueue({
  revisions,
  reports,
  applicants,
}: {
  revisions: RevisionView[];
  reports: ReportView[];
  applicants: ApplicantView[];
}) {
  return (
    <>
      <Section title="Listings waiting for review" count={revisions.length} empty="No submissions are waiting.">
        {revisions.map((r) => (
          <RevisionCard key={r.id} revision={r} />
        ))}
      </Section>
      <Section title="Reports from residents" count={reports.length} empty="No open reports.">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </Section>
      <Section title="Organizations asking to join" count={applicants.length} empty="No applications are waiting.">
        {applicants.map((a) => (
          <ApplicantCard key={a.id} applicant={a} />
        ))}
      </Section>
    </>
  );
}
