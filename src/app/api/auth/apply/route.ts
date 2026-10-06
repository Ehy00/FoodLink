// POST /api/auth/apply  ->  a food bank, church or nonprofit asks for an organizer account.
// The account cannot sign in until a human reviewer has verified the organization.

import { createApplicant } from "@/lib/db/users";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import { applySchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardPublicWrite(request, "apply", "apply");
  if (blocked) return blocked;

  const body = await readJson(request, applySchema);
  if (body.response) return body.response;

  // Same response whether or not the email was already registered, so this
  // form cannot be used to find out who has an account.
  await createApplicant(body.data);
  return json({ ok: true });
}
