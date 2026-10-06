// POST /api/review/reports/:id  ->  a human reviewer closes a resident's report.

import { decideReport } from "@/lib/db/moderation";
import { checkSameOrigin, fail, json, rateLimit, readJson } from "@/lib/security/http";
import { getUser } from "@/lib/security/session";
import { idParam, reportDecisionSchema } from "@/lib/validation";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "write", "review");
  if (blocked) return blocked;

  const user = await getUser("reviewer");
  if (!user) return fail(403, "Reviewers only.");

  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Not found.");

  const body = await readJson(request, reportDecisionSchema);
  if (body.response) return body.response;

  if (!(await decideReport(user, id.data, body.data.decision))) return fail(409, "This report was already handled.");
  return json({ ok: true });
}
