// Email codes: address verification + self-service password reset.
//
// A 6-digit code is emailed to the account address. Only an HMAC of the code
// (keyed with COOKIE_SECRET) is stored, codes expire after 15 minutes, are
// single-use, allow at most 5 guesses, and a new code can be requested at
// most once per minute. Requesting a new code invalidates the previous one.

import crypto from 'crypto';
import type { EmailCodePurpose, User } from '@prisma/client';
import { prisma } from '../../shared/prisma/client';
import { config } from '../../shared/config';
import { HttpError } from '../../shared/middleware/errorHandler';
import { isEmailConfigured, sendEmail } from '../../shared/email/mailer';

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Whether unverified accounts are gated. Enabled whenever SMTP is configured
 * (codes can actually be delivered). In development without SMTP it is also
 * enabled and the code is printed to the server console. In production
 * without SMTP it is disabled (with a startup warning) rather than locking
 * every new user out. EMAIL_VERIFICATION_REQUIRED=false turns it off.
 */
export function isEmailVerificationRequired(): boolean {
  if ((process.env.EMAIL_VERIFICATION_REQUIRED ?? '').toLowerCase() === 'false') return false;
  return isEmailConfigured() || config.NODE_ENV !== 'production';
}

if (config.NODE_ENV === 'production' && !isEmailConfigured()) {
  console.warn(
    JSON.stringify({
      channel: 'email',
      event: 'email_verification_disabled',
      reason: 'No email transport (GMAIL_REFRESH_TOKEN or SMTP_HOST, plus EMAIL_FROM) in production; email verification and password-reset emails are unavailable',
    })
  );
}

/** Effective verification state used by the middleware and /me. */
export function isUserEmailVerified(user: Pick<User, 'emailVerifiedAt'>): boolean {
  return user.emailVerifiedAt !== null || !isEmailVerificationRequired();
}

function hashCode(userId: string, purpose: EmailCodePurpose, code: string): string {
  return crypto
    .createHmac('sha256', config.COOKIE_SECRET)
    .update(`${userId}:${purpose}:${code}`)
    .digest('hex');
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

const COPY: Record<EmailCodePurpose, { subject: string; heading: string; intro: string }> = {
  VERIFY_EMAIL: {
    subject: 'Your InternPath verification code',
    heading: 'Verify your email address',
    intro: 'Enter this code in InternPath to confirm this email address belongs to you.',
  },
  PASSWORD_RESET: {
    subject: 'Your InternPath password reset code',
    heading: 'Reset your password',
    intro: 'Enter this code in InternPath to choose a new password.',
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderEmail(purpose: EmailCodePurpose, fullName: string, code: string) {
  const copy = COPY[purpose];
  const footer =
    'The code expires in 15 minutes and can be used once. If you did not request it, you can ignore this email — your account is unchanged.';
  const text = `Hi ${fullName},\n\n${copy.intro}\n\n    ${code}\n\n${footer}\n\n— InternPath`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4dfd3;border-radius:12px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:15px;font-weight:bold;color:#1d4434">InternPath</p>
<h1 style="margin:16px 0 8px;font-size:22px;color:#1f2a24">${copy.heading}</h1>
<p style="margin:0 0 4px;font-size:15px;line-height:22px">Hi ${escapeHtml(fullName)},</p>
<p style="margin:0;font-size:15px;line-height:22px">${copy.intro}</p></td></tr>
<tr><td align="center" style="padding:20px 28px"><div style="display:inline-block;padding:14px 24px;background:#eef4f0;border-radius:10px;font-size:32px;letter-spacing:8px;font-weight:bold;color:#1d4434;font-family:'Courier New',monospace">${code}</div></td></tr>
<tr><td style="padding:0 28px 28px"><p style="margin:0;font-size:13px;line-height:19px;color:#5b655f">${footer}</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject: copy.subject, text, html };
}

/**
 * Issue (and email) a new code. Throws 429 when called again within the
 * cooldown. Returns whether the email was actually handed to SMTP.
 */
export async function issueEmailCode(
  user: Pick<User, 'id' | 'email' | 'fullName'>,
  purpose: EmailCodePurpose
): Promise<{ delivered: boolean }> {
  const latest = await prisma.emailCode.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000
    );
    throw new HttpError(
      429,
      `Please wait ${waitSeconds} seconds before requesting another code.`,
      'CODE_COOLDOWN'
    );
  }

  const code = generateCode();
  await prisma.$transaction([
    // Only the newest code is ever valid.
    prisma.emailCode.deleteMany({ where: { userId: user.id, purpose } }),
    prisma.emailCode.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: hashCode(user.id, purpose, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  const { subject, text, html } = renderEmail(purpose, user.fullName, code);
  const result = await sendEmail({ to: user.email, subject, text, html });

  if (!result.delivered && config.NODE_ENV !== 'production') {
    // Development convenience only: there is no SMTP, so surface the code
    // where the developer can see it. Never runs in production.
    console.log(JSON.stringify({ channel: 'email', event: 'dev_email_code', purpose, to: user.email, code }));
  }

  return { delivered: result.delivered };
}

/**
 * Check a submitted code. On success the code is consumed; on failure the
 * attempt counter increases and a generic 400 is thrown.
 */
export async function consumeEmailCode(
  userId: string,
  purpose: EmailCodePurpose,
  code: string
): Promise<void> {
  const invalid = () =>
    new HttpError(400, 'That code is invalid or has expired. Request a new code and try again.', 'INVALID_CODE');

  const record = await prisma.emailCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.expiresAt < new Date()) throw invalid();
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(400, 'Too many incorrect attempts. Request a new code.', 'TOO_MANY_ATTEMPTS');
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashCode(userId, purpose, code.trim()), 'hex');
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    await prisma.emailCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  // Conditional consume: a concurrent request with the same code loses.
  const consumed = await prisma.emailCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw invalid();
}
