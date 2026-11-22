// Express Application Setup
// Configures middleware, routes, and error handling

import type { Express } from 'express';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './shared/config';
import { createRateLimiter, helmetMiddleware, corsMiddleware, securityHeaders } from './shared/middleware/security';
import { errorHandler, asyncHandler } from './shared/middleware/errorHandler';
import { prisma } from './shared/prisma/client';
import { initializeDefaultSettings } from './shared/utils/settings';
import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profiles/profiles.routes';
// BE-04 fix (audit 2026-10-20): module routers now export separate public and
// admin routers; admin surfaces are mounted under the dedicated /api/admin/*
// namespace and doubled module paths are gone.
import domainRoutes, { adminDomainRouter } from './modules/domains/domain.routes';
import skillRoutes, {
  domainsSkillsRouter,
  domainsSkillsAdminRouter,
  skillAdminRouter,
} from './modules/skills/skill.routes';
import programRoutes, { adminProgramRouter } from './modules/programs/program.routes';
import assessmentRoutes, {
  domainQuestionsAdminRouter,
  questionsAdminRouter,
  levelRulesAdminRouter,
} from './modules/assessment/assessment.routes';
import applicationRoutes, { adminApplicationRouter } from './modules/applications/application.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import projectRoutes, { adminRouter as projectAdminRouter } from './modules/projects/project.routes';
import { internshipRoutes, mentorRouter, internshipAdminRouter } from './modules/internships/internship.routes';
import {
  certificateRoutes,
  certificateAdminRouter,
  certificateVerifyRouter,
} from './modules/certificates/certificate.routes';
import reportRoutes, { reportAdminRouter } from './modules/reports/report.routes';
import resourceRoutes from './modules/resources/resource.routes';
import adminPlatformRoutes from './modules/admin/admin.routes';

const app: Express = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(securityHeaders);

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.COOKIE_SECRET));

// Request logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(createRateLimiter());

// Health check endpoint (no auth, no rate limit skip handled in limiter)
app.get('/health', asyncHandler(async (_req, res) => {
  // Check database connectivity
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
}));

// API Routes — public surfaces
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/domains', domainRoutes);            // GET /, GET /:id
app.use('/api/domains', domainsSkillsRouter);     // GET /:domainId/skills
app.use('/api/skills', skillRoutes);              // GET /:id
app.use('/api/programs', programRoutes);          // GET /, GET /:id
app.use('/api/assessment', assessmentRoutes);     // student attempt flows
app.use('/api/applications', applicationRoutes);  // student lifecycle
app.use('/api/notifications', notificationRoutes); // in-app notification centre (FR-099)
app.use('/api/projects', projectRoutes);          // repository + authoring (Sprint 3)
app.use('/api/internships', internshipRoutes);    // student internship surface (Sprint 3/4)
app.use('/api/mentor', mentorRouter);             // mentor workflows (SRS §18 scope)
app.use('/api/certificates', certificateRoutes);  // own certificates (FR-090)
app.use('/api/reports', reportRoutes);            // report filing (FR-094)
app.use('/api/resources', resourceRoutes);        // learning resources (FR-101)
app.use('/api/verify', certificateVerifyRouter);  // PUBLIC certificate verification (FR-091)

// API Routes — admin surfaces (single documented /api/admin/* namespace)
app.use('/api/admin', adminPlatformRoutes);                 // settings, dashboard, audit view
app.use('/api/admin/domains', adminDomainRouter);          // domains CRUD
app.use('/api/admin/domains', domainsSkillsAdminRouter);   // POST /:domainId/skills
app.use('/api/admin/domains', domainQuestionsAdminRouter); // questions on a domain
app.use('/api/admin/domains', levelRulesAdminRouter);      // level rules read
app.use('/api/admin/skills', skillAdminRouter);            // PUT/DELETE /:id
app.use('/api/admin/programs', adminProgramRouter);        // program management
app.use('/api/admin/questions', questionsAdminRouter);     // question bank /:id
app.use('/api/admin/applications', adminApplicationRouter); // review + decision
app.use('/api/admin/projects', projectAdminRouter);        // project lifecycle (Sprint 3)
app.use('/api/admin/internships', internshipAdminRouter);  // assignment + lifecycle (Sprint 3/4)
app.use('/api/admin/certificates', certificateAdminRouter); // issue/revoke (Sprint 5)
app.use('/api/admin/reports', reportAdminRouter);          // report handling (Sprint 6)

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Route not found',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Initialize default settings on startup (non-blocking)
if (config.NODE_ENV !== 'test') {
  // We need a system actor ID for initialization
  // In production, this would be a dedicated system user
  const SYSTEM_ACTOR_ID = 'system:seed';
  initializeDefaultSettings(SYSTEM_ACTOR_ID).catch((err) => {
    console.error('Failed to initialize default settings:', err);
  });
}

export default app;