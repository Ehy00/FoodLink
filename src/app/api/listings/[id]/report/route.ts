// POST /api/listings/:id/report  ->  "Report a problem".
// Reports go to a human reviewer. They never remove a listing on their own.

import { addReport, listingExists } from "@/lib/db/moderation";
import { fail, guardPublicWrite, json, rateLimit, readJson } from "@/lib/security/http";
import { idParam, reportSchema } from "@/lib/validation";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardPublicWrite(request, "feedback", "feedback");
  if (blocked) return blocked;

  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success || !(await listingExists(id.data))) return fail(404, "Listing not found.");

  const body = await readJson(request, reportSchema);
  if (body.response) return body.response;

  const repeat = rateLimit(request, "feedbackPerListing", `report:${id.data}`);
  if (repeat) return json({ ok: true, already: true });

  await addReport(id.data, body.data.reason, body.data.note);
  return json({ ok: true, already: false });
}
