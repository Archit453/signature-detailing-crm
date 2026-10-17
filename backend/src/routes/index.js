import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { config } from '../config/env.js';
import webhookRoutes from './webhook.routes.js';
import inboxRoutes from './inbox.routes.js';
import leadRoutes from './lead.routes.js';
import serviceRoutes from './service.routes.js';
import settingsRoutes from './settings.routes.js';

const router = Router();

// Simple Studio Authentication Endpoint
router.post('/auth/verify', (req, res) => {
  const { passcode } = req.body || {};
  const expectedPasscode = config.auth?.passcode || 'signature2025';
  if (!passcode || String(passcode).trim() !== String(expectedPasscode).trim()) {
    return res.status(401).json({ success: false, message: 'Invalid studio passcode' });
  }
  return res.status(200).json({ success: true, token: 'signature_authenticated' });
});

// Health check & Supabase keep-alive ping endpoint (Used by Vercel cron & uptime monitors)
router.get('/health', async (req, res) => {
  let dbStatus = 'unconfigured';
  let latencyMs = null;

  if (isSupabaseConfigured) {
    const start = Date.now();
    try {
      const { error } = await supabase.from('studio_services').select('id').limit(1);
      latencyMs = Date.now() - start;
      dbStatus = error ? `error: ${error.message}` : 'connected';
    } catch (err) {
      dbStatus = `unreachable: ${err.message}`;
    }
  }

  // Diagnostic on WhatsApp integration
  let whatsappStatus = 'unconfigured';
  const rawPhoneId = config.whatsapp?.phoneNumberId;
  const rawToken = config.whatsapp?.token;
  const isDummyPhone = !rawPhoneId || rawPhoneId === '100236173166560' || rawPhoneId === '123456789';

  if (isDummyPhone) {
    whatsappStatus = 'misconfigured_dummy_id';
  } else if (!rawToken || rawToken.length < 20) {
    whatsappStatus = 'missing_token';
  } else {
    whatsappStatus = 'configured';
  }

  // If ?check_meta=true is requested, ping Meta Graph API to verify token freshness
  let metaApiCheck = null;
  if (req.query.check_meta === 'true' && whatsappStatus === 'configured') {
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${rawPhoneId}?access_token=${rawToken}`);
      const metaData = await metaRes.json();
      if (metaRes.ok && metaData.id) {
        metaApiCheck = { valid: true, id: metaData.id, verified_name: metaData.verified_name || 'Signature Detailing' };
      } else {
        metaApiCheck = { valid: false, error: metaData.error?.message || 'Meta validation failed' };
      }
    } catch (e) {
      metaApiCheck = { valid: false, error: e.message };
    }
  }

  res.status(200).json({
    status: 'online',
    system: 'Signature Detailing CRM API',
    database: dbStatus,
    dbLatencyMs: latencyMs,
    whatsapp: {
      status: whatsappStatus,
      phone_id: rawPhoneId || 'none',
      ...(metaApiCheck ? { meta_check: metaApiCheck } : {})
    },
    uptime: process.uptime(),
    keepAlive: 'active',
    timestamp: new Date().toISOString(),
  });
});

// Mount domain routes
router.use('/webhooks', webhookRoutes);
router.use('/inbox', inboxRoutes);
router.use('/leads', leadRoutes);
router.use('/services', serviceRoutes);
router.use('/settings', settingsRoutes);

export default router;
