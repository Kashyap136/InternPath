// Certificate Service (Sprint 5 — FR-CAND-087-092, FR-DRV-008/009, BR-CAND-030-034)
//
// Issuance rules (all backend-enforced):
//   - Only ADMIN issues/revokes (BR-CAND-032).
//   - COMPLETION: only for an internship in COMPLETED status (FR-087, BR-030).
//     Eligibility is derived from the live lifecycle state — never from a
//     frontend flag or a date.
//   - APPRECIATION (BR-031): requires a VALID completion certificate + final
//     score ≥ appreciation threshold + mentor recommendation
//     COMPLETE_WITH_APPRECIATION. **Schema constraint conflict:** the frozen
//     Prisma schema declares `Certificate.internshipId @unique`, which permits
//     only ONE certificate row per internship, while FR-DRV-008's cascade
//     implies COMPLETION and APPRECIATION coexist. Per Phase 10 §12 no schema
//     change is authorized — APPRECIATION issuance is therefore BLOCKED (400
//     with an explanatory code) and a schema-change proposal is recorded in
//     the Phase 10 report (drop field-unique, add @@unique([internshipId, type])).
//   - Number: `IP-<year>-<8 Crockford base32 chars>`, unique forever
//     (BR-033); revoked numbers are never reused (records retained, BR-034).
//   - FR-DRV-008: revoking a COMPLETION certificate cascades to the
//     APPRECIATION certificate of the same internship (implemented for when
//     the schema proposal is approved).
//   - FR-DRV-009: the PDF document is generated on request and never stored.

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify } from '../notifications/notification.service';
import { renderCertificatePdf } from './certificate-pdf';
import type { Response } from 'express';

/** Crockford base32 (no I/L/O/U) — unambiguous in print and speech. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `IP-${year}-${suffix}`;
}

export class CertificateService {
  /** Student-facing availability indicator (no issuance — admin-only, BR-032). */
  async statusForStudent(userId: string, internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { certificates: true, evaluation: { select: { finalScore: true, recommendation: true } } },
    });
    if (!internship || internship.userId !== userId) {
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }

    const completion = internship.certificates.find((c) => c.type === 'COMPLETION') ?? null;
    const appreciation = internship.certificates.find((c) => c.type === 'APPRECIATION') ?? null;

    return {
      data: {
        internshipStatus: internship.status,
        completionCertificate: completion
          ? { id: completion.id, certificateNumber: completion.certificateNumber, status: completion.status, issuedAt: completion.issuedAt }
          : null,
        appreciationCertificate: appreciation
          ? { id: appreciation.id, certificateNumber: appreciation.certificateNumber, status: appreciation.status, issuedAt: appreciation.issuedAt }
          : null,
        // Eligible = lifecycle COMPLETED and no VALID completion certificate.
        completionAvailable:
          internship.status === 'COMPLETED' && (!completion || completion.status === 'REVOKED'),
      },
    };
  }

  async listMine(userId: string, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const [rows, total] = await Promise.all([
      prisma.certificate.findMany({
        where: { internship: { userId } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          internship: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              program: { select: { title: true, domain: { select: { name: true } } } },
              project: { select: { title: true, sourceType: true } },
            },
          },
          issuer: { select: { fullName: true, role: true } },
        },
      }),
      prisma.certificate.count({ where: { internship: { userId } } }),
    ]);

    return {
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async adminList(query: { type?: string; status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          internship: {
            select: {
              id: true,
              status: true,
              user: { select: { id: true, fullName: true, email: true } },
              program: { select: { title: true, domain: { select: { name: true } } } },
              project: { select: { title: true, sourceType: true } },
            },
          },
          issuer: { select: { fullName: true, role: true } },
        },
      }),
      prisma.certificate.count({ where }),
    ]);

    return {
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** FR-087/BR-030/031/032/033: admin issues a certificate. */
  async issue(adminId: string, internshipId: string, type: 'COMPLETION' | 'APPRECIATION', remarks?: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: {
        evaluation: true,
        certificates: true,
        program: { select: { title: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');

    if (type === 'COMPLETION') {
      // FR-087 / BR-030 — live lifecycle state, backend-verified.
      if (internship.status !== 'COMPLETED') {
        throw new AppError(
          'A completion certificate can only be issued for an internship in COMPLETED status',
          400,
          'INTERNSHIP_NOT_COMPLETED'
        );
      }
      const existing = internship.certificates.find((c) => c.type === 'COMPLETION');
      if (existing) {
        if (existing.status === 'VALID') {
          throw new AppError(
            `A valid completion certificate already exists (${existing.certificateNumber}); reissue requires revocation first`,
            409,
            'CERTIFICATE_ALREADY_EXISTS'
          );
        }
        // P2-09 fix (comprehensive audit 2026-11-15): a REVOKED certificate row
        // still occupies the frozen schema's unique `internshipId` index, so
        // the previous "replacement" path always failed with a generic 409
        // "A record with this internshipId already exists". Report the real,
        // documented limitation with an explicit code until owner decision
        // OD-2 (certificate uniqueness migration) is approved.
        throw new AppError(
          'The previous certificate was revoked and a replacement cannot be issued: the frozen database schema allows only one certificate row per internship (Certificate.internshipId @unique). Reissue requires the approved uniqueness migration (owner decision OD-2).',
          409,
          'REISSUE_BLOCKED_BY_SCHEMA'
        );
      }
      return this.createCertificate(adminId, internshipId, 'COMPLETION', null, remarks);
    }

    // ---- APPRECIATION (BR-031) ----
    // Schema constraint conflict with the frozen baseline: see the module docblock.
    const completion = internship.certificates.find((c) => c.type === 'COMPLETION');
    if (!completion || completion.status !== 'VALID') {
      throw new AppError(
        'An appreciation distinction requires a VALID completion certificate for this internship',
        400,
        'APPRECIATION_REQUIRES_VALID_COMPLETION'
      );
    }
    const evaluation = internship.evaluation;
    if (!evaluation) {
      throw new AppError('No final evaluation exists for this internship', 400, 'EVALUATION_MISSING');
    }
    if (evaluation.recommendation !== 'COMPLETE_WITH_APPRECIATION') {
      throw new AppError(
        'The mentor recommendation must be COMPLETE_WITH_APPRECIATION for an appreciation distinction',
        400,
        'APPRECIATION_NOT_RECOMMENDED'
      );
    }
    const appreciationThreshold = await getSetting<number>('appreciationThreshold');
    if (evaluation.finalScore < appreciationThreshold) {
      throw new AppError(
        `Final score ${evaluation.finalScore} is below the appreciation threshold (${appreciationThreshold})`,
        400,
        'APPRECIATION_SCORE_TOO_LOW'
      );
    }

    // Frozen-schema conflict: only one certificate row per internship is possible.
    throw new AppError(
      'APPRECIATION certificates cannot be issued against the current database baseline: the frozen schema allows only one certificate per internship (Certificate.internshipId @unique), while the approved rules require a COMPLETION and an APPRECIATION certificate to coexist. A schema-change proposal is recorded in the Phase 10 report and awaits owner approval.',
      409,
      'APPRECIATION_BLOCKED_BY_SCHEMA'
    );
  }

  private async createCertificate(
    adminId: string,
    internshipId: string,
    type: 'COMPLETION' | 'APPRECIATION',
    replacesCertificate: string | null,
    remarks?: string
  ) {
    // BR-033: unique, never-reused number — regenerate on the (astronomically
    // unlikely) collision; revoked numbers are never reissued to others
    // because generation is random and replacements reference their predecessor.
    let certificateNumber = generateCertificateNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.certificate.findUnique({ where: { certificateNumber } });
      if (!clash) break;
      certificateNumber = generateCertificateNumber();
    }

    const certificate = await prisma.certificate.create({
      data: {
        certificateNumber,
        type,
        internshipId,
        issuedAt: new Date(),
        issuedBy: adminId,
        replacesCertificate,
      },
      include: {
        internship: { select: { userId: true, program: { select: { title: true } } } },
      },
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.CERTIFICATE_ISSUED,
      entityType: 'Certificate',
      entityId: certificate.id,
      newValue: {
        certificateNumber,
        type,
        internshipId,
        replacesCertificate,
        remarks: remarks ?? null,
      },
    });

    await notify(certificate.internship.userId, {
      type: 'CERTIFICATE_ISSUED',
      title: type === 'COMPLETION' ? 'Your completion certificate is ready' : 'Appreciation certificate issued',
      message: `Certificate ${certificateNumber} was issued for "${certificate.internship.program.title}".`,
      link: '/certificates',
    });

    return certificate;
  }

  /**
   * FR-091: public verification — no login. Returns only information safe to
   * disclose (FR §6.4): status, certificate number, recipient display name,
   * program/domain/project + source-type label (FR-043), issue date, issuer
   * role. Never: email, phone, profile data, scores, mentor comments, notes.
   */
  async verify(certificateNumber: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        internship: {
          select: {
            status: true,
            startDate: true,
            completedAt: true,
            user: { select: { fullName: true } },
            program: { select: { title: true, domain: { select: { name: true } } } },
            project: { select: { title: true, sourceType: true } },
          },
        },
        issuer: { select: { fullName: true, role: true } },
      },
    });

    if (!certificate) {
      return { found: false as const };
    }

    return {
      found: true as const,
      data: {
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        type: certificate.type,
        recipientName: certificate.internship.user.fullName,
        programTitle: certificate.internship.program.title,
        domainName: certificate.internship.program.domain.name,
        projectTitle: certificate.internship.project?.title ?? null,
        projectSourceType: certificate.internship.project?.sourceType ?? null, // FR-043 label
        internshipStart: certificate.internship.startDate,
        internshipCompletion: certificate.internship.completedAt,
        issuedAt: certificate.issuedAt,
        issuedByRole: certificate.issuer.role,
        revocationNote:
          certificate.status === 'REVOKED' ? 'This certificate has been revoked by InternPath administration.' : null,
      },
    };
  }

  /**
   * FR-090: a student downloads only their own certificates.
   * Admins may download any. FR-DRV-009: rendered on demand, never stored.
   */
  async downloadFor(userId: string, role: string, certificateId: string, res: Response) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        internship: {
          include: {
            user: { select: { fullName: true } },
            program: { select: { title: true, domain: { select: { name: true } } } },
            project: { select: { title: true, sourceType: true } },
          },
        },
        issuer: { select: { fullName: true, role: true } },
      },
    });
    if (!certificate) throw new AppError('Certificate not found', 404, 'CERTIFICATE_NOT_FOUND');

    if (role !== 'ADMIN' && certificate.internship.userId !== userId) {
      // 404 — do not disclose other students' certificates
      throw new AppError('Certificate not found', 404, 'CERTIFICATE_NOT_FOUND');
    }

    const pdf = await renderCertificatePdf({
      certificateNumber: certificate.certificateNumber,
      type: certificate.type,
      status: certificate.status,
      recipientName: certificate.internship.user.fullName,
      programTitle: certificate.internship.program.title,
      domainName: certificate.internship.program.domain.name,
      projectTitle: certificate.internship.project?.title ?? null,
      projectSourceType: certificate.internship.project?.sourceType ?? null,
      internshipStart: certificate.internship.startDate,
      internshipCompletion: certificate.internship.completedAt,
      issuedAt: certificate.issuedAt,
      issuerName: certificate.issuer.fullName,
      issuerRole: certificate.issuer.role,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InternPath-Certificate-${certificate.certificateNumber}.pdf"`
    );
    res.send(pdf);
  }

  /** FR-092 / BR-032/034 / FR-DRV-008: revoke with mandatory reason; records retained. */
  async revoke(adminId: string, certificateId: string, reason: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: { internship: { select: { id: true, userId: true } } },
    });
    if (!certificate) throw new AppError('Certificate not found', 404, 'CERTIFICATE_NOT_FOUND');
    if (certificate.status === 'REVOKED') {
      throw new AppError('This certificate is already revoked', 409, 'ALREADY_REVOKED');
    }

    // FR-DRV-008: revoking COMPLETION cascades to the internship's APPRECIATION.
    const cascadeIds =
      certificate.type === 'COMPLETION'
        ? (
            await prisma.certificate.findMany({
              where: { internshipId: certificate.internshipId, type: 'APPRECIATION', status: 'VALID' },
              select: { id: true },
            })
          ).map((c) => c.id)
        : [];

    const revokedAt = new Date();
    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: certificateId },
        data: { status: 'REVOKED', revokedAt, revokedBy: adminId, revocationReason: reason },
      }),
      ...(cascadeIds.length > 0
        ? [
            prisma.certificate.updateMany({
              where: { id: { in: cascadeIds } },
              data: { status: 'REVOKED', revokedAt, revokedBy: adminId, revocationReason: `Cascade: completion certificate ${certificate.certificateNumber} revoked — ${reason}` },
            }),
          ]
        : []),
    ]);

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.CERTIFICATE_REVOKED,
      entityType: 'Certificate',
      entityId: certificateId,
      oldValue: { status: 'VALID' },
      newValue: { status: 'REVOKED', cascaded: cascadeIds },
      reason,
    });

    await notify(certificate.internship.userId, {
      type: 'CERTIFICATE_REVOKED',
      title: 'Certificate revoked',
      message: `Certificate ${certificate.certificateNumber} was revoked: ${reason}`,
      link: '/certificates',
    });

    return { revoked: true, certificateNumber: certificate.certificateNumber, cascadedCertificates: cascadeIds.length };
  }
}

export const certificateService = new CertificateService();
