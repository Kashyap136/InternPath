// Profiles Validation Schemas
// Zod schemas for profile endpoints

import { z } from 'zod';

export const studentProfileUpdateSchema = z.object({
  body: z.object({
    institution: z.string().min(1, 'Institution is required').max(100).optional(),
    degree: z.string().min(1, 'Degree is required').max(100).optional(),
    yearOfStudy: z.number().int().positive('Year of study must be a positive integer').optional(),
    graduationYear: z.number().int().min(new Date().getFullYear(), 'Graduation year cannot be in the past').optional(),
    declaredSkills: z.array(z.string()).optional(),
    githubProfileUrl: z.string().url('Invalid GitHub URL').optional().nullable(),
    portfolioUrl: z.string().url('Invalid portfolio URL').optional().nullable(),
    bio: z.string().max(1000, 'Bio must not exceed 1000 characters').optional().nullable(),
  }),
});

export const mentorProfileUpdateSchema = z.object({
  body: z.object({
    summary: z.string().max(1000, 'Summary must not exceed 1000 characters').optional().nullable(),
    maxActiveInterns: z.number().int().positive('Max active interns must be a positive integer').optional(),
    // Public-release fix (2026-11-20): assignment eligibility (FR-047) requires
    // domain expertise on the mentor profile, but neither the API nor the UI
    // could set it — admins could never assign any mentor. Mentors now declare
    // expertise domains (ids of ACTIVE domains, validated in the service).
    domainIds: z
      .array(z.string().min(1, 'Domain id must not be empty'))
      .max(10, 'At most 10 expertise domains')
      .optional(),
  }),
});