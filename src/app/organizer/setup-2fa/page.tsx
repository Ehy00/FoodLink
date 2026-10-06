import { redirect } from "next/navigation";
import { Setup2faForm } from "@/components/staff/Setup2faForm";
import { StaffShell } from "@/components/staff/StaffShell";
import { getSession } from "@/lib/security/session";

export const metadata = { title: "Set up two-step sign-in · FoodLink" };

export default async function Setup2faPage() {
  // Only reachable straight after a correct password on an account without 2FA.
  if (!(await getSession("setup_2fa"))) redirect("/organizer/login");
  return (
    <StaffShell area="Organizers" narrow>
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <Setup2faForm />
      </div>
    </StaffShell>
  );
}
