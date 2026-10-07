import { redirect } from "next/navigation";
import { DemoAuthenticator } from "@/components/staff/DemoAuthenticator";
import { LoginForm } from "@/components/staff/LoginForm";
import { StaffShell } from "@/components/staff/StaffShell";
import { getUser } from "@/lib/security/session";

export const metadata = { title: "Organizer sign-in · FoodLink" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.role === "reviewer" ? "/review" : "/organizer");
  return (
    <StaffShell area="Organizers" narrow>
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
          <LoginForm />
        </div>
        <DemoAuthenticator />
      </div>
    </StaffShell>
  );
}
