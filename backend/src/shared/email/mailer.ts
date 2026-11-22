// Transactional email (public-release hardening 2026-11-17).
//
// Environment-based SMTP configuration. When SMTP is not configured the
// mailer is an honest no-op: it reports `delivered: false` with the reason
// `email_not_configured` and never fabricates success. Delivery is therefore
// NOT VERIFIED in any environment without real SMTP credentials — the
// configured path must be smoke-tested by the operator before launch.
//
// Safety properties:
// - `sendEmail` NEVER throws: email is best-effort beside the in-app
//   notification system, so an SMTP outage can never fail a user flow.
// - Logs are structured and mask recipient addresses (no secrets, no raw PII
//   beyond a masked local part).
// - The transport is created lazily once and reused.

import nodemailer from 'nodemailer';

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  delivered: boolean;
  reason?: 'email_not_configured' | 'send_failed';
}

type MailTransport = ReturnType<typeof nodemailer.createTransport>;
let transport: MailTransport | null = null;
let warnedUnconfigured = false;

// Read lazily so tests (and runtime reloads) see the current environment.
function smtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
  };
}

function maskAddress(address: string): string {
  const [local, domain] = address.split('@');
  if (!domain) return '***';
  const maskedLocal = local && local.length > 2 ? `${local.slice(0, 2)}***` : '***';
  return `${maskedLocal}@${domain}`;
}

function log(line: Record<string, unknown>): void {
  // Structured single-line JSON so an operator can grep/ship these directly.
  console.log(JSON.stringify({ channel: 'email', ...line }));
}

export function isEmailConfigured(): boolean {
  const cfg = smtpConfig();
  return Boolean(cfg.host && cfg.from);
}

function getTransport(): MailTransport | null {
  const cfg = smtpConfig();
  if (!cfg.host || !cfg.from) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      log({
        event: 'email_disabled',
        reason: 'SMTP_HOST/EMAIL_FROM not configured — transactional email is an honest no-op',
      });
    }
    return null;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }
  return transport;
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const tx = getTransport();
  if (!tx) {
    return { delivered: false, reason: 'email_not_configured' };
  }
  try {
    await tx.sendMail({
      from: smtpConfig().from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    log({ event: 'email_sent', to: maskAddress(input.to), subject: input.subject });
    return { delivered: true };
  } catch (error) {
    log({
      event: 'email_send_failed',
      to: maskAddress(input.to),
      subject: input.subject,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { delivered: false, reason: 'send_failed' };
  }
}
