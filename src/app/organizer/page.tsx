import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReconfirmButton } from "@/components/staff/OrganizerActions";
import { StaffShell } from "@/components/staff/StaffShell";
import { RiskBadge, primaryButton } from "@/components/staff/ui";
import { listOrganizerListings, listOrganizerRevisions } from "@/lib/db/moderation";
import { calendarDaysBetween } from "@/lib/freshness";
import { getUser } from "@/lib/security/session";

export const metadata = { title: "My listings · FoodLink organizers" };

const STATUS_STYLE = {
  pending: "bg-amber-soft text-amber",
  approved: "bg-mint text-forest",
  rejected: "bg-danger-soft text-danger",
} as const;
const STATUS_LABEL = { pending: "Waiting for review", approved: "Approved", rejected: "Not approved" } as const;

function verifiedText(iso: string): string {
  const days = calendarDaysBetween(new Date(iso), new Date());
  return days === 0 ? "Verified today" : days === 1 ? "Verified yesterday" : `Verified ${days} days ago`;
}

export default async function OrganizerHome() {
  const user = await getUser();
  if (!user) redirect("/organizer/login");
  if (user.role === "reviewer") redirect("/review");

  const [listings, revisions] = await Promise.all([listOrganizerListings(user.id), listOrganizerRevisions(user.id)]);

  return (
    <StaffShell area="Organizers" who={user.orgName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">My listings</h1>
        <Link href="/organizer/listings/new" className={primaryButton}>
          <Plus className="h-4 w-4" aria-hidden /> Add a listing
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Tap “Still accurate” whenever you have checked a listing. It keeps the green “Verified” badge that residents
        rely on.
      </p>

      <ul className="mt-4 space-y-3">
        {listings.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
            You have no published listings yet. Add one and a reviewer will check it.
          </li>
        )}
        {listings.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4 shadow-card">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-ink">{l.name}</p>
              <p className="text-sm text-muted">
                {l.address}, {l.city} · {verifiedText(l.lastVerifiedAt)}
                {l.underReview && <span className="font-bold text-danger"> · Reported by a resident</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <ReconfirmButton listingId={l.id} />
              <Link
                href={`/organizer/listings/${l.id}/edit`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-bold text-ink"
              >
                <Pencil className="h-4 w-4" aria-hidden /> Update
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">My submissions</h2>
      <ul className="mt-3 space-y-3">
        {revisions.length === 0 && <li className="text-sm text-muted">Nothing submitted yet.</li>}
        {revisions.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-paper p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-semibold text-ink">{r.draft.name}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              <RiskBadge risk={r.screening.risk} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {r.kind === "new" ? "New listing" : "Update"} · submitted {new Date(r.createdAt).toLocaleDateString("en-US")}
            </p>
            <p className="mt-1.5 text-sm text-body">AI screening: {r.screening.summary}</p>
            {r.reviewerNote && <p className="mt-1.5 text-sm text-body">Reviewer note: {r.reviewerNote}</p>}
          </li>
        ))}
      </ul>
    </StaffShell>
  );
}
