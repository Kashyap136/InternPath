// Background Scheduler (Sprint 3/4 — FR-CAND-080, DEC-007/DEC-019)
//
// A dependency-free interval scheduler (no node-cron — the V1 stack excludes
// unnecessary dependencies). Two jobs:
//
//   1. Offer expiry: APPROVED applications whose acceptance deadline has
//      elapsed transition to EXPIRED (DEC-007/DEC-019). The student-facing
//      accept() path enforces the same rule at call time; this job keeps the
//      data honest without a student action.
//   2. Internship activation: PENDING_START internships whose start date has
//      arrived AND which have both a mentor and a project assigned become
//      ACTIVE (FR-CAND-080). Assignment-time activation is handled in the
//      assignment flows; this job activates those assigned later or whose
//      start date arrived afterwards.
//
// Each run is audited (SCHEDULER_JOB_RUN) and logged. The scheduler never
// throws: individual item failures are logged and skipped. It is disabled in
// the test environment (deterministic tests drive transitions explicitly).

import { prisma } from './prisma/client';
import { createAuditLog, AuditAction } from './utils/audit';
import { cleanExpiredSessions } from '../modules/auth/auth.service';

const INTERVAL_MS = 5 * 60 * 1000;

async function expireStaleOffers(): Promise<number> {
  const stale = await prisma.application.findMany({
    where: { status: 'APPROVED', acceptanceDeadline: { lt: new Date() } },
    select: { id: true },
  });

  let expired = 0;
  for (const application of stale) {
    try {
      // P2-06: transition + history row are atomic.
      const moved = await prisma.$transaction(async (tx) => {
        const movedCount = await tx.application.updateMany({
          where: { id: application.id, status: 'APPROVED' },
          data: { status: 'EXPIRED' },
        });
        if (movedCount.count !== 1) return false;
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: application.id,
            fromStatus: 'APPROVED',
            toStatus: 'EXPIRED',
            changedBy: null,
            reason: 'Acceptance deadline elapsed (scheduler)',
          },
        });
        return true;
      });
      if (moved) expired += 1;
    } catch (error) {
      console.error(`Scheduler: failed to expire application ${application.id}:`, error);
    }
  }
  return expired;
}

async function activateDueInternships(): Promise<number> {
  const due = await prisma.internship.findMany({
    where: {
      status: 'PENDING_START',
      startDate: { lte: new Date() },
      mentorId: { not: null },
      projectId: { not: null },
    },
    select: { id: true },
  });

  let activated = 0;
  for (const internship of due) {
    try {
      // P2-06: transition + history row are atomic.
      const moved = await prisma.$transaction(async (tx) => {
        const movedCount = await tx.internship.updateMany({
          where: { id: internship.id, status: 'PENDING_START' },
          data: { status: 'ACTIVE' },
        });
        if (movedCount.count !== 1) return false;
        await tx.internshipStatusHistory.create({
          data: {
            internshipId: internship.id,
            fromStatus: 'PENDING_START',
            toStatus: 'ACTIVE',
            changedBy: null,
            reason: 'Start date reached with mentor and project assigned (scheduler, FR-CAND-080)',
          },
        });
        return true;
      });
      if (moved) activated += 1;
    } catch (error) {
      console.error(`Scheduler: failed to activate internship ${internship.id}:`, error);
    }
  }
  return activated;
}

export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') {
    return; // deterministic tests drive transitions explicitly
  }

  const run = async (): Promise<void> => {
    try {
      const expiredOffers = await expireStaleOffers();
      const activatedInternships = await activateDueInternships();

      // P2-08 fix (comprehensive audit 2026-11-15): expired session rows were
      // previously never purged (deleted only when presented after expiry) and
      // accumulated without limit along with their unique token index.
      let purgedSessions = 0;
      try {
        purgedSessions = await cleanExpiredSessions();
      } catch (error) {
        console.error('Scheduler: failed to purge expired sessions:', error);
      }

      if (expiredOffers > 0 || activatedInternships > 0 || purgedSessions > 0) {
        console.log(`⏱️ Scheduler: expired ${expiredOffers} offer(s), activated ${activatedInternships} internship(s), purged ${purgedSessions} session(s)`);
        await createAuditLog({
          action: AuditAction.SCHEDULER_JOB_RUN,
          entityType: 'Scheduler',
          entityId: `run-${new Date().toISOString()}`,
          newValue: { expiredOffers, activatedInternships, purgedSessions },
          reason: 'Scheduled lifecycle maintenance',
        });
      }
    } catch (error) {
      console.error('Scheduler run failed:', error);
    }
  };

  // Kick off shortly after boot, then on a fixed interval. unref() keeps the
  // timer from holding the process open during graceful shutdown.
  const timer = setInterval(() => void run(), INTERVAL_MS);
  timer.unref();
  setTimeout(() => void run(), 15_000).unref();

  console.log('⏱️ Scheduler started (5-minute interval)');
}
