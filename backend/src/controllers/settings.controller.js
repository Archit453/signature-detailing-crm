import { getSetting, updateSetting } from '../services/settings.service.js';
import { successResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { config } from '../config/env.js';

let cachedIgMeta = null;
let cachedIgMetaToken = '';
let cachedIgMetaExpiry = 0;

let cachedWaMeta = null;
let cachedWaMetaToken = '';
let cachedWaMetaExpiry = 0;

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
  const now = Date.now();

  const igToken = integrations?.instagram?.page_access_token || '';
  const igPageId = integrations?.instagram?.page_id || '';
  let igMeta = { is_connected: false, account_name: null, error: null };

  if (igToken) {
    if (cachedIgMeta && cachedIgMetaToken === igToken && cachedIgMetaExpiry > now) {
      igMeta = cachedIgMeta;
    } else {
      try {
        const isIGToken = igToken.startsWith('IGAA') || igToken.startsWith('IGA');
        const url = isIGToken
          ? `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(igToken)}`
          : `https://graph.facebook.com/v21.0/${igPageId && /^\d+$/.test(igPageId) ? igPageId : 'me'}?fields=id,name,username&access_token=${encodeURIComponent(igToken)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const metaRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const metaData = await metaRes.json();

        if (metaRes.ok && (metaData.username || metaData.name || metaData.id)) {
          igMeta = {
            is_connected: true,
            account_name: metaData.username ? metaData.username.replace(/^@/, '') : (metaData.name || 'Instagram Account'),
            meta_id: metaData.id,
            error: null,
          };
        } else {
          igMeta = {
            is_connected: false,
            account_name: null,
            error: metaData.error?.message || 'Token verification failed',
          };
        }
      } catch (err) {
        igMeta = {
          is_connected: false,
          account_name: null,
          error: err.name === 'AbortError' ? 'Meta API timeout' : err.message,
        };
      }
      cachedIgMeta = igMeta;
      cachedIgMetaToken = igToken;
      cachedIgMetaExpiry = now + 5 * 60 * 1000; // Cache 5 min
    }
  }

  const waToken = integrations?.whatsapp?.token || '';
  const waPhoneId = integrations?.whatsapp?.phone_number_id || '';
  let waMeta = { is_connected: false, account_name: null, error: null };

  if (waToken && waPhoneId && /^\d+$/.test(waPhoneId) && waPhoneId !== '100236173166560') {
    if (cachedWaMeta && cachedWaMetaToken === waToken && cachedWaMetaExpiry > now) {
      waMeta = cachedWaMeta;
    } else {
      try {
        const url = `https://graph.facebook.com/v21.0/${waPhoneId}?fields=id,verified_name,display_phone_number&access_token=${encodeURIComponent(waToken)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const metaRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const metaData = await metaRes.json();

        if (metaRes.ok && metaData.id) {
          waMeta = {
            is_connected: true,
            account_name: metaData.verified_name || metaData.display_phone_number || 'WhatsApp Business',
            meta_id: metaData.id,
            error: null,
          };
        } else {
          waMeta = {
            is_connected: false,
            account_name: null,
            error: metaData.error?.message || 'WhatsApp token verification failed',
          };
        }
      } catch (err) {
        waMeta = {
          is_connected: false,
          account_name: null,
          error: err.name === 'AbortError' ? 'Meta API timeout' : err.message,
        };
      }
      cachedWaMeta = waMeta;
      cachedWaMetaToken = waToken;
      cachedWaMetaExpiry = now + 5 * 60 * 1000;
    }
  }

  // Mask sensitive tokens for safe display in UI
  const masked = {
    whatsapp: {
      phone_number_id: integrations?.whatsapp?.phone_number_id || '',
      verify_token: integrations?.whatsapp?.verify_token || '',
      has_token: Boolean(integrations?.whatsapp?.token),
      token_preview: integrations?.whatsapp?.token
        ? `${integrations.whatsapp.token.slice(0, 8)}...${integrations.whatsapp.token.slice(-4)}`
        : '',
      is_connected: waMeta.is_connected,
      account_name: waMeta.account_name,
      error: waMeta.error,
    },
    instagram: {
      page_id: integrations?.instagram?.page_id || '',
      verify_token: integrations?.instagram?.verify_token || '',
      has_token: Boolean(integrations?.instagram?.page_access_token),
      token_preview: integrations?.instagram?.page_access_token
        ? `${integrations.instagram.page_access_token.slice(0, 8)}...${integrations.instagram.page_access_token.slice(-4)}`
        : '',
      is_connected: igMeta.is_connected,
      account_name: igMeta.account_name,
      error: igMeta.error,
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
      verify_token: whatsapp.verify_token || current.whatsapp?.verify_token || '',
    },
    instagram: {
      page_id: instagram.page_id !== undefined ? instagram.page_id : current.instagram?.page_id,
      page_access_token: instagram.page_access_token ? instagram.page_access_token : current.instagram?.page_access_token,
      verify_token: instagram.verify_token || current.instagram?.verify_token || '',
    },
  };

  // Invalidate cache on token update
  cachedIgMetaExpiry = 0;
  cachedWaMetaExpiry = 0;

  await updateSetting('integrations', merged);

  // Auto-subscribe webhook fields (messages, comments, messaging_postbacks, leadgen) on Meta
  if (merged.instagram?.page_access_token) {
    (async () => {
      try {
        const token = merged.instagram.page_access_token;
        const isIG = token.startsWith('IGAA') || token.startsWith('IGA');
        const url = isIG
          ? `https://graph.instagram.com/v21.0/me/subscribed_apps?subscribed_fields=messages,comments,messaging_postbacks,leadgen&access_token=${encodeURIComponent(token)}`
          : `https://graph.facebook.com/v21.0/me/subscribed_apps?subscribed_fields=messages,comments,messaging_postbacks,leadgen&access_token=${encodeURIComponent(token)}`;
        await fetch(url, { method: 'POST' });
        console.log('[Auto-Subscribe Webhook] Successfully subscribed messages, comments, messaging_postbacks, and leadgen on Meta');
      } catch (subErr) {
        console.warn('[Auto-Subscribe Webhook Notice]', subErr.message);
      }
    })().catch(() => {});
  }

  return successResponse(res, { updated: true }, 'Integration settings saved successfully');
}

/**
 * Triggers on-demand subscription of the Page to Meta Lead Ads Webhook
 */
export async function subscribeLeadAdsWebhook(req, res) {
  const integrations = (await getSetting('integrations')) || {};
  const token = integrations.instagram?.page_access_token || config.instagram?.pageAccessToken;

  if (!token) {
    throw new ApiError(400, 'No Instagram/Facebook Page Access Token found. Please save your Access Token first in Settings.');
  }

  try {
    const isIG = token.startsWith('IGAA') || token.startsWith('IGA');
    const fields = 'leadgen,messages,comments,messaging_postbacks';
    const baseUrl = isIG ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
    const url = `${baseUrl}/me/subscribed_apps?subscribed_fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const metaRes = await fetch(url, { method: 'POST', signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await metaRes.json();
    if (metaRes.ok && (data.success || data.subscribed)) {
      return successResponse(res, {
        success: true,
        subscribed_fields: ['leadgen', 'messages', 'comments', 'messaging_postbacks'],
        meta_response: data,
      }, 'Successfully subscribed Page to Lead Ads & Messaging Webhooks on Meta!');
    } else {
      const errMsg = data.error?.message || 'Meta API rejected subscription request';
      return successResponse(res, {
        success: false,
        error: errMsg,
        error_code: data.error?.code,
        error_subcode: data.error?.error_subcode,
        tip: 'Ensure your Meta App has the "leads_retrieval" and "pages_manage_ads" permissions granted in Meta App Review / Permissions.',
      }, errMsg);
    }
  } catch (err) {
    throw new ApiError(500, `Failed to communicate with Meta Graph API: ${err.message}`);
  }
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
