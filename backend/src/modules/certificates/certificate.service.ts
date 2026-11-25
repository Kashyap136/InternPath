import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import type { Response } from 'express';
import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import { getConfig } from '../../shared/config';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify } from '../notifications/notification.service';
import { renderCertificatePdf } from './certificate-pdf';

type CertType = 'COMPLETION' | 'APPRECIATION';
type CertRow = {
  id: string;
  type: CertType;
  status: 'VALID' | 'REVOKED';
  certificateNumber: string;
  issuedAt: Date;
};
type IssueContext = {
  status: string;
  certificates: CertRow[];
  evaluation: { finalScore: number; recommendation: string } | null;
};
type Blocker = { message: string; status: number; code: string };

/** Crockford base32 (no I/L/O/U) — unambiguous in print and speech. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `IP-${year}-${suffix}`;
}

/**
 * Normalises what a verifier types: case, whitespace, dash variants, missing
 * dashes, and Crockford look-alikes in the suffix (I/L → 1, O → 0).
 */
export function normalizeCertificateNumber(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[‐-―_]/g, '-');
  const match = /^IP-?(\d{4})-?([0-9A-Z]{8})$/.exec(compact);
  if (!match) return compact;
  const suffix = match[2]!.replace(/[IL]/g, '1').replace(/O/g, '0');
  return `IP-${match[1]!}-${suffix}`;
}

/** The certificate of `type` to show for an internship: the VALID one, else the newest revoked. */
function currentOf<T extends CertRow>(rows: T[], type: CertType): T | null {
  const ofType = rows.filter((c) => c.type === type);
  return (
    ofType.find((c) => c.status === 'VALID') ??
    [...ofType].sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())[0] ??
    null
  );
}

function summary(c: CertRow | null) {
  return c
    ? { id: c.id, certificateNumber: c.certificateNumber, type: c.type, status: c.status, issuedAt: c.issuedAt }
    : null;
}

export class CertificateService {
  /** Student-facing availability indicator (no issuance — admin-only, BR-032). */
  async statusForStudent(userId: string, internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { certificates: true },
    });
    if (!internship || internship.userId !== userId) {
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }

    const completion = currentOf(internship.certificates, 'COMPLETION');
    const appreciation = currentOf(internship.certificates, 'APPRECIATION');

    return {
      data: {
        internshipStatus: internship.status,
        completionCertificate: summary(completion),
        appreciationCertificate: summary(appreciation),
        // Awaiting issuance = lifecycle COMPLETED and no VALID completion certificate.
        completionAvailable: internship.status === 'COMPLETED' && completion?.status !== 'VALID',
      },
    };
  }

  /** Summary used by the student internship detail page. */
  async summaryForInternship(internshipId: string, internshipStatus: string) {
    const rows = await prisma.certificate.findMany({ where: { internshipId } });
    const completion = currentOf(rows, 'COMPLETION');
    const appreciation = currentOf(rows, 'APPRECIATION');
    return {
      certificate: summary(completion),
      appreciationCertificate: summary(appreciation),
      certificates: rows
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
        .map((c) => summary(c)!),
      certificateAvailable: internshipStatus === 'COMPLETED' && completion?.status !== 'VALID',
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
        orderBy: [{ status: 'desc' }, { issuedAt: 'desc' }], // VALID before REVOKED
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

  async adminList(query: { type?: string; status?: string; search?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.CertificateWhereInput = {};
    if (query.type) where.type = query.type as CertType;
    if (query.status) where.status = query.status as 'VALID' | 'REVOKED';
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { certificateNumber: { contains: search, mode: 'insensitive' } },
        { internship: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
        { internship: { user: { email: { contains: search, mode: 'insensitive' } } } },
        { internship: { program: { title: { contains: search, mode: 'insensitive' } } } },
      ];
    }

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

  /** Why a certificate of `type` cannot be issued now, or null when it can. */
  private async issueBlocker(
    internship: IssueContext,
    type: CertType,
    appreciationThreshold?: number
  ): Promise<Blocker | null> {
    // FR-087 / BR-030 — live lifecycle state, backend-verified (both types).
    if (internship.status !== 'COMPLETED') {
      return {
        message: 'A certificate can only be issued for an internship in COMPLETED status',
        status: 400,
        code: 'INTERNSHIP_NOT_COMPLETED',
      };
    }
    const valid = internship.certificates.find((c) => c.type === type && c.status === 'VALID');
    if (valid) {
      return {
        message: `A valid ${type.toLowerCase()} certificate already exists (${valid.certificateNumber}); revoke it first to reissue`,
        status: 409,
        code: 'CERTIFICATE_ALREADY_EXISTS',
      };
    }
    if (type === 'COMPLETION') return null;

    // ---- APPRECIATION (BR-031) ----
    if (!internship.certificates.some((c) => c.type === 'COMPLETION' && c.status === 'VALID')) {
      return {
        message: 'An appreciation certificate requires a VALID completion certificate for this internship',
        status: 400,
        code: 'APPRECIATION_REQUIRES_VALID_COMPLETION',
      };
    }
    return this.appreciationQualificationBlocker(internship, appreciationThreshold);
  }

  /** BR-031 evaluation criteria only (independent of existing certificates). */
  private async appreciationQualificationBlocker(
    internship: IssueContext,
    appreciationThreshold?: number
  ): Promise<Blocker | null> {
    const evaluation = internship.evaluation;
    if (!evaluation) {
      return { message: 'No final evaluation exists for this internship', status: 400, code: 'EVALUATION_MISSING' };
    }
    if (evaluation.recommendation !== 'COMPLETE_WITH_APPRECIATION') {
      return {
        message: 'The mentor recommendation must be COMPLETE_WITH_APPRECIATION for an appreciation certificate',
        status: 400,
        code: 'APPRECIATION_NOT_RECOMMENDED',
      };
    }
    const threshold = appreciationThreshold ?? (await getSetting<number>('appreciationThreshold'));
    if (evaluation.finalScore < threshold) {
      return {
        message: `Final score ${evaluation.finalScore} is below the appreciation threshold (${threshold})`,
        status: 400,
        code: 'APPRECIATION_SCORE_TOO_LOW',
      };
    }
    return null;
  }

  /** FR-087/BR-030/031/032/033: admin issues (or reissues) a certificate. */
  async issue(adminId: string, internshipId: string, type: CertType, remarks?: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { evaluation: true, certificates: true },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');

    const blocker = await this.issueBlocker(internship, type);
    if (blocker) throw new AppError(blocker.message, blocker.status, blocker.code);

    // Reissue after revocation: link the new row to its revoked predecessor.
    const predecessor = currentOf(internship.certificates, type);
    const replaces = predecessor && predecessor.status === 'REVOKED' ? predecessor.certificateNumber : null;
    return this.createCertificate(adminId, internshipId, type, replaces, remarks);
  }

  async eligible() {
    const [internships, threshold] = await Promise.all([
      prisma.internship.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          status: true,
          completedAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          program: { select: { title: true, domain: { select: { name: true } } } },
          project: { select: { title: true } },
          evaluation: { select: { finalScore: true, recommendation: true } },
          certificates: {
            select: { id: true, type: true, status: true, certificateNumber: true, issuedAt: true },
          },
        },
      }),
      getSetting<number>('appreciationThreshold'),
    ]);

    const rows = [];
    for (const internship of internships) {
      const needsCompletion = !(await this.issueBlocker(internship, 'COMPLETION', threshold));
      const canIssueAppreciation = !(await this.issueBlocker(internship, 'APPRECIATION', threshold));
      const hasValidAppreciation = internship.certificates.some(
        (c) => c.type === 'APPRECIATION' && c.status === 'VALID'
      );
      // Qualifies on evaluation alone — issuable as soon as the completion one exists.
      const appreciationQualified =
        !hasValidAppreciation && !(await this.appreciationQualificationBlocker(internship, threshold));
      if (!needsCompletion && !canIssueAppreciation) continue;

      const { certificates, evaluation, ...rest } = internship;
      const completion = currentOf(certificates, 'COMPLETION');
      rows.push({
        ...rest,
        finalScore: evaluation?.finalScore ?? null,
        recommendation: evaluation?.recommendation ?? null,
        canIssueCompletion: needsCompletion,
        canIssueAppreciation,
        appreciationQualified,
        revokedCompletion:
          completion && completion.status === 'REVOKED' ? completion.certificateNumber : null,
      });
    }
    return { data: rows, meta: { total: rows.length, appreciationThreshold: threshold } };
  }

  /** Backfill: issue every missing COMPLETION certificate (and qualifying APPRECIATION ones). */
  async issuePending(adminId: string, includeAppreciation: boolean) {
    const { data } = await this.eligible();
    const issued: { internshipId: string; type: CertType; certificateNumber: string }[] = [];
    const failed: { internshipId: string; type: CertType; error: string }[] = [];

    for (const row of data) {
      const types: CertType[] = [];
      if (row.canIssueCompletion) types.push('COMPLETION');
      if (includeAppreciation && row.appreciationQualified) types.push('APPRECIATION');
      for (const type of types) {
        try {
          const cert = await this.issue(adminId, row.id, type, 'Bulk issuance of pending certificates');
          issued.push({ internshipId: row.id, type, certificateNumber: cert.certificateNumber });
        } catch (err) {
          failed.push({ internshipId: row.id, type, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    return { issued, failed };
  }

  private async createCertificate(
    adminId: string,
    internshipId: string,
    type: CertType,
    replacesCertificate: string | null,
    remarks?: string
  ) {
    // BR-033: unique, never-reused number — regenerate on the (astronomically
    // unlikely) collision. Revoked rows keep their numbers forever.
    let certificateNumber = generateCertificateNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.certificate.findUnique({ where: { certificateNumber } });
      if (!clash) break;
      certificateNumber = generateCertificateNumber();
    }

    const certificate = await prisma.certificate
      .create({
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
      })
      .catch((err: unknown) => {
        // Partial unique index: a concurrent request already issued this type.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(
            `A valid ${type.toLowerCase()} certificate was just issued for this internship`,
            409,
            'CERTIFICATE_ALREADY_EXISTS'
          );
        }
        throw err;
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

    const title =
      type === 'APPRECIATION'
        ? 'Your certificate of appreciation is ready'
        : replacesCertificate
          ? 'Your completion certificate was reissued'
          : 'Your completion certificate is ready';
    await notify(certificate.internship.userId, {
      type: 'CERTIFICATE_ISSUED',
      title,
      message:
        `Certificate ${certificateNumber} was issued for "${certificate.internship.program.title}"` +
        (replacesCertificate ? `, replacing ${replacesCertificate}.` : '.'),
      link: '/certificates',
    });

    return certificate;
  }

  async verify(rawNumber: string) {
    const certificateNumber = normalizeCertificateNumber(rawNumber);
    const certificate = await prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        internship: {
          select: {
            startDate: true,
            completedAt: true,
            user: { select: { fullName: true } },
            program: { select: { title: true, domain: { select: { name: true } } } },
            project: { select: { title: true, sourceType: true } },
          },
        },
        issuer: { select: { role: true } },
      },
    });

    if (!certificate) {
      return { found: false as const, certificateNumber };
    }

    // A revoked-then-reissued certificate points verifiers at its VALID successor.
    const successor =
      certificate.status === 'REVOKED'
        ? await prisma.certificate.findFirst({
            where: { replacesCertificate: certificate.certificateNumber, status: 'VALID' },
            select: { certificateNumber: true },
          })
        : null;

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
        revokedAt: certificate.status === 'REVOKED' ? certificate.revokedAt : null,
        revocationNote:
          certificate.status === 'REVOKED' ? 'This certificate has been revoked by InternPath administration.' : null,
        replacedBy: successor?.certificateNumber ?? null,
      },
    };
  }

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
      verifyUrl: `${getConfig().FRONTEND_URL}/verify/${encodeURIComponent(certificate.certificateNumber)}`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InternPath-Certificate-${certificate.certificateNumber}.pdf"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
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
    const cascade =
      certificate.type === 'COMPLETION'
        ? await prisma.certificate.findMany({
            where: { internshipId: certificate.internshipId, type: 'APPRECIATION', status: 'VALID' },
            select: { id: true, certificateNumber: true },
          })
        : [];

    const revokedAt = new Date();
    const updated = await prisma.$transaction([
      // Conditional on VALID so two concurrent revocations cannot both succeed.
      prisma.certificate.updateMany({
        where: { id: certificateId, status: 'VALID' },
        data: { status: 'REVOKED', revokedAt, revokedBy: adminId, revocationReason: reason },
      }),
      ...(cascade.length > 0
        ? [
            prisma.certificate.updateMany({
              where: { id: { in: cascade.map((c) => c.id) }, status: 'VALID' },
              data: {
                status: 'REVOKED',
                revokedAt,
                revokedBy: adminId,
                revocationReason: `Cascade: completion certificate ${certificate.certificateNumber} revoked — ${reason}`,
              },
            }),
          ]
        : []),
    ]);
    if (updated[0].count === 0) {
      throw new AppError('This certificate is already revoked', 409, 'ALREADY_REVOKED');
    }

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.CERTIFICATE_REVOKED,
      entityType: 'Certificate',
      entityId: certificateId,
      oldValue: { status: 'VALID' },
      newValue: { status: 'REVOKED', cascaded: cascade.map((c) => c.certificateNumber) },
      reason,
    });

    const cascadeNote =
      cascade.length > 0 ? ` The linked appreciation certificate ${cascade.map((c) => c.certificateNumber).join(', ')} was revoked with it.` : '';
    await notify(certificate.internship.userId, {
      type: 'CERTIFICATE_REVOKED',
      title: 'Certificate revoked',
      message: `Certificate ${certificate.certificateNumber} was revoked: ${reason}.${cascadeNote}`,
      link: '/certificates',
    });

    return { revoked: true, certificateNumber: certificate.certificateNumber, cascadedCertificates: cascade.length };
  }
}

export const certificateService = new CertificateService();
