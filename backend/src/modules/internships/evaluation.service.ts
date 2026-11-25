// Evaluation Service (Sprint 4 — FR-CAND-074-077, FR-DRV-006, DEC-016)
//
// - The assigned mentor submits ONE final evaluation per internship, only while
//   UNDER_EVALUATION.
// - Weighted final score is computed SERVER-SIDE from the rubric criteria
//   frozen on the internship (rubricVersion). Scores are 0-10 per criterion,
//   weights sum to 100 → final score on a 0-100 scale. Per DEC-003 the raw
//   float is stored (threshold comparison happens BEFORE any rounding).
// - Submitted evaluations are locked (FR-076); modification requires an
//   admin-approved re-evaluation which records previous values.

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify, notifyAdmins } from '../notifications/notification.service';
import { canSupervise, type Supervisor } from './internship.types';

export class EvaluationService {
  /** FR-078: the active rubric is visible to any authenticated user. */
  async getActiveRubric() {
    const rubric = await prisma.rubric.findFirst({
      where: { isActive: true },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });
    return { data: rubric };
  }

  /** FR-074/075: submit the final evaluation (assigned mentor or admin, UNDER_EVALUATION, once). */
  async submit(
    supervisor: Supervisor,
    internshipId: string,
    criterionScores: { criterionId: string; score: number }[],
    recommendation: 'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE',
    remarks?: string
  ) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { program: { select: { title: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (!canSupervise(supervisor, internship.mentorId)) {
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND'); // existence not disclosed
    }
    if (internship.status !== 'UNDER_EVALUATION') {
      throw new AppError(
        'The final evaluation can only be submitted while the internship is UNDER_EVALUATION',
        400,
        'INTERNSHIP_NOT_UNDER_EVALUATION'
      );
    }

    const existing = await prisma.evaluation.findUnique({ where: { internshipId } });
    if (existing && existing.locked) {
      throw new AppError(
        'A final evaluation was already submitted and is locked; a re-evaluation requires administrator approval',
        409,
        'EVALUATION_ALREADY_SUBMITTED'
      );
    }

    // Rubric frozen on the internship (FR-DRV-006)
    const rubric = await prisma.rubric.findUnique({
      where: { version: internship.rubricVersion },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });
    if (!rubric) {
      throw new AppError('The frozen evaluation rubric could not be found', 500, 'RUBRIC_MISSING');
    }

    // Every criterion of the frozen rubric must be scored exactly once.
    const scoreByCriterion = new Map<string, number>();
    for (const item of criterionScores) {
      if (scoreByCriterion.has(item.criterionId)) {
        throw new AppError('Duplicate criterion score', 400, 'DUPLICATE_CRITERION');
      }
      scoreByCriterion.set(item.criterionId, item.score);
    }
    const missing = rubric.criteria.filter((c) => !scoreByCriterion.has(c.id));
    if (missing.length > 0) {
      throw new AppError(
        `Score every rubric criterion (missing: ${missing.map((c) => c.name).join(', ')})`,
        400,
        'CRITERIA_INCOMPLETE'
      );
    }
    const unknown = [...scoreByCriterion.keys()].filter((id) => !rubric.criteria.some((c) => c.id === id));
    if (unknown.length > 0) {
      throw new AppError('Criterion scores contain criteria that are not part of the frozen rubric', 400, 'UNKNOWN_CRITERION');
    }

    // FR-075 / DEC-016: weighted final score, stored as the raw float.
    // Per-criterion score is 0-10; weights sum to 100 → final on a 0-100 scale.
    const weightTotal = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (weightTotal !== 100) {
      throw new AppError(
        `Rubric weights total ${weightTotal} but must total 100 — contact an administrator`,
        500,
        'RUBRIC_WEIGHTS_INVALID'
      );
    }
    const finalScore = rubric.criteria.reduce((sum, c) => sum + scoreByCriterion.get(c.id)! * c.weight, 0) / 10;

    const data = {
      internshipId,
      rubricVersion: internship.rubricVersion,
      criterionScores: criterionScores as unknown as Array<{ criterionId: string; score: number }>,
      finalScore,
      recommendation,
      remarks: remarks ?? null,
      submittedBy: supervisor.id,
    };

    const evaluation = existing
      // Re-evaluation path: previous values are preserved inside the record (FR-076)
      ? await prisma.evaluation.update({
          where: { internshipId },
          data: {
            ...data,
            // P1-05 fix (comprehensive audit 2026-11-15): a re-submission is a
            // NEW authoritative evaluation — `submittedAt` must reflect when
            // the current values were submitted. (`@default(now())` applies
            // only on create, so an update previously kept the original
            // timestamp, making a re-submitted evaluation read as older than
            // the re-approved task work and correctly failing the completion
            // staleness check.)
            submittedAt: new Date(),
            locked: true,
            reEvaluation: {
              ...(existing.reEvaluation as Record<string, unknown> | null),
              previousValues: {
                criterionScores: existing.criterionScores,
                finalScore: existing.finalScore,
                recommendation: existing.recommendation,
                remarks: existing.remarks,
              },
              resubmittedAt: new Date().toISOString(),
            },
          },
        })
      : await prisma.evaluation.create({ data });

    await createAuditLog({
      actorId: supervisor.id,
      action: AuditAction.EVALUATION_SUBMITTED,
      entityType: 'Evaluation',
      entityId: evaluation.id,
      newValue: {
        internshipId,
        finalScore,
        recommendation,
        rubricVersion: internship.rubricVersion,
        isReEvaluation: Boolean(existing),
      },
    });

    await notifyAdmins({
      type: 'EVALUATION_SUBMITTED',
      title: 'Final evaluation submitted',
      message: `"${internship.program.title}" received its final evaluation (score ${finalScore.toFixed(2)}, ${recommendation}). It can be completed once the checklist is verified.`,
      link: `/admin/internships/${internshipId}`,
    });
    await notify(internship.userId, {
      type: 'EVALUATION_SUBMITTED',
      title: 'Final evaluation submitted',
      message: `Your mentor submitted the final evaluation for "${internship.program.title}".`,
      link: `/internships/${internshipId}`,
    });

    return evaluation;
  }

  /** FR-076: administrator approves a re-evaluation (unlocks for the mentor). */
  async approveReEvaluation(adminId: string, internshipId: string, reason: string) {
    const evaluation = await prisma.evaluation.findUnique({ where: { internshipId } });
    if (!evaluation) {
      throw new AppError('No evaluation exists for this internship', 404, 'EVALUATION_NOT_FOUND');
    }
    if (!evaluation.locked) {
      throw new AppError('The evaluation is not locked', 400, 'EVALUATION_NOT_LOCKED');
    }

    const updated = await prisma.evaluation.update({
      where: { internshipId },
      data: {
        locked: false,
        reEvaluation: {
          ...(evaluation.reEvaluation as Record<string, unknown> | null),
          approvedBy: adminId,
          reason,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.EVALUATION_RE_EVALUATION_APPROVED,
      entityType: 'Evaluation',
      entityId: evaluation.id,
      oldValue: { locked: true },
      newValue: { locked: false },
      reason,
    });

    return updated;
  }

  /** FR-077: student reads the final evaluation of their own internship. */
  async getForStudent(userId: string, internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { userId: true },
    });
    if (!internship || internship.userId !== userId) {
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }
    const evaluation = await prisma.evaluation.findUnique({
      where: { internshipId },
      include: { evaluator: { select: { fullName: true, role: true } } },
    });
    if (!evaluation) throw new AppError('No evaluation has been submitted yet', 404, 'EVALUATION_NOT_FOUND');
    return { data: evaluation };
  }

  /** Assigned mentor (or an admin) reads the evaluation of an internship. */
  async getForMentor(supervisor: Supervisor, internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { mentorId: true },
    });
    if (!internship || !canSupervise(supervisor, internship.mentorId)) {
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }
    const evaluation = await prisma.evaluation.findUnique({
      where: { internshipId },
      include: { evaluator: { select: { fullName: true, role: true } } },
    });
    if (!evaluation) throw new AppError('No evaluation has been submitted yet', 404, 'EVALUATION_NOT_FOUND');
    return { data: evaluation };
  }
}

export const evaluationService = new EvaluationService();
