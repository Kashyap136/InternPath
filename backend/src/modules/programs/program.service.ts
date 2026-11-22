// Program Service
// Business logic for program management

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import type { CreateProgramInput, UpdateProgramInput, ChangeProgramStatusInput, ListProgramsQuery } from './program.validation';

export class ProgramService {
  async list(query: ListProgramsQuery) {
    const { domainId, status, level, durationWeeks, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (domainId) where.domainId = domainId;
    if (status) where.status = status;
    if (level) where.level = level;
    if (durationWeeks) where.durationWeeks = durationWeeks;

    // For public listing, only show non-DRAFT programs
    // Admin can see all via separate endpoint

    const [data, total] = await Promise.all([
      prisma.program.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          domain: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.program.count({ where }),
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

  async listAll(query: ListProgramsQuery) {
    const { domainId, status, level, durationWeeks, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (domainId) where.domainId = domainId;
    if (status) where.status = status;
    if (level) where.level = level;
    if (durationWeeks) where.durationWeeks = durationWeeks;

    const [data, total] = await Promise.all([
      prisma.program.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          domain: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.program.count({ where }),
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

  async getById(id: string) {
    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        domain: true,
        _count: { select: { applications: true } },
      },
    });

    if (!program) {
      throw new AppError('Program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    return program;
  }

  async getPublicById(id: string) {
    const program = await this.getById(id);

    // BE-11 fix (audit 2026-10-20): DRAFT programs are unpublished and must
    // not be reachable through public endpoints; admins use getById.
    if (program.status === 'DRAFT') {
      throw new AppError('Program not found', 404, 'PROGRAM_NOT_FOUND');
    }

    // Don't expose internal fields for public view
    return {
      ...program,
      applicationsCount: program._count.applications,
    };
  }

  async create(data: CreateProgramInput) {
    // Verify domain exists and is active
    const domain = await prisma.domain.findUnique({
      where: { id: data.domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    if (!domain.isActive) {
      throw new AppError('Cannot create program in inactive domain', 400, 'DOMAIN_INACTIVE');
    }

    // Validate dates
    const applicationDeadline = new Date(data.applicationDeadline);
    const startDate = new Date(data.startDate);

    if (applicationDeadline >= startDate) {
      throw new AppError('Application deadline must be before start date', 400, 'INVALID_DATES');
    }

    if (applicationDeadline <= new Date()) {
      throw new AppError('Application deadline must be in the future', 400, 'DEADLINE_PAST');
    }

    // Set requiredLevel to level if not provided (TEMP per baseline)
    const requiredLevel = data.requiredLevel ?? data.level;

    return prisma.program.create({
      data: {
        title: data.title,
        domainId: data.domainId,
        durationWeeks: data.durationWeeks,
        level: data.level,
        requiredLevel,
        seats: data.seats,
        applicationDeadline,
        startDate,
        status: 'DRAFT',
      },
      include: { domain: true },
    });
  }

  async update(id: string, data: UpdateProgramInput) {
    const program = await this.getById(id);

    // Only allow updates in DRAFT status (per baseline)
    if (program.status !== 'DRAFT') {
      throw new AppError('Program can only be updated in DRAFT status', 400, 'PROGRAM_NOT_DRAFT');
    }

    // Verify domain if changing
    if (data.domainId && data.domainId !== program.domainId) {
      const domain = await prisma.domain.findUnique({
        where: { id: data.domainId },
      });

      if (!domain) {
        throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
      }

      if (!domain.isActive) {
        throw new AppError('Cannot move program to inactive domain', 400, 'DOMAIN_INACTIVE');
      }
    }

    // Validate dates if changing
    const applicationDeadline = data.applicationDeadline ? new Date(data.applicationDeadline) : program.applicationDeadline;
    const startDate = data.startDate ? new Date(data.startDate) : program.startDate;

    if (applicationDeadline >= startDate) {
      throw new AppError('Application deadline must be before start date', 400, 'INVALID_DATES');
    }

    const requiredLevel = data.requiredLevel ?? data.level ?? program.requiredLevel;

    return prisma.program.update({
      where: { id },
      data: {
        title: data.title,
        domainId: data.domainId,
        durationWeeks: data.durationWeeks,
        level: data.level,
        requiredLevel,
        seats: data.seats,
        applicationDeadline,
        startDate,
      },
      include: { domain: true },
    });
  }

  async changeStatus(id: string, newStatus: ChangeProgramStatusInput['status']) {
    const program = await this.getById(id);

    // Validate transition
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['OPEN', 'ARCHIVED'],
      OPEN: ['CLOSED', 'ARCHIVED'],
      CLOSED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    if (!validTransitions[program.status]?.includes(newStatus)) {
      throw new AppError(`Cannot transition from ${program.status} to ${newStatus}`, 400, 'INVALID_STATUS_TRANSITION');
    }

    // Additional checks for OPEN transition
    if (newStatus === 'OPEN') {
      if (program.seats <= 0) {
        throw new AppError('Program must have at least 1 seat to open', 400, 'INSUFFICIENT_SEATS');
      }

      if (program.applicationDeadline <= new Date()) {
        throw new AppError('Cannot open program with past application deadline', 400, 'DEADLINE_PAST');
      }
    }

    return prisma.program.update({
      where: { id },
      data: { status: newStatus },
      include: { domain: true },
    });
  }

  async archive(id: string) {
    return this.changeStatus(id, 'ARCHIVED');
  }
}

export const programService = new ProgramService();