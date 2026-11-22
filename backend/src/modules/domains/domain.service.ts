// Domain Service
// Business logic for domain management

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import type { CreateDomainInput, UpdateDomainInput } from './domain.validation';

export class DomainService {
  async listActive() {
    return prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        skills: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async listAll() {
    return prisma.domain.findMany({
      orderBy: { name: 'asc' },
      include: {
        skills: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async getById(id: string) {
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        skills: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return domain;
  }

  async create(data: CreateDomainInput) {
    // Check if domain name already exists
    const existing = await prisma.domain.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AppError('Domain with this name already exists', 409, 'DOMAIN_EXISTS');
    }

    return prisma.domain.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async update(id: string, data: UpdateDomainInput) {
    const domain = await this.getById(id);

    if (data.name && data.name !== domain.name) {
      const existing = await prisma.domain.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        throw new AppError('Domain with this name already exists', 409, 'DOMAIN_EXISTS');
      }
    }

    return prisma.domain.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    });
  }

  async deactivate(id: string) {
    await this.getById(id); // existence + 404 semantics

    // Check if domain has active programs
    const activePrograms = await prisma.program.count({
      where: {
        domainId: id,
        status: { in: ['DRAFT', 'OPEN'] },
      },
    });

    if (activePrograms > 0) {
      throw new AppError(
        'Cannot deactivate domain with active programs. Archive or close programs first.',
        400,
        'DOMAIN_HAS_ACTIVE_PROGRAMS'
      );
    }

    return prisma.domain.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const domainService = new DomainService();