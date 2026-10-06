// POST /api/auth/verify-2fa  ->  step 2 of sign-in: the 6-digit code.

import { audit, clearFailedLogins, isLocked, recordFailedLogin, rememberTotpStep } from "@/lib/db/users";
import { decrypt } from "@/lib/security/crypto";
import { checkSameOrigin, fail, json, rateLimit, readJson } from "@/lib/security/http";
import { endSession, getSession, startSession } from "@/lib/security/session";
import { checkTotp } from "@/lib/security/totp";
import { codeSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "auth", "2fa");
  if (blocked) return blocked;

  const session = await getSession("pending_2fa");
  if (!session) return fail(401, "Your sign-in timed out. Please start again.");
  const { user } = session;

  const body = await readJson(request, codeSchema);
  if (body.response) return body.response;

  if (isLocked(user) || !user.totp_secret_enc) {
    await endSession();
    return fail(429, "Too many failed attempts. This account is locked for 15 minutes.");
  }

  const check = await checkTotp(decrypt(user.totp_secret_enc), body.data.code, Number(user.totp_last_step));
  if (!check.valid) {
    await recordFailedLogin(user);
    await audit(user.id, "login.failed_code", user.id);
    return fail(401, "That code is not right, or it was already used. Wait for a new code and try again.");
  }

  await rememberTotpStep(user.id, check.timeStep);
  await clearFailedLogins(user.id);
  await startSession(user.id, "full");
  await audit(user.id, "login.success", user.id);
  return json({ next: user.role === "reviewer" ? "/review" : "/organizer" });
}
