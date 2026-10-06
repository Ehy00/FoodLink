// Two-factor enrollment, required the first time an approved account signs in.
//   GET  -> a new secret as a QR code to scan with an authenticator app
//   POST -> confirm with a code from the app, which switches 2FA on

import QRCode from "qrcode";
import { audit, enableTotp, saveTotpSecret, toSessionUser } from "@/lib/db/users";
import { decrypt } from "@/lib/security/crypto";
import { checkSameOrigin, fail, json, rateLimit, readJson } from "@/lib/security/http";
import { getSession, startSession } from "@/lib/security/session";
import { checkTotp, newTotpSecret, totpUri } from "@/lib/security/totp";
import { codeSchema } from "@/lib/validation";

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimit(request, "auth", "2fa-setup");
  if (limited) return limited;

  const session = await getSession("setup_2fa");
  if (!session) return fail(401, "Your sign-in timed out. Please start again.");
  if (session.user.totp_enabled) return fail(409, "Two-factor is already set up.");

  // Reuse an unconfirmed secret so reloading the page does not invalidate a QR code already scanned.
  let secret = session.user.totp_secret_enc ? decrypt(session.user.totp_secret_enc) : null;
  if (!secret) {
    secret = newTotpSecret();
    await saveTotpSecret(session.user.id, secret);
  }
  const uri = totpUri(toSessionUser(session.user).email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#14372A", light: "#FFFFFF" } });
  return json({ qr, secret });
}

export async function POST(request: Request): Promise<Response> {
  const blocked = checkSameOrigin(request) ?? rateLimit(request, "auth", "2fa-setup");
  if (blocked) return blocked;

  const session = await getSession("setup_2fa");
  if (!session || !session.user.totp_secret_enc) return fail(401, "Your sign-in timed out. Please start again.");

  const body = await readJson(request, codeSchema);
  if (body.response) return body.response;

  const check = await checkTotp(decrypt(session.user.totp_secret_enc), body.data.code, 0);
  if (!check.valid) return fail(401, "That code is not right. Check the app and try again.");

  await enableTotp(session.user.id, check.timeStep);
  await startSession(session.user.id, "full");
  await audit(session.user.id, "2fa.enabled", session.user.id);
  return json({ next: session.user.role === "reviewer" ? "/review" : "/organizer" });
}
