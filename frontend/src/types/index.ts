// Shared TypeScript Types
// Aligned with backend Prisma schema

export type UserRole = 'STUDENT' | 'MENTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  privacyAcceptedAt: string | null;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  actor?: { fullName: string; role: UserRole } | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

// Subset of User returned by /api/auth/me and auth endpoints
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  /** False until the emailed 6-digit code is confirmed (when verification is enabled). */
  emailVerified: boolean;
  privacyAcceptedAt: string | null;
  createdAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  institution: string;
  degree: string;
  yearOfStudy: number;
  graduationYear: number;
  declaredSkills: string[];
  githubProfileUrl: string | null;
  portfolioUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MentorProfile {
  id: string;
  userId: string;
  summary: string | null;
  maxActiveInterns: number;
  domains?: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  privacyAcceptedAt: string | null;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Domain / Skill / Program / Assessment / Application contracts
// (aligned with backend Prisma models and Zod schemas — Phase 3 wiring)
// ---------------------------------------------------------------------------

export type ProgramStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'WITHDRAWN';
export type AssessmentResultLevel = 'BEGINNER' | 'INTERMEDIATE' | 'NOT_ELIGIBLE';

export interface Domain {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Populated by the domain list endpoint when skills are included. */
  skills?: Skill[];
}

export interface Skill {
  id: string;
  name: string;
  domainId: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  title: string;
  domainId: string;
  durationWeeks: number;
  level: string;
  requiredLevel: string | null;
  seats: number;
  applicationDeadline: string;
  startDate: string;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
  domain?: Pick<Domain, 'id' | 'name'>;
  /** Serialized Prisma {@code _count.applications} — present in list responses. */
  applicationsCount?: number;
  _count?: { applications: number };
}

export interface ApplicationStatusHistoryEntry {
  id: string;
  applicationId: string;
  fromStatus: string | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  changedById: string | null;
  changedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  programId: string;
  statementOfInterest: string | null;
  status: ApplicationStatus;
  decidedById: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  acceptanceDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
  program?: Program;
  statusHistory?: ApplicationStatusHistoryEntry[];
  submittedAt?: string | null;
  /** Admin review surfaces include the applicant's account record. */
  user?: { id: string; fullName: string; email: string };
  /** Student GET of a DRAFT: the server-side submission gates, unthrown. */
  readiness?: ApplicationReadiness | null;
}

export interface ApplicationReadiness {
  ready: boolean;
  programOpen: boolean;
  deadlineOpen: boolean;
  profileComplete: boolean;
  assessmentTaken: boolean;
  assessmentPassed: boolean;
  levelMet: boolean;
  resultLevel: AssessmentResultLevel | null;
  requiredLevel: string;
  domainId: string;
}

/** GET /api/{admin|mentor}/applications/:id — everything needed to decide. */
export interface ApplicationReviewDetail extends Omit<Application, 'user' | 'statusHistory'> {
  user: { id: string; fullName: string; email: string; studentProfile: StudentProfile | null };
  statusHistory: Array<
    ApplicationStatusHistoryEntry & { changedByName: string | null; changedByRole: UserRole | null }
  >;
  assessment: {
    id: string;
    resultLevel: AssessmentResultLevel | null;
    submittedAt: string | null;
    skills: Array<{ skillId: string; name: string; score: number }>;
  } | null;
  seats: { taken: number; total: number };
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  /** Answer options; answer keys are never sent to the client (BE-02). */
  options: string[];
  domainId: string;
  skillId: string;
  isActive: boolean;
  skill?: Pick<Skill, 'id' | 'name'>;
}

export interface AssessmentAttempt {
  id: string;
  userId: string;
  domainId: string;
  startedAt: string;
  deadlineAt: string;
  timeLimitMinutes: number;
  submittedAt: string | null;
  perSkillScores: Record<string, number> | null;
  resultLevel: AssessmentResultLevel | null;
  questions?: AssessmentQuestion[];
  timeRemainingMs?: number;
  isExpired?: boolean;
  domain?: Pick<Domain, 'id' | 'name'>;
}

/* ------------------------------------------------------------------ */
/* Sprint 3 — Projects                                                 */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
export type ProjectSourceType =
  | 'MENTOR_CREATED'
  | 'SIMULATED'
  | 'OPEN_SOURCE'
  | 'COMMUNITY'
  | 'CLIENT';
export type EvidenceType = 'CODE' | 'DOCUMENT' | 'LIVE_DEMO';

export interface Project {
  id: string;
  title: string;
  sourceType: ProjectSourceType;
  domainId: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE';
  durationWeeks: number;
  requiredSkills: string[];
  problemStatement: string;
  objectives: string;
  requirements: string;
  expectedDeliverables: string;
  evaluationCriteria: string;
  submissionGuidelines: string;
  status: ProjectStatus;
  authorId: string;
  reviewComments: string | null;
  organizationName: string | null;
  upstreamRepoUrl: string | null;
  licence: string | null;
  createdAt: string;
  updatedAt: string;
  domain?: Pick<Domain, 'id' | 'name'>;
  author?: { id: string; fullName: string; role: UserRole };
  milestones?: ProjectMilestone[];
  _count?: { milestones: number; internships: number };
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  order: number;
  isRequired: boolean;
  tasks?: ProjectTask[];
}

export interface ProjectTask {
  id: string;
  milestoneId: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  isMandatory: boolean;
  evidenceTypes: EvidenceType[];
  dueOffsetDays: number;
  order: number;
  dependencies?: { prerequisiteTaskId: string }[];
}

/* ------------------------------------------------------------------ */
/* Sprint 3/4 — Internships, tasks, submissions, reviews               */
/* ------------------------------------------------------------------ */

export type InternshipStatus =
  | 'PENDING_START'
  | 'ACTIVE'
  | 'UNDER_EVALUATION'
  | 'COMPLETED'
  | 'WITHDRAWN'
  | 'TERMINATED';
export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'RESUBMITTED';

export interface InternshipProgress {
  totalTasks: number;
  mandatoryTasks: number;
  approvedMandatoryTasks: number;
  /** Weighted completion 0-100 (Phase 12 3.6) - trusted backend calculation. */
  approvedPercentage: number;
  weightTotal: number;
  weightApproved: number;
  pendingReviewCount: number;
  changesRequestedCount: number;
  remainingMandatoryTasks: number;
  overdueCount: number;
  currentMilestone: { id: string; title: string } | null;
  nextTask: { id: string; title: string; dueDate: string } | null;
  perMilestone: Array<{
    id: string;
    title: string;
    order: number;
    isRequired: boolean;
    mandatoryTasks: number;
    approvedMandatoryTasks: number;
    weightTotal: number;
    weightApproved: number;
    percentage: number;
    complete: boolean;
    targetDate: string | null;
  }>;
}

export interface InternshipActivityEvent {
  kind: 'submission' | 'review' | 'status';
  at: string;
  taskTitle: string;
  versionNumber: number | null;
  decision: string | null;
  comment: string | null;
}

export interface InternTask {
  id: string;
  internshipId: string;
  internMilestoneId: string | null;
  sourceTaskId: string | null;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  isMandatory: boolean;
  evidenceTypes: EvidenceType[];
  dueDate: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  resubmissionCount: number;
  /** Presentation-side lock/overdue annotations (computed by the API). */
  locked?: boolean;
  overdue?: boolean;
  resources?: Resource[];
  resubmissionsRemaining?: number | null;
  submissions?: Submission[];
}

export interface InternMilestone {
  id: string;
  internshipId: string;
  title: string;
  description: string | null;
  order: number;
  isRequired: boolean;
  tasks?: InternTask[];
}

export interface Internship {
  id: string;
  userId: string;
  programId: string;
  mentorId: string | null;
  projectId: string | null;
  status: InternshipStatus;
  startDate: string;
  endDate: string;
  extensionDate: string | null;
  extensionReason: string | null;
  completionThreshold: number;
  rubricVersion: number;
  completedAt: string | null;
  withdrawalReason: string | null;
  terminationReason: string | null;
  /** Admin surfaces include the student account record. */
  user?: { id: string; fullName: string; email: string };
  createdAt: string;
  updatedAt: string;
  program?: Program;
  mentor?: { id: string; fullName: string; email: string } | null;
  project?: Pick<Project, 'id' | 'title' | 'sourceType' | 'difficulty' | 'durationWeeks'> | null;
  intern?: { id: string; fullName: string; email: string };
  progress?: InternshipProgress;
  milestones?: InternMilestone[];
  /** Frozen evaluation rubric (FR-DRV-006) — served to mentor + student views. */
  rubric?: Rubric | null;
  evaluation?: Evaluation | null;
  certificate?: { id: string; certificateNumber: string; type: string; status: string; issuedAt: string } | null;
  certificateAvailable?: boolean;
  statusHistory?: InternshipStatusHistoryEntry[];
  /** Recent real activity (Phase 12 3.7): submissions, reviews, status events. */
  activity?: InternshipActivityEvent[];
}

export interface InternshipStatusHistoryEntry {
  id: string;
  internshipId: string;
  fromStatus: InternshipStatus | null;
  toStatus: InternshipStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: string;
}

export interface Submission {
  id: string;
  internTaskId: string;
  versionNumber: number;
  repositoryUrl: string | null;
  commitRef: string | null;
  documentUrl: string | null;
  liveDemoUrl: string | null;
  notes: string | null;
  originalityDeclared: boolean;
  submittedAt: string;
  review?: Review | null;
}

export interface Review {
  id: string;
  submissionId: string;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  comment: string;
  reviewedBy: string;
  reviewer?: { fullName: string; role: UserRole };
  reviewedAt: string;
  studentReply?: string | null;
}

export interface Rubric {
  id: string;
  version: number;
  isActive: boolean;
  criteria: RubricCriterion[];
}

export interface RubricCriterion {
  id: string;
  rubricId: string;
  name: string;
  weight: number;
  order: number;
}

export interface Evaluation {
  id: string;
  internshipId: string;
  rubricVersion: number;
  criterionScores: { criterionId: string; score: number }[];
  finalScore: number;
  recommendation: 'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE';
  remarks: string | null;
  submittedBy: string;
  submittedAt: string;
  locked: boolean;
  evaluator?: { fullName: string; role: UserRole };
}

/* ------------------------------------------------------------------ */
/* Sprint 5 — Certificates                                             */
/* ------------------------------------------------------------------ */

export type CertificateType = 'COMPLETION' | 'APPRECIATION';
export type CertificateStatus = 'VALID' | 'REVOKED';

export interface Certificate {
  id: string;
  certificateNumber: string;
  type: CertificateType;
  status: CertificateStatus;
  internshipId: string;
  issuedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  internship?: {
    id: string;
    status: InternshipStatus;
    startDate: string;
    endDate?: string;
    user?: { id: string; fullName: string; email: string };
    program?: { title: string; domain?: { name: string } };
    project?: { title: string; sourceType: ProjectSourceType } | null;
  };
  issuer?: { fullName: string; role: UserRole };
}

export interface CertificateVerification {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND';
  certificateNumber: string;
  certificate?: {
    recipientName: string;
    programTitle: string;
    domainName: string;
    projectTitle: string | null;
    projectSourceType: string | null;
    internshipStart: string;
    internshipCompletion: string | null;
    issuedAt: string;
    issuedByRole: string;
    revocationNote: string | null;
  };
}

/* ------------------------------------------------------------------ */
/* Sprint 6 — Reports, Notifications, Resources                        */
/* ------------------------------------------------------------------ */

export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ReportCategory =
  | 'PAYMENT_REQUEST'
  | 'FAKE_PROJECT'
  | 'MISLEADING_INTERNSHIP'
  | 'MENTOR_MISCONDUCT'
  | 'UNREASONABLE_WORKLOAD'
  | 'SUSPICIOUS_BEHAVIOUR'
  | 'EVALUATION_DISPUTE'
  | 'OTHER';

export interface Report {
  id: string;
  reporterId: string;
  category: ReportCategory;
  description: string;
  evidenceLinks: string[];
  targetUserId: string | null;
  targetProjectId: string | null;
  targetInternshipId: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  reporter?: { id: string; fullName: string; role: UserRole };
  handler?: { id: string; fullName: string } | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export type ResourceType =
  | 'ARTICLE'
  | 'VIDEO'
  | 'DOCUMENTATION'
  | 'BOOK'
  | 'COURSE'
  | 'TUTORIAL'
  | 'TOOL'
  | 'OTHER';

export interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  tags: string[];
  domainId: string | null;
  projectId: string | null;
  taskId: string | null;
  skillId: string | null;
  createdAt: string;
}
