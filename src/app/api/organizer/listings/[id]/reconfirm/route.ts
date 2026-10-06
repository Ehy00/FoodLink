// POST /api/organizer/listings/:id/reconfirm  ->  "Still accurate" button.

import { confirmStillAccurate } from "@/lib/db/moderation";
import { checkSameOrigin, fail, json, rateLimit } from "@/lib/security/http";
import { getUser } from "@/lib/security/session";
import { idParam } from "@/lib/validation";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "write", "organizer");
  if (blocked) return blocked;

  const user = await getUser("organizer");
  if (!user) return fail(401, "Please sign in.");

  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success || !(await confirmStillAccurate(user, id.data))) return fail(404, "Listing not found.");
  return json({ ok: true });
}
