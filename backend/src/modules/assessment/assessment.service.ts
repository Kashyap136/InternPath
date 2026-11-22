// Assessment Service
// Business logic for question bank, attempts, and level determination

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import type { CreateQuestionInput, UpdateQuestionInput } from './assessment.validation';

// BE-09 fix (audit 2026-10-20): time limit / retake interval / question
// selection are no longer hardcoded TEMP constants; they are read from
// PlatformSetting (defaults per baseline §25: 30 min, 7 days, all_active)
// via getSetting(), so administrator changes take effect.

export class AssessmentService {
  // ============================================================
  // Question Bank Management (Admin)
  // ============================================================

  async listQuestions(domainId: string) {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return prisma.assessmentQuestion.findMany({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: { select: { id: true, name: true } },
      },
    });
  }

  async getQuestion(id: string) {
    const question = await prisma.assessmentQuestion.findUnique({
      where: { id },
      include: {
        skill: { select: { id: true, name: true } },
        domain: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    // Never send correctOption to browser
    const { correctOption, ...safeQuestion } = question;
    return safeQuestion;
  }

  async createQuestion(domainId: string, data: CreateQuestionInput) {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    const skill = await prisma.skill.findUnique({
      where: { id: data.skillId },
    });

    if (!skill || skill.domainId !== domainId) {
      throw new AppError('Skill not found in this domain', 404, 'SKILL_NOT_FOUND');
    }

    return prisma.assessmentQuestion.create({
      data: {
        text: data.text,
        options: data.options,
        correctOption: data.correctOption,
        domainId,
        skillId: data.skillId,
      },
    });
  }

  async updateQuestion(id: string, data: UpdateQuestionInput) {
    const question = await prisma.assessmentQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    if (data.skillId) {
      const skill = await prisma.skill.findUnique({
        where: { id: data.skillId },
      });

      if (!skill || skill.domainId !== question.domainId) {
        throw new AppError('Skill not found in this domain', 404, 'SKILL_NOT_FOUND');
      }
    }

    // Answer-key integrity: after merging the update with the stored question,
    // correctOption must still index into the (possibly replaced) options array.
    // Without this check an admin could shrink `options` while keeping a stale
    // correctOption, producing a question that can never be scored correct.
    const nextOptions = (data.options ?? question.options) as string[];
    const nextCorrectOption = data.correctOption ?? question.correctOption;
    if (nextOptions.length < 2 || nextCorrectOption < 0 || nextCorrectOption >= nextOptions.length) {
      throw new AppError(
        'correctOption index must be within the resulting options array',
        400,
        'INVALID_OPTION'
      );
    }

    return prisma.assessmentQuestion.update({
      where: { id },
      data: {
        text: data.text,
        options: data.options,
        correctOption: data.correctOption,
        skillId: data.skillId,
        isActive: data.isActive,
      },
    });
  }

  async deleteQuestion(id: string) {
    const question = await prisma.assessmentQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    // Check if question is used in any attempts
    const attemptUsage = await prisma.attemptAnswer.count({
      where: { questionId: id },
    });

    if (attemptUsage > 0) {
      throw new AppError(
        'Cannot delete question used in attempts. Deactivate instead.',
        400,
        'QUESTION_IN_USE'
      );
    }

    return prisma.assessmentQuestion.delete({
      where: { id },
    });
  }

  // ============================================================
  // Assessment Attempts (Student)
  // ============================================================

  async startAttempt(userId: string, domainId: string) {
    // Read configurable values (BE-09): time limit, retake interval, selection
    const [timeLimitMinutes, retakeIntervalDays, selection] = await Promise.all([
      getSetting<number>('assessmentTimeLimitMinutes'),
      getSetting<number>('retakeIntervalDays'),
      getSetting<string>('assessmentQuestionSelection'),
    ]);

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    // Check retake interval (BE-12 fix, audit 2026-10-20).
    // The interval for a completed attempt is anchored to submittedAt
    // (not startedAt). An unsubmitted attempt still inside its time window
    // blocks a new one; an unsubmitted but already expired attempt is
    // abandoned and does not block a retake.
    // NOTE (decision to ratify): FR-CAND-027/TEMP-08 do not state the anchor;
    // this implementation treats the interval as "since completion".
    const lastAttempt = await prisma.assessmentAttempt.findFirst({
      where: { userId, domainId },
      orderBy: { startedAt: 'desc' },
    });

    if (lastAttempt) {
      if (!lastAttempt.submittedAt) {
        const stillOpen = new Date() < lastAttempt.deadlineAt;
        if (stillOpen) {
          throw new AppError(
            'An attempt for this assessment is already in progress',
            400,
            'ATTEMPT_IN_PROGRESS'
          );
        }
        // Unsubmitted and expired → abandoned; allow a fresh attempt.
      } else {
        const intervalEnd = new Date(lastAttempt.submittedAt);
        intervalEnd.setDate(intervalEnd.getDate() + retakeIntervalDays);

        if (new Date() < intervalEnd) {
          throw new AppError(
            `Must wait ${retakeIntervalDays} days after completing the assessment before retaking it`,
            400,
            'RETAKE_INTERVAL_NOT_ELAPSED'
          );
        }
      }
    }

    // Resolve question selection strategy: 'all_active' | 'random:N'
    const allActive = await prisma.assessmentQuestion.findMany({
      where: {
        domainId,
        isActive: true,
      },
      include: {
        skill: { select: { id: true, name: true } },
      },
    });

    if (allActive.length === 0) {
      throw new AppError('No active questions available for this domain', 400, 'NO_QUESTIONS');
    }

    const selectedQuestions = allActive;
    if (selection.startsWith('random:')) {
      // 'random:N' requires persisting the per-attempt question set so that
      // submitAttempt scores the SAME selected questions. The V1 schema has no
      // per-attempt question-set table, so honoring this strategy here would
      // silently score against all active questions (BE-13). Phase 1 makes the
      // unsupported configuration loud rather than silently deviating.
      throw new AppError(
        'Question selection strategy random:N is not supported yet (requires per-attempt question persistence)',
        501,
        'SELECTION_STRATEGY_UNSUPPORTED'
      );
    }
    // Default strategy: all active questions in the domain ('all_active')

    const deadlineAt = new Date();
    deadlineAt.setMinutes(deadlineAt.getMinutes() + timeLimitMinutes);

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        userId,
        domainId,
        deadlineAt,
      },
    });

    // Return the selected questions without correct answers (NFR-DRV-001)
    const safeQuestions = selectedQuestions.map((q) => {
      const { correctOption, ...safe } = q;
      return safe;
    });

    return {
      attempt: {
        id: attempt.id,
        domainId: attempt.domainId,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
      },
      questions: safeQuestions,
      timeLimitMinutes: timeLimitMinutes,
    };
  }

  async getAttempt(attemptId: string, userId: string) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      // Phase 3: provide the student's own recorded selections so the UI can
      // rehydrate after a refresh. Per NFR-DRV-001 the rows are projected to
      // (questionId, selectedOption) only — isCorrect is never exposed here.
      include: {
        answers: {
          select: { questionId: true, selectedOption: true },
        },
      },
    });

    if (!attempt) {
      throw new AppError('Attempt not found', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const timeRemaining = Math.max(0, attempt.deadlineAt.getTime() - Date.now());

    // E2E fix (Phase 6, real-backend verification): the runner page renders
    // from this endpoint and expects the SAME envelope startAttempt returns
    // (attempt + questions + timeLimitMinutes). The flat shape previously
    // returned here carried no questions, so a refresh/direct-URL load crashed
    // the runner. Questions are projected WITHOUT the answer key (NFR-DRV-001).
    const [questions, timeLimitMinutes] = await Promise.all([
      prisma.assessmentQuestion.findMany({
        where: { domainId: attempt.domainId, isActive: true },
        include: { skill: { select: { id: true, name: true } } },
      }),
      getSetting<number>('assessmentTimeLimitMinutes'),
    ]);
    const safeQuestions = questions.map((q) => {
      const { correctOption: _answerKey, ...safe } = q;
      return safe;
    });

    return {
      attempt: {
        ...attempt,
        timeRemainingMs: timeRemaining,
        isExpired: timeRemaining === 0,
      },
      questions: safeQuestions,
      timeLimitMinutes,
    };
  }

  async submitAnswer(attemptId: string, userId: string, data: { questionId: string; selectedOption: number }) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new AppError('Attempt not found', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (attempt.submittedAt) {
      throw new AppError('Attempt already submitted', 400, 'ATTEMPT_SUBMITTED');
    }

    if (new Date() > attempt.deadlineAt) {
      throw new AppError('Assessment time has expired', 400, 'ASSESSMENT_EXPIRED');
    }

    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: data.questionId },
    });

    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    if (question.domainId !== attempt.domainId) {
      throw new AppError('Question does not belong to this assessment', 400, 'INVALID_QUESTION');
    }

    const options = question.options as string[];
    if (!options || data.selectedOption < 0 || data.selectedOption >= options.length) {
      throw new AppError('Invalid option index', 400, 'INVALID_OPTION');
    }

    const isCorrect = data.selectedOption === question.correctOption;

    // Upsert answer (allow changing answer before submit).
    // isCorrect is computed and stored server-side only.
    const answer = await prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: data.questionId,
        },
      },
      update: {
        selectedOption: data.selectedOption,
        isCorrect,
      },
      create: {
        attemptId,
        questionId: data.questionId,
        selectedOption: data.selectedOption,
        isCorrect,
      },
    });

    // BE-02 fix (audit 2026-10-20, NFR-DRV-001): the response MUST NOT
    // disclose correctness information. The previous version returned
    // { isCorrect }, which let a student brute-force answer keys one option
    // at a time. Grading stays server-side; results are disclosed only at
    // final submission (perSkillScores/resultLevel, FR-CAND-025).
    return {
      answerId: answer.id,
      questionId: answer.questionId,
      attemptId: answer.attemptId,
      selectedOption: answer.selectedOption,
      recorded: true,
    };
  }

  async submitAttempt(attemptId: string, userId: string) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
      },
    });

    if (!attempt) {
      throw new AppError('Attempt not found', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.userId !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (attempt.submittedAt) {
      throw new AppError('Attempt already submitted', 400, 'ATTEMPT_SUBMITTED');
    }

    // BE-03 fix (audit 2026-10-20, NFR-DRV-001 "SHALL enforce the assessment
    // time limit on the server"): final submissions after the deadline are
    // rejected. Attempts missed before submitting stay unsubmitted; the
    // startAttempt retake logic allows a fresh attempt after expiry.
    if (new Date() > attempt.deadlineAt) {
      throw new AppError('Assessment time has expired', 400, 'ASSESSMENT_EXPIRED');
    }

    // Calculate per-skill scores
    const questions = await prisma.assessmentQuestion.findMany({
      where: {
        domainId: attempt.domainId,
        isActive: true,
      },
      include: { skill: true },
    });

    const skillScores: Record<string, { correct: number; total: number }> = {};

    for (const question of questions) {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      const skillId = question.skillId;

      if (!skillScores[skillId]) {
        skillScores[skillId] = { correct: 0, total: 0 };
      }

      skillScores[skillId].total += 1;
      if (answer?.isCorrect) {
        skillScores[skillId].correct += 1;
      }
    }

    const perSkillScores: Record<string, number> = {};
    for (const [skillId, scores] of Object.entries(skillScores)) {
      // TEMP: Per-skill score = correct / total * 10 (per baseline §25)
      perSkillScores[skillId] = scores.total > 0
        ? Math.round((scores.correct / scores.total) * 10)
        : 0;
    }

    // Determine level using level rules
    const resultLevel = await this.determineLevel(attempt.domainId, perSkillScores);

    const updatedAttempt = await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        perSkillScores,
        resultLevel,
      },
    });

    return {
      attempt: updatedAttempt,
      perSkillScores,
      resultLevel,
    };
  }

  async listAttempts(userId: string) {
    return prisma.assessmentAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        domain: { select: { id: true, name: true } },
      },
    });
  }

  // ============================================================
  // Level Determination
  // ============================================================

  private async determineLevel(domainId: string, perSkillScores: Record<string, number>): Promise<'BEGINNER' | 'INTERMEDIATE' | 'NOT_ELIGIBLE'> {
    // Get level rules for this domain
    const levelRules = await prisma.levelRule.findMany({
      where: { domainId },
      include: {
        skillMinimums: true,
      },
      orderBy: { level: 'desc' }, // E2E fix (Phase 6): evaluate INTERMEDIATE first — the achieved level is the HIGHEST rule met; ascending order short-circuited to BEGINNER whenever both were met (masked historically because BEGINNER was unreachable).
    });

    if (levelRules.length === 0) {
      // No rules defined - default to NOT_ELIGIBLE
      return 'NOT_ELIGIBLE';
    }

    // Check each level rule
    // E2E fix (Phase 6, real-backend verification): a rule's minimum applies
    // only to skills the attempt actually ASSESSED. Question banks cover a
    // subset of a domain's skills, so skills without questions have no score;
    // treating them as 0 made BEGINNER/INTERMEDIATE unreachable whenever the
    // bank covered fewer skills than the rule lists (seed: 2 questions vs 5
    // skill minimums). Unassessed skills are neither met nor unmet.
    for (const rule of levelRules) {
      let meetsRule = true;

      for (const min of rule.skillMinimums) {
        if (!(min.skillId in perSkillScores)) continue;
        const score = perSkillScores[min.skillId] ?? 0;
        if (score < min.minimumScore) {
          meetsRule = false;
          break;
        }
      }

      if (meetsRule) {
        // For INTERMEDIATE, also need to meet BEGINNER rule (per MD AR-2)
        if (rule.level === 'INTERMEDIATE') {
          const beginnerRule = levelRules.find((r) => r.level === 'BEGINNER');
          if (beginnerRule) {
            let meetsBeginner = true;
            for (const min of beginnerRule.skillMinimums) {
              if (!(min.skillId in perSkillScores)) continue;
              const score = perSkillScores[min.skillId] ?? 0;
              if (score < min.minimumScore) {
                meetsBeginner = false;
                break;
              }
            }
            if (!meetsBeginner) {
              return 'BEGINNER';
            }
          }
        }
        return rule.level as 'BEGINNER' | 'INTERMEDIATE';
      }
    }

    return 'NOT_ELIGIBLE';
  }

  // ============================================================
  // Level Rules Management (Admin)
  // ============================================================

  async listLevelRules(domainId: string) {
    return prisma.levelRule.findMany({
      where: { domainId },
      include: {
        skillMinimums: {
          include: { skill: { select: { id: true, name: true } } },
        },
      },
      orderBy: { level: 'asc' },
    });
  }
}

export const assessmentService = new AssessmentService();