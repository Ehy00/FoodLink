import { json } from "@/lib/security/http";
import { currentTotp } from "@/lib/security/totp";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const organizerSecret = process.env.DEMO_ORGANIZER_TOTP_SECRET;
  const reviewerSecret = process.env.DEMO_REVIEWER_TOTP_SECRET;

  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);

  const accounts = await Promise.all(
    [
      ["Organizer", "user_demo_organizer", organizerSecret],
      ["Reviewer", "user_demo_reviewer", reviewerSecret],
    ].map(async ([label, id, secret]) => ({
      label,
      id,
      code: secret ? await currentTotp(secret) : null,
    })),
  );

  return json({
    demo: true,
    secondsLeft,
    accounts,
    note: "Demo-only authenticator. Real organizations use their own authenticator app.",
  });
}
