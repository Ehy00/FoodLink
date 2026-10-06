// POST /api/auth/logout

import { checkSameOrigin, json } from "@/lib/security/http";
import { endSession } from "@/lib/security/session";

export async function POST(request: Request): Promise<Response> {
  const blocked = checkSameOrigin(request);
  if (blocked) return blocked;
  await endSession();
  return json({ ok: true });
}
