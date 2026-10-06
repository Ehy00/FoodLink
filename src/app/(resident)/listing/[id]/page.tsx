import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/ListingDetail";
import { getListingView } from "@/lib/db/listings";
import { idParam } from "@/lib/validation";

export default async function ListingPage({ params }: PageProps<"/listing/[id]">) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const listing = await getListingView(id.data);
  if (!listing) notFound();
  return <ListingDetail listing={listing} />;
}
