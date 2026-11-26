// Auth Controller
// Handles authentication HTTP endpoints

import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { HttpError } from '../../shared/middleware/errorHandler';
import { AppError } from '../../shared/utils/AppError';
import { config } from '../../shared/config';
import { prisma } from '../../shared/prisma/client';
import { getSetting } from '../../shared/utils/settings';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import crypto from 'crypto';
import {
  createStudentUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  hashPassword,
  createSession,
  deleteSession,
  mustChangePassword,
  changePassword as changePasswordService,
  setTemporaryPassword,
  createUserByAdmin,
  setUserSuspended,
  changeUserRole,
  generateTempPassword,
  assertPasswordPolicy,
} from './auth.service';
import { UserRole } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import {
  consumeEmailCode,
  isEmailVerificationRequired,
  isUserEmailVerified,
  issueEmailCode,
} from './email-code.service';

// Google OAuth configuration
// Credentials are owner-supplied via backend/.env (see the setup guide).
// Absent credentials fail closed: the start handler answers 503 and the
// login page hides the Google button (feature-detected via /api/auth/me /
// a 503 from /api/auth/google), never fabricating a session.
const GOOGLE_CLIENT_ID: string | undefined = process.env.GOOGLE_CLIENT_ID || undefined;
const GOOGLE_CLIENT_SECRET: string | undefined = process.env.GOOGLE_CLIENT_SECRET || undefined;
// P5 fix (staging remediation 2026-11-21): the OAuth start request is made
// through the frontend origin (the /api/backend rewrite), which is where the
// state-binding cookie is set. The callback MUST traverse the same origin or
// the browser will not attach that cookie to it — cookies are host-scoped, so
// the previous default (backend host) worked only on localhost (host-scoped,
// port-agnostic) and broke every Google sign-in on any split-host deployment
// with "Sign-in could not be tied to this browser". The callback now defaults
// to the frontend-origin rewrite path; the env override remains for exotic
// topologies. The Google Console "Authorized redirect URI" for an
// installation is therefore the FRONTEND origin + /api/backend/api/auth/
// google/callback (documented in .env.example and the runbook).
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${config.FRONTEND_URL}/api/backend/api/auth/google/callback`;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

/** OAuth state lifetime (CSRF protection; consumed on first use). */
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStateEntry {
  createdAt: number;
}

const oauthStateStore = new Map<string, OAuthStateEntry>();

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function storeOAuthState(state: string): void {
  // Single-instance in-memory store: Redis / external stores are excluded
  // from the approved V1 stack, so one backend process owns all state.
  oauthStateStore.set(state, { createdAt: Date.now() });
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.createdAt > OAUTH_STATE_TTL_MS) {
      oauthStateStore.delete(key);
    }
  }
}

function verifyOAuthState(state: string): boolean {
  const entry = oauthStateStore.get(state);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > OAUTH_STATE_TTL_MS) {
    oauthStateStore.delete(state);
    return false;
  }
  oauthStateStore.delete(state); // Consume the state (single use)
  return true;
}

/** Minimal typed surface of the fetched token/tokeninfo bodies. */
interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleIdTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  iss?: string;
  [key: string]: unknown;
}

/** Typed global fetch (Node 22 runtime types). */
const nodeFetch = globalThis.fetch;

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// Set session cookie
function setSessionCookie(res: Response, token: string): void {
  res.cookie('session', token, cookieOptions);
}

// Clear session cookie
function clearSessionCookie(res: Response): void {
  res.clearCookie('session', cookieOptions);
}

// ============================================================
// Public Endpoints
// ============================================================

// POST /api/auth/register - Public student registration
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, email, password } = req.body as {
    fullName: string;
    email: string;
    password: string;
  };

  // Check if user already exists
  const existing = await findUserByEmail(email);
  if (existing) {
    throw HttpError.conflict('An account with this email already exists');
  }

  // OD-7: enforce the configured minimum password length (zod's floor is the
  // static default of 8; the platform setting can raise it).
  await assertPasswordPolicy(password);

  const user = await createStudentUser(email, password, fullName);

  // Create session
  const { token } = await createSession(user.id);
  setSessionCookie(res, token);

  // Email ownership: send the first verification code straight away. The
  // account can sign in but every other endpoint is gated until verified.
  const verificationRequired = isEmailVerificationRequired();
  let verificationEmailSent = false;
  if (verificationRequired) {
    // The account and session already exist, so a failure here must not turn
    // the response into a 500. The user can resend from the verify page.
    try {
      verificationEmailSent = (await issueEmailCode(user, 'VERIFY_EMAIL')).delivered;
    } catch (error) {
      console.error('Verification code on register failed:', error instanceof Error ? error.message : error);
    }
  }

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      emailVerified: isUserEmailVerified(user),
    },
    verificationEmailSent,
    message: 'Registration successful',
  });
});

// POST /api/auth/login - User login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await findUserByEmail(email);
  if (!user) {
    // Generic error to prevent email enumeration (NFR-CAND-007)
    throw HttpError.unauthorized('Invalid email or password');
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw HttpError.forbidden('Account is suspended');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw HttpError.unauthorized('Invalid email or password');
  }

  // FR-DRV-001/003: a temporary password is single-use and expiring. Consume it
  // atomically on the first successful login; an already-used or expired
  // temporary password is rejected with the same generic error.
  if (user.mustChangePassword) {
    const consumed = await prisma.user.updateMany({
      where: { id: user.id, tempPasswordExpiresAt: { gt: new Date() } },
      data: { tempPasswordExpiresAt: new Date(0) },
    });
    if (consumed.count === 0) {
      throw HttpError.unauthorized('Invalid email or password');
    }
  }

  const { token } = await createSession(user.id);
  setSessionCookie(res, token);

  // Unverified accounts (e.g. mentors/admins created by an administrator)
  // get a fresh code on sign-in so the verification screen is never empty.
  // Skipped while a password change is still pending (that comes first).
  if (!isUserEmailVerified(user) && !mustChangePassword(user)) {
    try {
      await issueEmailCode(user, 'VERIFY_EMAIL');
    } catch (error) {
      // Cooldown: a code sent under a minute ago is still valid. Any other
      // failure is logged; the session already exists and the user can resend.
      if (!(error instanceof HttpError && error.statusCode === 429)) {
        console.error('Verification code on login failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: mustChangePassword(user),
      emailVerified: isUserEmailVerified(user),
    },
    message: 'Login successful',
  });
});

// ============================================================
// Email verification + self-service password reset
// ============================================================

// POST /api/auth/verify-email - Confirm the emailed 6-digit code
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { code } = req.body as { code: string };

  if (user.emailVerifiedAt) {
    res.json({ message: 'Email already verified', emailVerified: true });
    return;
  }

  await consumeEmailCode(user.id, 'VERIFY_EMAIL', code);
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  await createAuditLog({
    actorId: user.id,
    action: AuditAction.USER_EMAIL_VERIFIED,
    entityType: 'User',
    entityId: user.id,
    reason: 'Email verified with emailed code',
  });

  res.json({ message: 'Email verified', emailVerified: true });
});

// POST /api/auth/verify-email/resend - Send a fresh verification code
export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.emailVerifiedAt) {
    res.json({ message: 'Email already verified', emailVerified: true });
    return;
  }
  const { delivered } = await issueEmailCode(user, 'VERIFY_EMAIL');
  if (!delivered && config.NODE_ENV === 'production') {
    throw new HttpError(
      503,
      'We could not send the email right now. Please try again in a few minutes.',
      'EMAIL_SEND_FAILED'
    );
  }
  res.json({ message: 'A new code was sent to your email address' });
});

const FORGOT_PASSWORD_RESPONSE =
  'If an account exists for that email, a reset code has been sent. It expires in 15 minutes.';

// POST /api/auth/forgot-password - Email a password reset code (no enumeration)
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const user = await findUserByEmail(email);

  if (user && user.status === UserStatus.ACTIVE) {
    // Sent in the background: awaiting the email would make responses for
    // existing accounts measurably slower than for unknown addresses
    // (account enumeration by timing). Every outcome, including a cooldown
    // hit or a send failure, gets the same response.
    void issueEmailCode(user, 'PASSWORD_RESET').catch((error: unknown) => {
      if (error instanceof HttpError && error.statusCode === 429) return;
      console.error('Password reset code failed:', error instanceof Error ? error.message : error);
    });
  }

  res.json({ message: FORGOT_PASSWORD_RESPONSE });
});

// POST /api/auth/reset-password - Set a new password with the emailed code
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body as {
    email: string;
    code: string;
    newPassword: string;
  };

  const user = await findUserByEmail(email);
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new HttpError(400, 'That code is invalid or has expired. Request a new code and try again.', 'INVALID_CODE');
  }

  await assertPasswordPolicy(newPassword);
  await consumeEmailCode(user.id, 'PASSWORD_RESET', code);

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        // Receiving the code proves the inbox belongs to this user.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    }),
    // Sign out every existing session.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await createAuditLog({
    actorId: user.id,
    action: AuditAction.USER_PASSWORD_RESET_SELF,
    entityType: 'User',
    entityId: user.id,
    reason: 'Password reset with emailed code',
  });

  res.json({ message: 'Password updated. Sign in with your new password.' });
});

// POST /api/auth/logout - User logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.session as string | undefined;
  if (token) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password - Change password (requires current password)
export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!; // Set by auth middleware (typed via Express declaration merging)
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  // OD-7: enforce the configured minimum password length on the new password.
  await assertPasswordPolicy(newPassword);

  await changePasswordService(user.id, currentPassword, newPassword, user.id);

  res.json({ message: 'Password changed successfully' });
});

// GET /api/auth/me - Get current user profile
export const getMe = asyncHandler((req: Request, res: Response) => {
  const user = req.user!;

  // P2-03 fix (comprehensive audit 2026-11-15): `authMiddleware` has already
  // validated the session on this request (including the sliding expiry and
  // mustChangePassword state, which it attaches to `req.user`). Running
  // `validateSession` a second time here doubled the session/setting queries
  // and the expiry write on every page load.
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      emailVerified: isUserEmailVerified(user),
      privacyAcceptedAt: user.privacyAcceptedAt,
      createdAt: user.createdAt,
    },
  });
});

// ============================================================
// Google OAuth Endpoints
// ============================================================
//
// Security properties (all verified in code; live round trip NOT VERIFIED
// until owner-supplied credentials exist — see the setup guide):
// - CSRF: single-use, expiring `state` verified before token exchange.
// - Audience: the ID token MUST be minted for this client (`aud` check).
// - Issuer: accounts.google.com only.
// - Email: verified-at-Google addresses only (`email_verified` must be the
//   boolean true or the string "true" — tokeninfo returns strings).
// - Roles: new accounts are STUDENT, always; an existing account keeps its
//   role; nothing from the Google profile grants privilege.
// - Account linkage (owner decision OD-4, 2026-11-24): an existing account
//   whose email matches a Google-VERIFIED address signs in with Google. This
//   is the same proof of mailbox control the emailed-code password reset
//   already accepts for every role, so it adds no new takeover path. Every
//   such sign-in is audit-logged. Pending temporary-password changes are still
//   enforced by the auth middleware after sign-in.
// - Disabled accounts: SUSPENDED users are refused (FR-CAND-007).
// - Open redirects: every redirect target is FRONTEND_URL + a fixed path.

// GET /api/auth/providers - Public capability discovery for auth UI.
// Returns which authentication providers are configured. Never exposes
// secrets — booleans only. Lets the login/register pages hide the Google
// button (and any provider UI) when that provider is not configured,
// instead of showing a button that 503s.
export const getAuthProviders = asyncHandler((_req: Request, res: Response) => {
  res.json({
    providers: {
      credentials: true,
      google: Boolean(GOOGLE_CLIENT_ID),
    },
  });
});

// GET /api/auth/google - Initiate Google OAuth flow
export const googleOAuthStart = asyncHandler((req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new HttpError(503, 'Google OAuth is not configured', 'SERVICE_UNAVAILABLE');
  }

  const state = generateState();
  storeOAuthState(state);

  // P1-03 fix (comprehensive audit 2026-11-15): bind the flow to THIS browser.
  // The `state` URL parameter alone proves only that this server minted the
  // flow — an attacker could complete consent in their own browser and hand
  // the callback URL to a victim (login CSRF). A second, HttpOnly cookie must
  // carry the same value; the callback requires both to match. The cookie is
  // short-lived, SameSite=Lax and scoped to the auth path.
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// GET /api/auth/google/callback - Google OAuth callback
export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  // Helper: every user-visible failure lands on the login page with a
  // non-sensitive reason; never a JSON dump into browser navigation.
  const redirectToLogin = (message: string): void => {
    res.redirect(`${config.FRONTEND_URL}/login?error=${encodeURIComponent(message)}`);
  };

  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  // Denied consent / provider-side cancellation.
  if (error) {
    redirectToLogin('Google sign-in was cancelled');
    return;
  }

  if (!code || !state) {
    redirectToLogin('Missing authorization code or state');
    return;
  }

  // Verify (single-use) CSRF state before doing anything else.
  if (!verifyOAuthState(state)) {
    redirectToLogin('Expired or invalid sign-in attempt; please try again');
    return;
  }

  // P1-03: the state must ALSO match the initiating browser's cookie. A
  // mismatch means the callback did not originate from the browser that
  // started this flow (login CSRF) — refuse without setting any session.
  // The cookie is cleared in every outcome so it can never be replayed.
  const boundState = req.cookies?.['google_oauth_state'] as string | undefined;
  res.clearCookie('google_oauth_state', { path: '/' });
  if (!boundState || boundState !== state) {
    redirectToLogin('Sign-in could not be tied to this browser; please start again');
    return;
  }

  if (!GOOGLE_CLIENT_ID) {
    redirectToLogin('Google OAuth is not configured');
    return;
  }

  try {
    // Exchange the authorization code for tokens.
    const tokenHttpResponse = await nodeFetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenHttpResponse.ok) {
      redirectToLogin('Failed to authenticate with Google');
      return;
    }

    const tokenData = (await tokenHttpResponse.json()) as GoogleTokenResponse;

    if (!tokenData.id_token) {
      redirectToLogin('No ID token received from Google');
      return;
    }

    // Verify the ID token via Google's tokeninfo endpoint.
    const infoResponse = await nodeFetch(
      `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(tokenData.id_token)}`
    );

    if (!infoResponse.ok) {
      redirectToLogin('Failed to verify the Google identity');
      return;
    }

    const idTokenInfo = (await infoResponse.json()) as GoogleIdTokenInfo;

    // Issuer: Google only.
    if (
      idTokenInfo.iss !== 'accounts.google.com' &&
      idTokenInfo.iss !== 'https://accounts.google.com'
    ) {
      redirectToLogin('Invalid identity issuer');
      return;
    }

    // Audience: the token must be minted for THIS client (not any other app).
    if (idTokenInfo.aud !== GOOGLE_CLIENT_ID) {
      redirectToLogin('Invalid identity audience');
      return;
    }

    // Email must be verified at Google (prevents unverified-email linking).
    // tokeninfo returns "true"/"false" STRINGS: a truthiness check would let
    // "false" through, so compare explicitly.
    const emailVerified =
      idTokenInfo.email_verified === true || idTokenInfo.email_verified === 'true';
    if (!emailVerified || !idTokenInfo.email) {
      redirectToLogin('Google account email is not verified');
      return;
    }

    const email = idTokenInfo.email;

    // Existing account: sign in with Google (owner decision OD-4, see the
    // security notes above). The verified email + aud/iss checks above are the
    // proof of ownership; the account keeps its role and password.
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      if (existingUser.status === UserStatus.SUSPENDED) {
        redirectToLogin('This account is suspended. Contact an administrator.');
        return;
      }

      // Google has just proven the address, so mark it verified if it was not.
      if (!existingUser.emailVerifiedAt) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifiedAt: new Date() },
        });
      }

      await createAuditLog({
        actorId: existingUser.id,
        action: AuditAction.USER_LOGIN_GOOGLE,
        entityType: 'User',
        entityId: existingUser.id,
        reason: 'Signed in to an existing account with a Google-verified email',
      });

      const { token } = await createSession(existingUser.id);
      setSessionCookie(res, token);
      res.redirect(`${config.FRONTEND_URL}/dashboard`);
      return;
    }

    // New accounts are STUDENT, always (FR-DRV-004; public registration rule).
    // Google-authenticated users get a random password hash: they never
    // authenticate with a password, so the account cannot be logged into
    // through the password endpoint by anyone (including Google).
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: idTokenInfo.name || email,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        privacyAcceptedAt: new Date(),
        // Google asserted email_verified above, so the address is proven.
        emailVerifiedAt: new Date(),
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: AuditAction.USER_CREATED,
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, fullName: user.fullName, role: user.role },
      reason: 'Google OAuth account creation (public registration creates STUDENT accounts only)',
    });

    // Create session.
    const { token } = await createSession(user.id);
    setSessionCookie(res, token);

    // Redirect to the frontend (fixed path — no open redirect).
    res.redirect(`${config.FRONTEND_URL}/dashboard`);
  } catch (err) {
    // Server-side only: the browser still gets the generic message.
    console.error('Google OAuth callback failed:', err instanceof Error ? err.message : err);
    redirectToLogin('Google sign-in failed; please try again');
  }
});

// ============================================================
// Admin Endpoints
// ============================================================

/**
 * P2-05 guard: a MENTOR with internships still in PENDING_START, ACTIVE or
 * UNDER_EVALUATION cannot be suspended or demoted without an explicit force,
 * because the mentor routes are role-gated and the orphaned internships would
 * silently lose their reviewer. Returns 409 with the affected internships.
 */
async function assertNoActiveMentorAssignments(
  mentorId: string,
  action: 'suspend' | 'demote',
  force: boolean
): Promise<void> {
  if (force) return;
  const active = await prisma.internship.findMany({
    where: { mentorId, status: { in: ['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION'] } },
    select: { id: true, status: true, program: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (active.length === 0) return;
  const list = active.map((i) => `"${i.program.title}" (${i.status.toLowerCase()})`).join(', ');
  throw new AppError(
    `This mentor still has ${active.length} active internship assignment(s): ${list}. ` +
      `Reassign ${active.length === 1 ? 'it' : 'them'} first (Internships page), or retry with "apply anyway" to proceed.`,
    409,
    'MENTOR_ACTIVE_INTERNSHIPS',
    { internships: active.map((i) => ({ id: i.id, status: i.status, program: i.program.title })) }
  );
}

// POST /api/auth/admin/reset-password - Admin initiates temporary password reset
export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const { email } = req.body as { email: string };

  const user = await findUserByEmail(email);
  if (!user) {
    // Generic response to prevent email enumeration
    res.json({ message: 'If the email exists, a temporary password has been generated' });
    return;
  }

  const tempPassword = await setTemporaryPassword(user.id, actor.id, `Admin password reset for ${email}`);

  // In a real system, this would be shown to admin or sent via secure channel
  // For V1 (no email), we return it in response (admin must communicate securely)
  res.json({
    message: 'Temporary password generated',
    temporaryPassword: tempPassword,
    expiresAt: new Date(Date.now() + (await getSetting<number>('tempPasswordValidityHours', 24)) * 60 * 60 * 1000),
    userId: user.id,
  });
});

// POST /api/admin/users - Admin creates MENTOR or ADMIN account
export const adminCreateUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const { fullName, email, role } = req.body as {
    fullName: string;
    email: string;
    role: UserRole;
  };

  // Check if user already exists
  const existing = await findUserByEmail(email);
  if (existing) {
    throw HttpError.conflict('An account with this email already exists');
  }

  // Generate temporary password for admin-created account
  const tempPassword = generateTempPassword();

  const user = await createUserByAdmin(email, tempPassword, fullName, role, actor.id, `Admin created ${role} account`);

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    },
    temporaryPassword: tempPassword,
    message: `${role} account created. Temporary password must be communicated securely to the user.`,
  });
});

// PUT /api/admin/users/:id/suspend - Admin suspends/reactivates user
export const adminSuspendUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = req.params.id as string;
  const { reason, force } = req.body as { reason: string; force?: boolean };

  const user = await findUserById(id);
  if (!user) {
    throw HttpError.notFound('User not found');
  }

  // Prevent self-suspension
  if (user.id === actor.id) {
    throw HttpError.badRequest('Cannot suspend your own account');
  }

  const suspended = user.status === UserStatus.ACTIVE;
  if (suspended && user.role === UserRole.MENTOR) {
    // P2-05 fix (comprehensive audit 2026-11-15): suspending a mentor with
    // active internships silently orphans them — pending submissions become
    // unreviewable and nothing warns the admin. Fail closed with the affected
    // list unless the admin explicitly forces the action (owner decision OD-8
    // governs the long-term policy).
    await assertNoActiveMentorAssignments(user.id, 'suspend', Boolean(force));
  }

  const updatedUser = await setUserSuspended(id, suspended, actor.id, reason);

  res.json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      status: updatedUser.status,
    },
    message: suspended ? 'User suspended' : 'User reactivated',
  });
});

// PUT /api/admin/users/:id/role - Admin changes user role
export const adminChangeRole = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = req.params.id as string;
  const { role, force } = req.body as { role: UserRole; force?: boolean };
  const reason = `Role changed to ${role} by admin${force ? ' (forced past active-assignment guard)' : ''}`;

  const user = await findUserById(id);
  if (!user) {
    throw HttpError.notFound('User not found');
  }

  // Prevent self-role-change
  if (user.id === actor.id) {
    throw HttpError.badRequest('Cannot change your own role');
  }

  if (user.role === UserRole.MENTOR && role !== UserRole.MENTOR) {
    // P2-05: demoting a mentor removes their route access while
    // `internship.mentorId` still points at them — same orphan risk.
    await assertNoActiveMentorAssignments(user.id, 'demote', Boolean(force));
  }

  const updatedUser = await changeUserRole(id, role, actor.id, reason);

  res.json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      status: updatedUser.status,
    },
    message: `User role changed to ${role}`,
  });
});

// GET /api/admin/users - Admin lists users (with pagination)
export const adminListUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const role = req.query.role as UserRole | undefined;
  const status = req.query.status as UserStatus | undefined;
  const search = req.query.search as string | undefined;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        privacyAcceptedAt: true,
        mustChangePassword: true,
        tempPasswordExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/admin/users/:id - Admin gets user details
export const adminGetUser = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      studentProfile: true,
      mentorProfile: true,
    },
  });

  if (!user) {
    throw HttpError.notFound('User not found');
  }

  // Don't expose password hash
  const { passwordHash, ...userData } = user;
  res.json({ user: userData });
});
