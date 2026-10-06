// POST /api/review/applicants/:id  ->  a human reviewer verifies (or declines) an organization.

import { audit, setApplicantStatus } from "@/lib/db/users";
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

  const status = body.data.decision === "approve" ? "approved" : "rejected";
  if (!(await setApplicantStatus(id.data, status))) return fail(409, "This application was already handled.");
  await audit(user.id, `organizer.${status}`, id.data);
  return json({ ok: true });
}
