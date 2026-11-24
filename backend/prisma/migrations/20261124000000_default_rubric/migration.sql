-- Default evaluation rubric (2026-11-24).
--
-- The final evaluation, internship completion and certificates all require an
-- ACTIVE rubric, but no migration, seed or admin endpoint ever created one, so
-- every fresh installation was blocked at the evaluation step. This inserts a
-- version-1 rubric ONLY when no rubric exists at all, so it never touches an
-- installation where one was created by hand. Weights total 100 (required by
-- evaluation.service.ts); each criterion is scored 0-10, giving a 0-100 final
-- score compared against completionThreshold / appreciationThreshold.

DO $$
DECLARE
  rubric_id TEXT := 'cdefaultrubricv1';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Rubric") THEN
    INSERT INTO "Rubric" ("id", "version", "isActive", "createdAt")
    VALUES (rubric_id, 1, TRUE, CURRENT_TIMESTAMP);

    INSERT INTO "RubricCriterion" ("id", "rubricId", "name", "weight", "order", "createdAt", "updatedAt") VALUES
      ('cdefaultrubricv1crit1', rubric_id, 'Technical quality of the deliverables', 30, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('cdefaultrubricv1crit2', rubric_id, 'Problem solving and independence', 20, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('cdefaultrubricv1crit3', rubric_id, 'Delivery against milestones and deadlines', 20, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('cdefaultrubricv1crit4', rubric_id, 'Code quality, testing and documentation', 15, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('cdefaultrubricv1crit5', rubric_id, 'Communication and response to feedback', 15, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END $$;
