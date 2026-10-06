// Two-factor authentication with time-based one-time passwords (RFC 6238),
// the same standard used by Google Authenticator, Microsoft Authenticator and
// Authy. Implemented with the otplib library rather than by hand.

import { generate, generateSecret, generateURI, verify } from "otplib";

const ISSUER = "FoodLink";
/** Accept codes from one 30-second step either side, to allow for clock drift. */
const TOLERANCE_SECONDS = 30;

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export interface TotpCheck {
  valid: boolean;
  /** The time step the code belonged to. Store it to block replay of the same code. */
  timeStep: number;
}

/**
 * Checks a 6-digit code. `lastStep` is the time step of the last code this
 * account used: any code from that step or earlier is rejected, so a code
 * that was shoulder-surfed or intercepted cannot be used a second time.
 */
export async function checkTotp(secret: string, code: string, lastStep: number): Promise<TotpCheck> {
  if (!/^\d{6}$/.test(code)) return { valid: false, timeStep: lastStep };
  try {
    const result = await verify({
      secret,
      token: code,
      epochTolerance: TOLERANCE_SECONDS,
      afterTimeStep: lastStep > 0 ? lastStep : undefined,
    });
    // The library's result type also covers counter-based codes, which have no time step.
    if (!result.valid || !("timeStep" in result)) return { valid: false, timeStep: lastStep };
    return { valid: true, timeStep: Number(result.timeStep) };
  } catch {
    return { valid: false, timeStep: lastStep };
  }
}

/** Current code for a secret. Used only by the demo helper script and tests. */
export function currentTotp(secret: string): Promise<string> {
  return generate({ secret });
}
