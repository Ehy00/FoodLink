// POST /api/review/revisions/:id  ->  a human reviewer approves or rejects a submission.

import { decideRevision } from "@/lib/db/moderation";
import { checkSameOrigin, fail, json, rateLimit, readJson } from "@/lib/security/http";
import { getUser } from "@/lib/security/session";
import { idParam, reviewDecisionSchema } from "@/lib/validation";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "write", "review");
  if (blocked) return blocked;

  const user = await getUser("reviewer");
  if (!user) return fail(403, "Reviewers only.");

  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");

  const body = await readJson(request, reviewDecisionSchema);
  if (body.response) return body.response;

  const result = await decideRevision(user, id.data, body.data.decision, body.data.note || null);
  if (!result.ok) return fail(409, result.error ?? "Could not save the decision.");
  return json({ ok: true });
}
