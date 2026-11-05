import { Router } from 'express';
import {
  getGeneralSettings,
  saveGeneralSettings,
  getBotMessages,
  saveBotMessages,
  getIntegrations,
  saveIntegrations,
  getReviewSettings,
  saveReviewSettings,
  pruneMessagesHandler,
  subscribeLeadAdsWebhook,
  diagnoseInstagramIntegration,
} from '../controllers/settings.controller.js';

const router = Router();

router.get('/general', getGeneralSettings);
router.post('/general', saveGeneralSettings);
router.get('/bot-messages', getBotMessages);
router.post('/bot-messages', saveBotMessages);
router.get('/integrations', getIntegrations);
router.post('/integrations', saveIntegrations);
router.post('/instagram/subscribe-lead-ads', subscribeLeadAdsWebhook);
router.get('/instagram/diagnose', diagnoseInstagramIntegration);
router.get('/reviews', getReviewSettings);
router.post('/reviews', saveReviewSettings);
router.post('/database/prune', pruneMessagesHandler);

export default router;

