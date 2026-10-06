import { ApplyForm } from "@/components/staff/ApplyForm";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata = { title: "Apply · FoodLink organizers" };

export default function ApplyPage() {
  return (
    <StaffShell area="Organizers" narrow>
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <ApplyForm />
      </div>
    </StaffShell>
  );
}
