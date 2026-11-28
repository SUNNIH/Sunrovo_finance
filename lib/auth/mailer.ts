import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email delivery for verification and password-reset links (product
 * rule: "Verification email is sent or simulated"). When SMTP_HOST is
 * unset (the default for local/demo use), we don't fail registration —
 * we log the email to the server console instead, so the flow stays
 * fully testable without a mail provider. Set SMTP_* in .env.local to
 * send real email.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let cachedTransporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (process.env.NODE_ENV === "production" && (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD)) {
    // Never simulate delivery or write verification/reset links into production logs.
    throw new Error("Production SMTP configuration is incomplete.");
  }
  if (!SMTP_HOST) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });
  return cachedTransporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM ?? "Sunrovo finance <no-reply@Sunrovo.example>";

  if (!transporter) {
    // Local development only: logs contain sensitive one-time links.
    // Never share these logs or use simulated delivery in production.
    console.log(
      `[FHT demo email] SMTP not configured — simulating send.\n  To: ${to}\n  Subject: ${subject}\n  Body:\n${text}\n`
    );
    return;
  }

  await transporter.sendMail({ from, to, subject, html, text });
}

export function buildVerificationEmail(verificationUrl: string) {
  return {
    subject: "Verify your Sunrovo finance account email",
    text: `Welcome to Sunrovo finance.\n\nVerify your email address:\n${verificationUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
    html: `<p>Welcome to <strong>Sunrovo finance</strong>.</p><p><a href="${verificationUrl}">Verify your email address</a></p><p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
  };
}

export function buildPasswordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Sunrovo finance password",
    text: `We received a request to reset your password.\n\nReset it here:\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email — your password will not change.`,
    html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password will not change.</p>`,
  };
}
