// Application Service
// Business logic for application lifecycle

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import { notify, notifyAdmins } from '../notifications/notification.service';
import { isStudentProfileComplete } from '../profiles/profiles.service';
import type { CreateApplicationInput, AdminDecisionInput, ListApplicationsQuery } from './application.validation';
import { Prisma } from '@prisma/client';

export class ApplicationService {
  // ============================================================
  // Student Operations
  // ============================================================

  async listMyApplications(userId: string, query: ListApplicationsQuery) {
    const { status, programId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (programId) where.programId = programId;

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          program: {
            include: {
              domain: { select: { id: true, name: true } },
            },
          },
          statusHistory: {
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyApplication(userId: string, applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        program: {
          include: {
            domain: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (application.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    return application;
  }

  async createDraft(userId: string, data: CreateApplicationInput) {
    // Verify program exists and is OPEN
    const program = await prisma.program.findUnique({
      where: { id: data.programId },
    });

    if (!program) {
      throw new AppError('Program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    if (program.status !== 'OPEN') {
      throw new AppError('Applications only accepted for OPEN programs', 400, 'PROGRAM_NOT_OPEN');
    }

    if (program.applicationDeadline <= new Date()) {
      throw new AppError('Application deadline has passed', 400, 'DEADLINE_PASSED');
    }

    // Check if student already has an open application for this program
    const existingOpen = await prisma.application.findFirst({
      where: {
        userId,
        programId: data.programId,
        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
      },
    });

    if (existingOpen) {
      throw new AppError('Already have an open application for this program', 409, 'APPLICATION_EXISTS');
    }

    // BR-CAND-004: Check if student already has an active internship
    const activeInternship = await prisma.internship.findFirst({
      where: {
        userId,
        status: { in: ['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION'] },
      },
    });

    if (activeInternship) {
      throw new AppError('Already have an active or pending internship', 400, 'ACTIVE_INTERNSHIP_EXISTS');
    }

    return prisma.application.create({
      data: {
        userId,
        programId: data.programId,
        statementOfInterest: data.statementOfInterest,
        status: 'DRAFT',
      },
      include: { program: true },
    });
  }

  async updateDraft(userId: string, applicationId: string, data: { statementOfInterest?: string }) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (application.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (application.status !== 'DRAFT') {
      throw new AppError('Can only update draft applications', 400, 'NOT_DRAFT');
    }

    // Check deadline hasn't passed
    const program = await prisma.program.findUnique({
      where: { id: application.programId },
    });

    if (!program || program.applicationDeadline <= new Date()) {
      throw new AppError('Application deadline has passed', 400, 'DEADLINE_PASSED');
    }

    return prisma.application.update({
      where: { id: applicationId },
      data: {
        statementOfInterest: data.statementOfInterest,
      },
      include: { program: true },
    });
  }

  async submit(userId: string, applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { program: true },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (application.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (application.status !== 'DRAFT') {
      throw new AppError('Can only submit draft applications', 400, 'NOT_DRAFT');
    }

    // Check deadline
    if (application.program.applicationDeadline <= new Date()) {
      throw new AppError('Application deadline has passed', 400, 'DEADLINE_PASSED');
    }

    // "Applications only accepted for OPEN programs" (BR): createDraft enforces
    // this gate; submit must re-check it so a draft cannot be submitted after
    // an admin has closed the program while its deadline is still in the future.
    if (application.program.status !== 'OPEN') {
      throw new AppError('Applications only accepted for OPEN programs', 400, 'PROGRAM_NOT_OPEN');
    }

    // BR-CAND-001: Profile must be complete (BE-15 fix, audit 2026-10-20:
    // uses the shared profiles helper, synchronized with the DEC-036
    // required-fields list including declaredSkills)
    const profileComplete = await isStudentProfileComplete(userId);
    if (!profileComplete) {
      throw new AppError('Student profile must be complete before applying', 400, 'PROFILE_INCOMPLETE');
    }

    // BR-CAND-002: Check eligibility
    const assessment = await prisma.assessmentAttempt.findFirst({
      where: {
        userId,
        domainId: application.program.domainId,
        resultLevel: { not: 'NOT_ELIGIBLE' },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!assessment) {
      throw new AppError('Must complete domain assessment before applying', 400, 'ASSESSMENT_REQUIRED');
    }

    // Check level eligibility
    // TEMP: requiredLevel defaults to program level (per baseline)
    const requiredLevel = application.program.requiredLevel ?? application.program.level;
    const levelOrder = { BEGINNER: 1, INTERMEDIATE: 2 };
    const studentLevel = levelOrder[assessment.resultLevel as keyof typeof levelOrder] ?? 0;
    const requiredLevelNum = levelOrder[requiredLevel as keyof typeof levelOrder] ?? 1;

    if (studentLevel < requiredLevelNum) {
      throw new AppError('Does not meet program eligibility requirements', 400, 'NOT_ELIGIBLE');
    }

    // Audit 2026-10-20 divergence resolved: the submit-time seat check was
    // REMOVED. DEC-007/BR-CAND-007 apply seat limits when offers are approved,
    // not at submission; gating submission on capacity was not part of the
    // approved rule set and blocked legitimate applications early.

    // BE-07: status update + audit history run in one transaction; a
    // conditional updateMany prevents double-submission races (BE-16).
    return prisma.$transaction(async (tx) => {
      const moved = await tx.application.updateMany({
        where: { id: applicationId, status: application.status },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      if (moved.count !== 1) {
        throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: 'SUBMITTED',
          changedBy: userId,
          reason: 'Submitted by student',
        },
      });

      return tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: {
          program: { include: { domain: true } },
          statusHistory: true,
        },
      });
    });
  }

  async withdraw(userId: string, applicationId: string, reason: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (application.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (!['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(application.status)) {
      throw new AppError('Cannot withdraw application in current status', 400, 'INVALID_STATUS');
    }

    const previousStatus = application.status;

    // BE-07: status update + history in one transaction; conditional update
    // prevents a concurrent decision/withdraw race. Seat release is derived
    // from the APPROVED+ACCEPTED count, which drops once status leaves
    // APPROVED (no explicit release step needed).
    return prisma.$transaction(async (tx) => {
      const moved = await tx.application.updateMany({
        where: { id: applicationId, status: previousStatus },
        data: { status: 'WITHDRAWN' },
      });

      if (moved.count !== 1) {
        throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: previousStatus,
          toStatus: 'WITHDRAWN',
          changedBy: userId,
          reason,
        },
      });

      return tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: { program: true },
      });
    });
  }

  /**
   * BE-07 (audit 2026-10-20): Prisma serialization failures (P2034) from
   * Serializable transactions are surfaced to clients as 409 CONFLICT with a
   * retry hint instead of an opaque 500 DATABASE_ERROR.
   */
  private mapTransactionError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new AppError(
        'Concurrent modification detected; please retry',
        409,
        'CONCURRENT_UPDATE'
      );
    }
    throw error; // rethrow original error untouched
  }

  async accept(userId: string, applicationId: string) {
    // BE-08 fix (audit 2026-10-20): first handle expired offers in their own
    // transaction so the EXPIRED terminal state (DEC-007/DEC-019) is
    // persisted even though the request itself fails with 400. Throwing
    // inside the main transaction below would roll the transition back.
    const preRead = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { program: true },
    });

    // Ownership + existence are collapsed into 404 so application existence
    // is not disclosed to non-owners (authorization tightening).
    if (preRead?.userId !== userId) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (
      preRead.status === 'APPROVED' &&
      preRead.acceptanceDeadline &&
      new Date() > preRead.acceptanceDeadline
    ) {
      await prisma.$transaction(async (tx) => {
        const expired = await tx.application.updateMany({
          where: { id: applicationId, status: 'APPROVED' },
          data: { status: 'EXPIRED' },
        });

        if (expired.count === 1) {
          await tx.applicationStatusHistory.create({
            data: {
              applicationId,
              fromStatus: 'APPROVED',
              toStatus: 'EXPIRED',
              changedBy: userId,
              reason: 'Acceptance deadline elapsed',
            },
          });
        }
      });

      throw new AppError(
        'Acceptance deadline has passed; the offer has expired',
        400,
        'OFFER_EXPIRED'
      );
    }

    if (preRead.status !== 'APPROVED') {
      throw new AppError('Can only accept approved applications', 400, 'NOT_APPROVED');
    }

    // completionThreshold is fixed per internship at creation time (BE-09:
    // read from PlatformSetting; DEC-003 approved 60 pending GC-03).
    const completionThreshold = await getSetting<number>('completionThreshold');

    try {
      const accepted = await prisma.$transaction(
        async (tx) => {
          // BR-CAND-004 re-checked inside the transaction
          const activeInternship = await tx.internship.findFirst({
            where: {
              userId,
              status: { in: ['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION'] },
            },
          });

          if (activeInternship) {
            throw new AppError('Already have an active or pending internship', 400, 'ACTIVE_INTERNSHIP_EXISTS');
          }

          // Conditional transition: only one writer can move APPROVED→ACCEPTED.
          const accepted = await tx.application.updateMany({
            where: { id: applicationId, status: 'APPROVED' },
            data: {
              status: 'ACCEPTED',
              // acceptedAt field does not exist in the schema; decidedAt is
              // the recorded decision timestamp (audit follow-up kept open).
              decidedAt: new Date(),
            },
          });

          if (accepted.count !== 1) {
            throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
          }

          // Create internship in PENDING_START
          const internship = await tx.internship.create({
            data: {
              userId,
              programId: preRead.programId,
              status: 'PENDING_START',
              startDate: preRead.program.startDate,
              endDate: new Date(
                preRead.program.startDate.getTime() +
                  preRead.program.durationWeeks * 7 * 24 * 60 * 60 * 1000
              ),
              completionThreshold,
              // TEMP: rubricVersion stays 1; no PlatformSetting key approved yet
              rubricVersion: 1,
            },
          });

          await tx.applicationStatusHistory.create({
            data: {
              applicationId,
              fromStatus: 'APPROVED',
              toStatus: 'ACCEPTED',
              changedBy: userId,
              reason: 'Accepted by student',
            },
          });

          await tx.internshipStatusHistory.create({
            data: {
              internshipId: internship.id,
              fromStatus: null,
              toStatus: 'PENDING_START',
              changedBy: userId,
              reason: 'Internship created from accepted application',
            },
          });

          const updated = await tx.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: { program: true },
          });

          return { application: updated, internship };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      // Phase 10: administrators must assign a mentor and a project before the
      // internship can start (FR-CAND-080) — tell them it is waiting.
      await notifyAdmins({
        type: 'INTERNSHIP_PENDING_SETUP',
        title: 'Internship awaiting mentor and project',
        message: `"${accepted.application.program.title}" was accepted and needs a mentor and a project assignment.`,
        link: '/admin/internships',
      });

      return accepted;
    } catch (error) {
      this.mapTransactionError(error);
    }
  }

  async decline(userId: string, applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    if (application.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (application.status !== 'APPROVED') {
      throw new AppError('Can only decline approved applications', 400, 'NOT_APPROVED');
    }

    // BE-07: status update + history in one transaction; the previous status
    // is the guard so a concurrent decision cannot be overwritten.
    return prisma.$transaction(async (tx) => {
      const moved = await tx.application.updateMany({
        where: { id: applicationId, status: 'APPROVED' },
        data: { status: 'DECLINED' },
      });

      if (moved.count !== 1) {
        throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: 'APPROVED',
          toStatus: 'DECLINED',
          changedBy: userId,
          reason: 'Declined by student',
        },
      });

      return tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: { program: true },
      });
    });
  }

  // ============================================================
  // Admin Operations
  // ============================================================

  async listAll(query: ListApplicationsQuery) {
    const { status, programId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (programId) where.programId = programId;

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          program: { include: { domain: true } },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(applicationId: string) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: { select: { id: true, fullName: true, email: true, studentProfile: true } },
        program: { include: { domain: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    return application;
  }

  async adminDecision(applicationId: string, adminId: string, data: AdminDecisionInput) {
    // BE-09: acceptance period comes from PlatformSetting (TEMP default 3
    // days, MD proposed) instead of a hardcoded constant.
    const acceptancePeriodDays =
      data.status === 'APPROVED' ? await getSetting<number>('acceptancePeriodDays') : null;

    try {
      const decisionResult = await prisma.$transaction(
        async (tx) => {
          const application = await tx.application.findUnique({
            where: { id: applicationId },
            include: { program: true },
          });

          if (!application) {
            throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
          }

          if (application.status !== 'SUBMITTED' && application.status !== 'UNDER_REVIEW') {
            throw new AppError('Can only decide on submitted or under-review applications', 400, 'INVALID_STATUS');
          }

          const previousStatus = application.status;
          let acceptanceDeadline: Date | null = null;

          if (data.status === 'APPROVED') {
            // BE-07: seat availability is checked inside the same Serializable
            // transaction as the transition, so concurrent approvals cannot
            // exceed approved capacity (BR-CAND-007 counts APPROVED+ACCEPTED).
            const takenSeats = await tx.application.count({
              where: {
                programId: application.programId,
                status: { in: ['APPROVED', 'ACCEPTED'] },
              },
            });

            if (takenSeats >= application.program.seats) {
              throw new AppError('Program is full', 400, 'PROGRAM_FULL');
            }

            // P2 safeguard (staging remediation 2026-11-21): an offer must not
            // be issued into an opportunity that has no real mentor with
            // confirmed operational capacity in the program's domain — an
            // acceptance the platform cannot staff would misrepresent the
            // opportunity. Recruit and onboard a mentor (matching expertise,
            // free capacity) before approving applications.
            const mentorCandidates = await tx.user.findMany({
              where: {
                role: 'MENTOR',
                status: 'ACTIVE',
                mentorProfile: {
                  is: { domains: { some: { id: application.program.domainId } } },
                },
              },
              select: {
                id: true,
                mentorProfile: { select: { maxActiveInterns: true } },
                _count: {
                  select: { mentorInternships: { where: { status: 'ACTIVE' } } },
                },
              },
            });
            const hasMentorCapacity = mentorCandidates.some(
              (m) => m._count.mentorInternships < (m.mentorProfile?.maxActiveInterns ?? 0)
            );
            if (!hasMentorCapacity) {
              throw new AppError(
                'No eligible mentor with confirmed capacity for this program\'s domain — onboard a real mentor with matching expertise and free capacity before approving applications.',
                409,
                'NO_ELIGIBLE_MENTOR'
              );
            }

            acceptanceDeadline = new Date();
            acceptanceDeadline.setDate(acceptanceDeadline.getDate() + acceptancePeriodDays!);
          }

          // Conditional transition guards against concurrent decisions.
          const decided = await tx.application.updateMany({
            where: { id: applicationId, status: previousStatus },
            data: {
              status: data.status,
              decidedAt: new Date(),
              decidedBy: adminId,
              // BE-18: rejectionReason only applies to REJECTED decisions;
              // an approval must not carry (or leave) a rejection reason.
              rejectionReason: data.status === 'REJECTED' ? data.reason ?? null : null,
              acceptanceDeadline,
            },
          });

          if (decided.count !== 1) {
            throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
          }

          await tx.applicationStatusHistory.create({
            data: {
              applicationId,
              fromStatus: previousStatus,
              toStatus: data.status,
              changedBy: adminId,
              reason: data.reason,
            },
          });

          // Seat release on rejection is derived from the APPROVED+ACCEPTED
          // count (no explicit release step).
          return tx.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: { program: { include: { domain: true } } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      // Phase 10: notify the student of the decision (FR-CAND-098 catalogue).
      if (data.status === 'APPROVED' && decisionResult.acceptanceDeadline) {
        await notify(decisionResult.userId, {
          type: 'APPLICATION_APPROVED',
          title: 'Application approved',
          message: `Your application for "${decisionResult.program.title}" was approved. Accept before ${decisionResult.acceptanceDeadline.toISOString().slice(0, 10)} to secure your seat.`,
          link: '/applications',
        });
      } else if (data.status === 'REJECTED') {
        await notify(decisionResult.userId, {
          type: 'APPLICATION_REJECTED',
          title: 'Application decision recorded',
          message: `Your application for "${decisionResult.program.title}" was not approved${data.reason ? `: ${data.reason}` : ''}.`,
          link: '/applications',
        });
      }

      return decisionResult;
    } catch (error) {
      this.mapTransactionError(error);
    }
  }

  /**
   * BE-14 (audit 2026-10-20): the SUBMITTED → UNDER_REVIEW transition from
   * DEC-019 was unreachable (adminDecision only produced APPROVED/REJECTED).
   */
  async startUnderReview(applicationId: string, adminId: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const application = await tx.application.findUnique({
            where: { id: applicationId },
          });

          if (!application) {
            throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
          }

          if (application.status !== 'SUBMITTED') {
            throw new AppError('Can only move submitted applications to review', 400, 'INVALID_STATUS');
          }

          const moved = await tx.application.updateMany({
            where: { id: applicationId, status: 'SUBMITTED' },
            data: { status: 'UNDER_REVIEW' },
          });

          if (moved.count !== 1) {
            throw new AppError('Application state changed concurrently', 409, 'CONCURRENT_UPDATE');
          }

          await tx.applicationStatusHistory.create({
            data: {
              applicationId,
              fromStatus: 'SUBMITTED',
              toStatus: 'UNDER_REVIEW',
              changedBy: adminId,
              reason: 'Review started',
            },
          });

          return tx.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: { program: { include: { domain: true } }, statusHistory: { orderBy: { changedAt: 'asc' } } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      this.mapTransactionError(error);
    }
  }
}

export const applicationService = new ApplicationService();