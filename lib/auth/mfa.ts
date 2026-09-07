import * as OTPAuth from "otpauth";

/**
 * TOTP-based MFA (security memory: "Use MFA or transaction PIN for
 * sensitive actions"). Standard 6-digit, 30-second-window TOTP,
 * compatible with any authenticator app (Google Authenticator, Authy,
 * 1Password, etc.) — no proprietary push infrastructure required for
 * the MVP.
 */

const ISSUER = "Platinum Trust Bank";

function buildTotp(secretBase32: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** otpauth:// URI for rendering as a QR code during MFA setup. */
export function getTotpProvisioningUri(secretBase32: string, accountLabel: string): string {
  return buildTotp(secretBase32, accountLabel).toString();
}

/** Allows a +/- 1 step (30s) clock-drift window, matching common authenticator behaviour. */
export function verifyTotpCode(secretBase32: string, accountLabel: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = buildTotp(secretBase32, accountLabel);
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
