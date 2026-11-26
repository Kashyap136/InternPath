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
  /** Optional HTML body; `text` is always sent as the plain-text fallback. */
  html?: string;
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

// ------------------------------------------------------------------
// Gmail API transport (HTTPS, port 443).
//
// Hosts such as Render's free plan block outbound SMTP ports (25/465/587),
// so a Gmail account can instead send through the Gmail REST API with an
// OAuth refresh token (scope https://www.googleapis.com/auth/gmail.send).
// Preferred over SMTP whenever GMAIL_REFRESH_TOKEN is set. The OAuth client
// defaults to the Google sign-in client (GOOGLE_CLIENT_ID/SECRET).
// ------------------------------------------------------------------

function gmailApiConfig() {
  return {
    clientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    from: process.env.EMAIL_FROM || '',
  };
}

function isGmailApiConfigured(): boolean {
  const cfg = gmailApiConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.refreshToken && cfg.from);
}

/** Network timeout for every outbound email call (token refresh, send, SMTP). */
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 15_000);

let gmailAccessToken: { value: string; expiresAt: number } | null = null;
// Concurrent sends share one in-flight refresh instead of each hitting Google.
let gmailTokenRefresh: Promise<string> | null = null;

async function getGmailAccessToken(): Promise<string> {
  if (gmailAccessToken && gmailAccessToken.expiresAt - 60_000 > Date.now()) {
    return gmailAccessToken.value;
  }
  if (!gmailTokenRefresh) {
    gmailTokenRefresh = refreshGmailAccessToken().finally(() => {
      gmailTokenRefresh = null;
    });
  }
  return gmailTokenRefresh;
}

async function refreshGmailAccessToken(): Promise<string> {
  const cfg = gmailApiConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    // invalid_grant = the refresh token was revoked or expired. Tokens issued
    // while the OAuth consent screen is in "Testing" expire after 7 days, and
    // changing the sender account's password revokes them too.
    const hint =
      body.error === 'invalid_grant'
        ? ' (refresh token revoked or expired: set the OAuth consent screen to "In production" and generate a new GMAIL_REFRESH_TOKEN)'
        : body.error === 'invalid_client' || body.error === 'unauthorized_client'
          ? ' (GMAIL_CLIENT_ID/SECRET must be the OAuth client the refresh token was issued to)'
          : '';
    const description = body.error_description ? ` - ${body.error_description}` : '';
    throw new Error(`Gmail token refresh failed: ${body.error ?? response.status}${description}${hint}`);
  }
  gmailAccessToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return gmailAccessToken.value;
}

// Builds the RFC 822 message locally (no network) using nodemailer's
// buffering stream transport; only the Gmail API call leaves the process.
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });

async function sendViaGmailApi(input: EmailInput): Promise<void> {
  const composed = await composer.sendMail({
    from: gmailApiConfig().from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });
  const raw = Buffer.from(composed.message as Buffer).toString('base64url');

  const attempt = async (): Promise<Response> => {
    const accessToken = await getGmailAccessToken();
    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
  };

  let response = await attempt();
  if (response.status === 401) {
    // The cached access token was revoked early: refresh once and retry.
    gmailAccessToken = null;
    response = await attempt();
  }
  if (!response.ok) {
    if (response.status === 401) gmailAccessToken = null;
    const detail = await response.text().catch(() => '');
    const hint =
      response.status === 403
        ? ' (enable the Gmail API in the Google Cloud project and authorise the gmail.send scope)'
        : '';
    throw new Error(`Gmail API send failed (${response.status})${hint}: ${detail.slice(0, 200)}`);
  }
}

export function isEmailConfigured(): boolean {
  const cfg = smtpConfig();
  return isGmailApiConfigured() || Boolean(cfg.host && cfg.from);
}

function describeMissingConfig(): string {
  const gmail = gmailApiConfig();
  if (gmail.refreshToken) {
    const missing = [
      !gmail.from && 'EMAIL_FROM',
      !gmail.clientId && 'GMAIL_CLIENT_ID (or GOOGLE_CLIENT_ID)',
      !gmail.clientSecret && 'GMAIL_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET)',
    ].filter(Boolean);
    return `GMAIL_REFRESH_TOKEN is set but ${missing.join(', ')} is missing, so Gmail API sending is disabled`;
  }
  if (smtpConfig().host) return 'SMTP_HOST is set but EMAIL_FROM is missing, so SMTP sending is disabled';
  return 'Neither GMAIL_REFRESH_TOKEN nor SMTP_HOST (with EMAIL_FROM) is configured — transactional email is an honest no-op';
}

function getTransport(): MailTransport | null {
  const cfg = smtpConfig();
  if (!cfg.host || !cfg.from) {
    if (!warnedUnconfigured && !isGmailApiConfigured()) {
      warnedUnconfigured = true;
      log({ event: 'email_disabled', reason: describeMissingConfig() });
    }
    return null;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      // Without explicit timeouts a blocked SMTP port (e.g. Render's free
      // plan) stalls each request for minutes before failing.
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS * 2,
    });
  }
  return transport;
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (isGmailApiConfigured()) {
    try {
      await sendViaGmailApi(input);
      log({ event: 'email_sent', via: 'gmail_api', to: maskAddress(input.to), subject: input.subject });
      return { delivered: true };
    } catch (error) {
      log({
        event: 'email_send_failed',
        via: 'gmail_api',
        to: maskAddress(input.to),
        subject: input.subject,
        error: error instanceof Error ? error.message : 'unknown',
      });
      // Fall back to SMTP only when it is configured too.
      const smtp = smtpConfig();
      if (!smtp.host || !smtp.from) return { delivered: false, reason: 'send_failed' };
    }
  }

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
      ...(input.html ? { html: input.html } : {}),
    });
    log({ event: 'email_sent', via: 'smtp', to: maskAddress(input.to), subject: input.subject });
    return { delivered: true };
  } catch (error) {
    log({
      event: 'email_send_failed',
      via: 'smtp',
      to: maskAddress(input.to),
      subject: input.subject,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { delivered: false, reason: 'send_failed' };
  }
}
