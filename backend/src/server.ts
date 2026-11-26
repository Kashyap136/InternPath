// Server Entry Point
// Starts the Express HTTP server

import { config } from './shared/config';
import app from './app';
import { prisma } from './shared/prisma/client';
import { startScheduler } from './shared/scheduler';
import { applyPendingMigrations } from './shared/prisma/migrate-on-start';
import { logEmailTransportStatus } from './shared/email/mailer';

const PORT = config.PORT;

async function startServer(): Promise<void> {
  try {
    // Bring the schema up to date before serving (Render only by default).
    applyPendingMigrations();


    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start HTTP server
    // Express 5: listen errors (e.g. EADDRINUSE) are passed to the callback
    // instead of thrown — surface them explicitly so startup failures are loud.
    const server = app.listen(PORT, (listenError) => {
      if (listenError) {
        console.error('❌ Server failed to start:', listenError.message);
        void prisma.$disconnect().then(() => process.exit(1));
        return;
      }
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      startScheduler();
      void logEmailTransportStatus();
    });

    // Graceful shutdown
    const shutdown = (signal: string): void => {
      console.log(`\n📴 ${signal} received, shutting down gracefully...`);
      server.close(() => {
        void prisma.$disconnect().then(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void startServer();