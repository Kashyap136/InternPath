// Internship module shared types

export interface CriterionScore {
  criterionId: string;
  score: number;
}

/**
 * The signed-in user acting on the mentor surface (/api/mentor/*). Mentors
 * are limited to internships assigned to them; administrators may act on
 * every internship with the same rules and safeguards.
 */
export interface Supervisor {
  id: string;
  role: 'STUDENT' | 'MENTOR' | 'ADMIN';
}

/** True when the supervisor may act on an internship assigned to `mentorId`. */
export function canSupervise(supervisor: Supervisor, mentorId: string | null): boolean {
  if (supervisor.role === 'ADMIN') return true;
  return supervisor.role === 'MENTOR' && mentorId !== null && mentorId === supervisor.id;
}
