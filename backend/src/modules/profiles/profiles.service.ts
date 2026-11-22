// Profiles Service
// Handles student and mentor profile operations

import type { User, StudentProfile, MentorProfile } from '@prisma/client';
import { prisma } from '../../shared/prisma/client';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { HttpError } from '../../shared/middleware/errorHandler';

// ============================================================
// Student Profile
// ============================================================

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  return prisma.studentProfile.findUnique({
    where: { userId },
  });
}

export async function createStudentProfile(
  userId: string,
  data: {
    institution: string;
    degree: string;
    yearOfStudy: number;
    graduationYear: number;
    declaredSkills?: string[];
    githubProfileUrl?: string | null;
    portfolioUrl?: string | null;
    bio?: string | null;
  },
  actorId: string
): Promise<StudentProfile> {
  // Verify user exists and is a student
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound('User not found');
  if (user.role !== 'STUDENT') throw HttpError.badRequest('User is not a student');
  
  // Check if profile already exists
  const existing = await prisma.studentProfile.findUnique({ where: { userId } });
  if (existing) throw HttpError.conflict('Student profile already exists');
  
  const profile = await prisma.studentProfile.create({
    data: {
      userId,
      institution: data.institution,
      degree: data.degree,
      yearOfStudy: data.yearOfStudy,
      graduationYear: data.graduationYear,
      declaredSkills: data.declaredSkills || [],
      githubProfileUrl: data.githubProfileUrl,
      portfolioUrl: data.portfolioUrl,
      bio: data.bio,
    },
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_CREATED, // Reusing for profile creation
    entityType: 'StudentProfile',
    entityId: profile.id,
    newValue: { userId, ...data },
    reason: 'Student profile created',
  });
  
  return profile;
}

export async function updateStudentProfile(
  userId: string,
  data: Partial<{
    institution: string;
    degree: string;
    yearOfStudy: number;
    graduationYear: number;
    declaredSkills: string[];
    githubProfileUrl: string | null;
    portfolioUrl: string | null;
    bio: string | null;
  }>,
  actorId: string
): Promise<StudentProfile> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw HttpError.notFound('Student profile not found');
  
  const oldValue = { ...profile };
  
  const updated = await prisma.studentProfile.update({
    where: { userId },
    data,
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_UPDATED,
    entityType: 'StudentProfile',
    entityId: profile.id,
    oldValue,
    newValue: { ...oldValue, ...data },
    reason: 'Student profile updated',
  });
  
  return updated;
}

export async function isStudentProfileComplete(userId: string): Promise<boolean> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return false;

  // TEMP (DEC-036): Required fields per Implementation Baseline §8
  // (BE-15 fix, audit 2026-10-20): declaredSkills added so that the shared
  // helper matches the schema's required-field list; previously inline
  // duplicates in applications disagreed with this helper.
  return !!(
    profile.institution &&
    profile.degree &&
    profile.yearOfStudy &&
    profile.graduationYear &&
    profile.declaredSkills.length > 0
  );
}

// ============================================================
// Mentor Profile
// ============================================================

export async function getMentorProfile(userId: string): Promise<MentorProfile | null> {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    // Public-release fix (2026-11-20): include expertise domains so the
    // mentor profile UI can display and edit them (FR-047 eligibility input).
    include: { domains: { select: { id: true, name: true } } },
  });
}

export async function createMentorProfile(
  userId: string,
  data: {
    summary?: string | null;
    maxActiveInterns?: number;
    domainIds?: string[];
  },
  actorId: string
): Promise<MentorProfile> {
  // Verify user exists and is a mentor
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound('User not found');
  if (user.role !== 'MENTOR') throw HttpError.badRequest('User is not a mentor');

  // Check if profile already exists
  const existing = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (existing) throw HttpError.conflict('Mentor profile already exists');

  // Expertise domains (public-release fix 2026-11-20 — see updateMentorProfile).
  const { domainIds, ...scalarData } = data;
  if (domainIds !== undefined) {
    await assertDomainsUsable(domainIds);
  }

  const profile = await prisma.mentorProfile.create({
    data: {
      userId,
      summary: scalarData.summary,
      maxActiveInterns: scalarData.maxActiveInterns ?? 3, // TEMP (DEC-013)
      ...(domainIds !== undefined
        ? { domains: { connect: domainIds.map((id) => ({ id })) } }
        : {}),
    },
  });
  
  await createAuditLog({
    actorId,
    action: AuditAction.USER_CREATED,
    entityType: 'MentorProfile',
    entityId: profile.id,
    newValue: { userId, ...data },
    reason: 'Mentor profile created',
  });
  
  return profile;
}

export async function updateMentorProfile(
  userId: string,
  data: Partial<{
    summary: string | null;
    maxActiveInterns: number;
    domainIds: string[];
  }>,
  actorId: string
): Promise<MentorProfile> {
  const profile = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (!profile) throw HttpError.notFound('Mentor profile not found');

  const oldValue = { ...profile };

  // Public-release fix (2026-11-20): mentor-declared expertise domains.
  // FR-047 assignment eligibility requires them; without this field no
  // mentor could ever become assignable through the product.
  const { domainIds, ...scalarData } = data as {
    summary?: string | null;
    maxActiveInterns?: number;
    domainIds?: string[];
  };
  const updateData: Record<string, unknown> = { ...scalarData };
  if (domainIds !== undefined) {
    await assertDomainsUsable(domainIds);
    updateData.domains = { set: domainIds.map((id) => ({ id })) };
  }

  const updated = await prisma.mentorProfile.update({
    where: { userId },
    data: updateData,
  });

  await createAuditLog({
    actorId,
    action: AuditAction.USER_UPDATED,
    entityType: 'MentorProfile',
    entityId: profile.id,
    oldValue,
    newValue: { ...oldValue, ...data },
    reason: 'Mentor profile updated',
  });

  return updated;
}

/** Validate expertise-domain ids: must exist and be active. */
async function assertDomainsUsable(domainIds: string[]): Promise<void> {
  if (domainIds.length === 0) return;
  const unique = [...new Set(domainIds)];
  const found = await prisma.domain.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw HttpError.badRequest('One or more expertise domains do not exist or are inactive');
  }
}

// ============================================================
// Profile Completion Check (for BR-CAND-001)
// ============================================================

export async function isProfileComplete(user: User): Promise<boolean> {
  if (user.role === 'STUDENT') {
    return isStudentProfileComplete(user.id);
  }
  // Mentors and admins don't have mandatory profile fields
  return true;
}

// ============================================================
// Admin: Get any user's profile
// ============================================================

export async function getUserProfile(userId: string, _actorRole: string): Promise<{
  studentProfile?: StudentProfile | null;
  mentorProfile?: MentorProfile | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      mentorProfile: true,
    },
  });
  
  if (!user) throw HttpError.notFound('User not found');
  
  // Students and mentors can only view their own or assigned
  // Admins can view all
  // This is enforced at the controller level
  
  return {
    studentProfile: user.studentProfile,
    mentorProfile: user.mentorProfile,
  };
}