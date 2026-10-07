import { redirect } from "next/navigation";
import { ReviewQueue } from "@/components/staff/ReviewQueue";
import { StaffShell } from "@/components/staff/StaffShell";
import { listOpenReports, listPendingRevisions } from "@/lib/db/moderation";
import { listPendingApplicants, recentAudit } from "@/lib/db/users";
import { getUser } from "@/lib/security/session";

export const metadata = { title: "Review queue · FoodLink" };

export default async function ReviewPage() {
  const user = await getUser();
  if (!user) redirect("/organizer/login");
  if (user.role !== "reviewer") redirect("/organizer");

  const [revisions, reports, applicants, audit] = await Promise.all([
    listPendingRevisions(),
    listOpenReports(),
    listPendingApplicants(),
    recentAudit(12),
  ]);

  return (
    <StaffShell area="Review team" who={user.orgName}>
      <h1 className="font-display text-xl font-semibold text-ink">Review queue</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Nothing an organizer submits reaches residents until someone here approves it.
      </p>

      <ReviewQueue revisions={revisions} reports={reports} applicants={applicants} />

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Security & Activity Log</h2>
        <p className="text-xs text-muted">Audit log of staff sign-ins, failed attempts and review decisions. Resident searches are never logged.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-bold">When</th>
                <th scope="col" className="px-4 py-2 font-bold">Who</th>
                <th scope="col" className="px-4 py-2 font-bold">Action</th>
                <th scope="col" className="px-4 py-2 font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-muted">
                    No activity yet.
                  </td>
                </tr>
              )}
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2 text-muted">
                    {new Date(a.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2 text-body">{a.actor}</td>
                  <td className="px-4 py-2 font-medium text-ink">{a.action}</td>
                  <td className="px-4 py-2 text-muted">{a.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </StaffShell>
  );
}
