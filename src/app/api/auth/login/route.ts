// POST /api/auth/login  ->  step 1 of sign-in: email and password.
// Success never signs the user in on its own. It only opens the door to the
// second factor.

import { audit, clearFailedLogins, findUserByEmail, isLocked, recordFailedLogin } from "@/lib/db/users";
import { blindIndex, dummyPasswordHash, verifyPassword } from "@/lib/security/crypto";
import { checkSameOrigin, fail, json, rateLimit, rateLimitKey, readJson } from "@/lib/security/http";
import { startSession } from "@/lib/security/session";
import { loginSchema } from "@/lib/validation";

const GENERIC = "Email or password is incorrect.";

export async function POST(request: Request): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "auth", "login");
  if (blocked) return blocked;

  const body = await readJson(request, loginSchema);
  if (body.response) return body.response;
  const { email, password } = body.data;

  // Second limit keyed on the account, so one account cannot be attacked from many addresses.
  const perAccount = rateLimitKey(`login-account:${blindIndex(email)}`, "auth");
  if (perAccount) return perAccount;

  const user = await findUserByEmail(email);
  // Always do the expensive hash comparison, even for unknown emails, so
  // response time does not reveal which emails have accounts.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? (await dummyPasswordHash()));

  if (!user || !passwordOk) {
    if (user) {
      await recordFailedLogin(user);
      await audit(user.id, "login.failed_password", user.id);
    }
    return fail(401, GENERIC);
  }
  if (isLocked(user)) {
    return fail(429, "Too many failed attempts. This account is locked for 15 minutes.");
  }
  if (user.status === "pending") {
    return fail(403, "Your organization is still being verified. We will be in touch.");
  }
  if (user.status !== "approved") {
    return fail(401, GENERIC);
  }

  await clearFailedLogins(user.id);
  const needsSetup = !user.totp_enabled;
  await startSession(user.id, needsSetup ? "setup_2fa" : "pending_2fa");
  return json({ next: needsSetup ? "setup" : "code" });
}
