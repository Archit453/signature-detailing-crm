import { Router } from 'express';
import {
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook,
  verifyDirectLeadAdWebhook,
  handleDirectLeadAdWebhook,
} from '../controllers/webhook.controller.js';

const router = Router();

// WhatsApp Webhook Handshake & Ingestion
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

// Instagram Webhook Handshake & Ingestion (Direct DMs, Comments, and Leadgen)
router.get('/instagram', verifyInstagramWebhook);
router.post('/instagram', handleInstagramWebhook);

// Dedicated Meta & External Lead Ads Endpoint (Direct forms, Lead Ads Testing Tool, In-CRM Simulator)
router.get('/ads/lead', verifyDirectLeadAdWebhook);
router.post('/ads/lead', handleDirectLeadAdWebhook);

export default router;
