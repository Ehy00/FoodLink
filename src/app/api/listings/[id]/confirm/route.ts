// POST /api/listings/:id/confirm  ->  "Yes, I got food".
// Feeds the freshness score. Stores the listing id and today's date only.

import { addConfirmation, listingExists } from "@/lib/db/moderation";
import { fail, guardPublicWrite, json, rateLimit } from "@/lib/security/http";
import { idParam } from "@/lib/validation";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardPublicWrite(request, "feedback", "feedback");
  if (blocked) return blocked;

  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success || !(await listingExists(id.data))) return fail(404, "Listing not found.");

  // One answer per listing per client per 12 hours, so the score cannot be stuffed.
  const repeat = rateLimit(request, "feedbackPerListing", `confirm:${id.data}`);
  if (repeat) return json({ ok: true, already: true });

  await addConfirmation(id.data);
  return json({ ok: true, already: false });
}
