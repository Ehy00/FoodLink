import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/staff/ListingForm";
import { StaffShell } from "@/components/staff/StaffShell";
import { getOrganizerListing } from "@/lib/db/moderation";
import { getUser } from "@/lib/security/session";
import { idParam } from "@/lib/validation";

export const metadata = { title: "Update a listing · FoodLink organizers" };

export default async function EditListingPage({ params }: PageProps<"/organizer/listings/[id]/edit">) {
  const user = await getUser("organizer");
  if (!user) redirect("/organizer/login");

  const id = idParam.safeParse((await params).id);
  // Organizers can only open their own listings. Anyone else's looks like it does not exist.
  const listing = id.success ? await getOrganizerListing(user.id, id.data) : null;
  if (!listing) notFound();

  return (
    <StaffShell area="Organizers" who={user.orgName}>
      <ListingForm listing={listing} />
    </StaffShell>
  );
}
