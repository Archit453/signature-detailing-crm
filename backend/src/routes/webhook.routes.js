import { Router } from 'express';
import {
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  verifyInstagramWebhook,
  handleInstagramWebhook,
} from '../controllers/webhook.controller.js';

const router = Router();

// WhatsApp Webhook Handshake & Ingestion
router.get('/whatsapp', verifyWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

// Instagram Webhook Handshake & Ingestion
router.get('/instagram', verifyInstagramWebhook);
router.post('/instagram', handleInstagramWebhook);

export default router;

