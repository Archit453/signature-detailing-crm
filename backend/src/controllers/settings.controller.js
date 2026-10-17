import { getSetting, updateSetting } from '../services/settings.service.js';
import { successResponse } from '../utils/apiResponse.js';

export async function getGeneralSettings(req, res) {
  const general = await getSetting('general');
  return successResponse(res, general);
}

export async function saveGeneralSettings(req, res) {
  const current = (await getSetting('general')) || {};
  const updated = await updateSetting('general', { ...current, ...req.body });
  return successResponse(res, updated, 'Studio profile settings saved successfully');
}

export async function getBotMessages(req, res) {
  const messages = await getSetting('bot_messages');
  return successResponse(res, messages);
}

export async function saveBotMessages(req, res) {
  const updated = await updateSetting('bot_messages', req.body);
  return successResponse(res, updated, 'Bot messages updated successfully');
}

export async function getIntegrations(req, res) {
  const integrations = await getSetting('integrations');

  // Mask sensitive tokens for safe display in UI
  const masked = {
    whatsapp: {
      phone_number_id: integrations?.whatsapp?.phone_number_id || '',
      verify_token: integrations?.whatsapp?.verify_token || 'signature_wa_verify_secret',
      has_token: Boolean(integrations?.whatsapp?.token),
      token_preview: integrations?.whatsapp?.token
        ? `${integrations.whatsapp.token.slice(0, 8)}...${integrations.whatsapp.token.slice(-4)}`
        : '',
    },
    instagram: {
      page_id: integrations?.instagram?.page_id || '',
      verify_token: integrations?.instagram?.verify_token || 'signature_ig_verify_secret',
      has_token: Boolean(integrations?.instagram?.page_access_token),
      token_preview: integrations?.instagram?.page_access_token
        ? `${integrations.instagram.page_access_token.slice(0, 8)}...${integrations.instagram.page_access_token.slice(-4)}`
        : '',
    },
  };

  return successResponse(res, masked);
}

export async function saveIntegrations(req, res) {
  const current = (await getSetting('integrations')) || {};
  const { whatsapp = {}, instagram = {} } = req.body;

  const merged = {
    whatsapp: {
      phone_number_id: whatsapp.phone_number_id !== undefined ? whatsapp.phone_number_id : current.whatsapp?.phone_number_id,
      token: whatsapp.token ? whatsapp.token : current.whatsapp?.token,
      verify_token: whatsapp.verify_token || current.whatsapp?.verify_token || 'signature_wa_verify_secret',
    },
    instagram: {
      page_id: instagram.page_id !== undefined ? instagram.page_id : current.instagram?.page_id,
      page_access_token: instagram.page_access_token ? instagram.page_access_token : current.instagram?.page_access_token,
      verify_token: instagram.verify_token || current.instagram?.verify_token || 'signature_ig_verify_secret',
    },
  };

  await updateSetting('integrations', merged);
  return successResponse(res, { updated: true }, 'Integration settings saved successfully');
}

export async function getReviewSettings(req, res) {
  const reviews = await getSetting('reviews');
  return successResponse(res, reviews);
}

export async function saveReviewSettings(req, res) {
  const current = (await getSetting('reviews')) || {};
  const updated = await updateSetting('reviews', { ...current, ...req.body });
  return successResponse(res, updated, 'Review settings saved successfully');
}

export async function pruneMessagesHandler(req, res) {
  const { days = 30 } = req.body || {};
  const { pruneOldMessages } = await import('../services/whatsapp.service.js');
  const result = await pruneOldMessages(Number(days) || 30);
  return successResponse(res, result, `Cleaned up messages older than ${days} days`);
}


