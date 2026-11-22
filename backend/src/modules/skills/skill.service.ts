// Skill Service
// Business logic for skill management

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import type { CreateSkillInput, UpdateSkillInput } from './skill.validation';

export class SkillService {
  async listByDomain(domainId: string) {
    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return prisma.skill.findMany({
      where: { domainId },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: { domain: true },
    });

    if (!skill) {
      throw new AppError('Skill not found', 404, 'SKILL_NOT_FOUND');
    }

    return skill;
  }

  async create(domainId: string, data: CreateSkillInput) {
    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    // Check if skill name already exists in this domain
    const existing = await prisma.skill.findUnique({
      where: {
        domainId_name: {
          domainId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new AppError('Skill with this name already exists in this domain', 409, 'SKILL_EXISTS');
    }

    return prisma.skill.create({
      data: {
        name: data.name,
        domainId,
      },
    });
  }

  async update(id: string, data: UpdateSkillInput) {
    const skill = await this.getById(id);

    if (data.name && data.name !== skill.name) {
      const existing = await prisma.skill.findUnique({
        where: {
          domainId_name: {
            domainId: skill.domainId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new AppError('Skill with this name already exists in this domain', 409, 'SKILL_EXISTS');
      }
    }

    return prisma.skill.update({
      where: { id },
      data: {
        name: data.name,
      },
    });
  }

  async delete(id: string) {
    await this.getById(id); // existence + 404 semantics

    // Check if skill is used in level rules
    const levelRuleUsage = await prisma.levelRuleSkillMinimum.count({
      where: { skillId: id },
    });

    if (levelRuleUsage > 0) {
      throw new AppError(
        'Cannot delete skill used in level rules. Remove from level rules first.',
        400,
        'SKILL_IN_USE'
      );
    }

    // Check if skill is used in assessment questions
    const questionUsage = await prisma.assessmentQuestion.count({
      where: { skillId: id },
    });

    if (questionUsage > 0) {
      throw new AppError(
        'Cannot delete skill used in assessment questions. Remove from questions first.',
        400,
        'SKILL_IN_USE'
      );
    }

    return prisma.skill.delete({
      where: { id },
    });
  }
}

export const skillService = new SkillService();