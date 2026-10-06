import { redirect } from "next/navigation";
import { ListingForm } from "@/components/staff/ListingForm";
import { StaffShell } from "@/components/staff/StaffShell";
import { getUser } from "@/lib/security/session";

export const metadata = { title: "Add a listing · FoodLink organizers" };

export default async function NewListingPage() {
  const user = await getUser("organizer");
  if (!user) redirect("/organizer/login");
  return (
    <StaffShell area="Organizers" who={user.orgName}>
      <ListingForm />
    </StaffShell>
  );
}
