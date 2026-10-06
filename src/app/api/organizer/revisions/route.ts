// POST /api/organizer/revisions  ->  submit a new listing or an update.
// The submission is screened by AI and then waits for a human reviewer.

import { submitRevision } from "@/lib/db/moderation";
import { checkSameOrigin, fail, json, rateLimit, readJson } from "@/lib/security/http";
import { getUser } from "@/lib/security/session";
import { revisionSubmitSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "write", "organizer");
  if (blocked) return blocked;

  const user = await getUser("organizer");
  if (!user) return fail(401, "Please sign in.");

  const body = await readJson(request, revisionSubmitSchema);
  if (body.response) return body.response;

  const outcome = await submitRevision(user, body.data.listingId, body.data.draft);
  if (!outcome.ok) return fail(outcome.status, outcome.error);
  return json({ ok: true, revisionId: outcome.revisionId, screening: outcome.screening });
}
