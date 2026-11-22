// Auth Service
// Handles password hashing, session management, token generation

import type { User, Session } from '@prisma/client';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../shared/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { HttpError } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { getSetting } from '../../shared/utils/settings';
import { sendEmail } from '../../shared/email/mailer';

// P2-03 fix (comprehensive audit 2026-11-15): use the shared Prisma singleton.
// Every module previously constructed its own client, multiplying connection
// pools against the Supabase limit.

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionData {
  user: User;
  session: Session;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const rounds = 12;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate secure random token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Create session
export async function createSession(userId: string, _userAgent?: string, _ip?: string): Promise<{ session: Session; token: string }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  
  // Get session timeout from settings (TEMP)
  const sessionTimeout = await getSetting<number>('sessionInactivityTimeout', 3600);
  const expiresAt = new Date(Date.now() + sessionTimeout * 1000);
  
  const session = await prisma.session.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt,
    },
  });
  
  return { session, token };
}

// Validate session
export async function validateSession(token: string): Promise<SessionData | null> {
  const tokenHash = hashToken(token);
  
  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });
  
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Session expired, delete it
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  if (session.user.status === UserStatus.SUSPENDED) {
    return null;
  }
  
  // Update last activity (extend expiry). P2-03 fix: throttle the write to
  // once per minute per session — previously EVERY authenticated request paid
  // a remote update round trip even when the expiry had barely moved.
  const sessionTimeout = await getSetting<number>('sessionInactivityTimeout', 3600);
  const nextExpiry = new Date(Date.now() + sessionTimeout * 1000);
  if (nextExpiry.getTime() - session.expiresAt.getTime() > 60_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: nextExpiry },
    });
  }
  
  return { user: session.user, session };
}

// Delete session (logout)
export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { token: tokenHash } });
}

// Delete all user sessions
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// Clean expired sessions
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// Check if user must change password
export function mustChangePassword(user: User): boolean {
  const tempExpired = user.tempPasswordExpiresAt !== null && user.tempPasswordExpiresAt < new Date();
  return user.mustChangePassword || tempExpired;
}

// Generate temporary password (for admin reset)
export function generateTempPassword(minLength = 12): string {
  // Generate a secure temporary password: 12 chars (or the configured
  // platform minimum, whichever is larger), mixed case, numbers, special
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < Math.max(12, minLength); i++) {
    password += charset[crypto.randomInt(0, charset.length)];
  }
  return password;
}

// OD-7 (public-release hardening 2026-11-17): `passwordMinLength` is now a
// live setting. Registration and password changes validate the candidate
// password against it, and generated temporary passwords are scaled to meet
// it, so the admin control has a real, testable effect.
export async function assertPasswordPolicy(password: string): Promise<void> {
  const minLength = await getSetting<number>('passwordMinLength', 8);
  if (password.length < minLength) {
    throw HttpError.badRequest(`Password must be at least ${minLength} characters`);
  }
}

// Set temporary password for user (admin reset)
export async function setTemporaryPassword(userId: string, actorId: string, reason: string): Promise<string> {
  const minLength = await getSetting<number>('passwordMinLength', 8);
  const tempPassword = generateTempPassword(minLength);
  const passwordHash = await hashPassword(tempPassword);
  
  // Get temp password validity from settings (TEMP)
  const validityHours = await getSetting<number>('tempPasswordValidityHours', 24);
  const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);
  
  // Fetch user before transaction for audit log
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  
  // Use transaction to ensure session invalidation and password update are atomic
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: expiresAt,
      },
    });
    
    // Invalidate all existing sessions for this user
    await tx.session.deleteMany({ where: { userId } });
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_PASSWORD_RESET,
    entityType: 'User',
    entityId: userId,
    oldValue: { mustChangePassword: user.mustChangePassword, tempPasswordExpiresAt: user.tempPasswordExpiresAt },
    newValue: { mustChangePassword: true, tempPasswordExpiresAt: expiresAt },
    reason,
  });

  // Security notification (public-release hardening): the user is told their
  // password was reset, but the temporary value is deliberately NOT emailed —
  // it is delivered to the requesting administrator through the existing
  // single-display admin flow, keeping the secret out of email archives.
  await sendEmail({
    to: user.email,
    subject: 'InternPath: your password was reset',
    text: 'An administrator reset the password for your InternPath account. Contact your administrator to receive the temporary sign-in details — you will be asked to choose a new password at first sign-in. If you did not expect this, contact your administrator immediately.',
  });

  return tempPassword;
}

// Change user password (with current password verification)
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  actorId: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw HttpError.badRequest('Current password is incorrect');
  
  const newPasswordHash = await hashPassword(newPassword);
  
  // Use transaction to ensure session invalidation and password update are atomic
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
      },
    });
    
    // Invalidate all existing sessions for this user
    await tx.session.deleteMany({ where: { userId } });
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_PASSWORD_CHANGED,
    entityType: 'User',
    entityId: userId,
    reason: 'User changed password',
  });
}

// Create user (public registration - always STUDENT)
export async function createStudentUser(
  email: string,
  password: string,
  fullName: string
): Promise<User> {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      // P1-01 defence in depth: store the canonical lowercase address so the
      // account identity matches every later lookup regardless of the
      // validation layer.
      email: email.trim().toLowerCase(),
      passwordHash,
      fullName,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      privacyAcceptedAt: new Date(),
    },
  });
}

// Create user by admin (MENTOR or ADMIN)
export async function createUserByAdmin(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  actorId: string,
  reason: string
): Promise<User> {
  const passwordHash = await hashPassword(password);
  const validityHours = await getSetting<number>('tempPasswordValidityHours', 24);
  const tempPasswordExpiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      passwordHash,
      fullName,
      role,
      status: UserStatus.ACTIVE,
      privacyAcceptedAt: new Date(), // Admin-created accounts implicitly accept privacy
      // FR-DRV-001/002: admin-created accounts receive a single-use, expiring
      // temporary password and must change it at first login.
      mustChangePassword: true,
      tempPasswordExpiresAt,
    },
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_CREATED,
    entityType: 'User',
    entityId: user.id,
    newValue: { email: user.email, fullName: user.fullName, role: user.role },
    reason,
  });
  
  return user;
}

// Suspend/unsuspend user
export async function setUserSuspended(
  userId: string,
  suspended: boolean,
  actorId: string,
  reason: string
): Promise<User> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
  });
  
  // Delete all sessions if suspended
  if (suspended) {
    await deleteAllUserSessions(userId);
  }
  
  await createAuditLog({
    actorId,
    action: suspended ? AuditAction.USER_SUSPENDED : AuditAction.USER_REACTIVATED,
    entityType: 'User',
    entityId: userId,
    reason,
  });

  // Security notification (public-release hardening): the affected user is
  // told their access changed and why. The reason is the admin's mandatory
  // audit reason — the same text recorded in the audit log.
  await sendEmail({
    to: user.email,
    subject: suspended
      ? 'InternPath: your account was suspended'
      : 'InternPath: your account was reactivated',
    text: suspended
      ? `Your InternPath account has been suspended. Reason recorded by the administrator: "${reason}". If you believe this is a mistake, contact your administrator.`
      : `Your InternPath account has been reactivated and you can sign in again. Reason recorded by the administrator: "${reason}".`,
  });

  return user;
}

// Change user role (admin only)
export async function changeUserRole(
  userId: string,
  newRole: UserRole,
  actorId: string,
  reason: string
): Promise<User> {
  // Use transaction to ensure session invalidation and role update are atomic
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
    
    // Invalidate all existing sessions for this user
    await tx.session.deleteMany({ where: { userId } });
    
    await createAuditLog({
      actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'User',
      entityId: userId,
      newValue: { role: newRole },
      reason,
    });
    
    return user;
  });
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  // P1-01: canonical lookup — trim + lowercase so any caller path (login,
  // admin reset, OAuth match) resolves the same account.
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

// Find user by ID
export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}