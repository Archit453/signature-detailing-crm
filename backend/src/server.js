import app from './app.js';
import { config } from './config/env.js';
import { supabase, isSupabaseConfigured } from './config/supabase.js';

const server = app.listen(config.port, () => {
  console.log(`
  🚗✨ ============================================================
  Signature Detailing CRM — Standalone Server Online
  ============================================================
  • Local Address:    http://localhost:${config.port}
  • Health Check:     http://localhost:${config.port}/api/health
  • WhatsApp Webhook: http://localhost:${config.port}/api/webhooks/whatsapp
  • Instagram Webhook:http://localhost:${config.port}/api/webhooks/instagram
  • Mode:             ${config.nodeEnv}
  ============================================================
  `);
});

// Periodic Supabase Keep-Alive Ping (Runs every 12 hours to prevent 7-day inactivity pause)
if (isSupabaseConfigured) {
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const { error } = await supabase.from('studio_services').select('id').limit(1);
      if (!error) {
        console.log(`[Supabase Keep-Alive] Periodic ping successful at ${new Date().toISOString()}`);
      }
    } catch (err) {
      console.warn('[Supabase Keep-Alive Ping Failed]:', err.message);
    }
  }, TWELVE_HOURS);
}

// Process safety handlers
process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

export default app;

