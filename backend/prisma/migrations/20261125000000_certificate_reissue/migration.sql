-- Certificate reissue & appreciation (2026-11-25).
--
-- The baseline declared Certificate.internshipId UNIQUE, which allowed only one
-- certificate row per internship ever. That blocked (a) reissuing a completion
-- certificate after revocation (the revoked row is retained forever, BR-034)
-- and (b) issuing an APPRECIATION certificate alongside the COMPLETION one
-- (BR-031). Replace it with a plain lookup index plus a partial unique index
-- that still guarantees at most ONE VALID certificate per internship and type.

DROP INDEX IF EXISTS "Certificate_internshipId_key";

CREATE INDEX IF NOT EXISTS "Certificate_internshipId_type_idx" ON "Certificate"("internshipId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_internshipId_type_valid_key"
  ON "Certificate"("internshipId", "type")
  WHERE "status" = 'VALID';
