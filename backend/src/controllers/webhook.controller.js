import { config } from '../config/env.js';
import { getSetting } from '../services/settings.service.js';
import { processBotMessage } from '../services/bot.service.js';
import { handleIncomingInstagramComment } from '../services/instagram.service.js';
import {
  findOrCreateWhatsAppConversation,
  logWhatsAppMessage,
  updateConversationState,
} from '../services/whatsapp.service.js';
import { findOrCreateCustomer } from '../services/customer.service.js';

/**
 * Meta WhatsApp Webhook Verification Handshake (GET)
 */
export async function verifyWhatsAppWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const integrations = await getSetting('integrations');
  const configuredVerifyToken = integrations?.whatsapp?.verify_token || config.whatsapp.verifyToken;

  // Informative status for direct browser visits
  if (!mode && !token && !challenge) {
    return res.status(200).json({
      status: 'online',
      service: 'WhatsApp Cloud API Webhook Handshake',
      verify_token: configuredVerifyToken || 'signature_wa_verify_secret',
      instructions: 'Configure this URL in Meta Developer Portal > WhatsApp > Configuration with the verify token above.'
    });
  }

  if (mode === 'subscribe' && configuredVerifyToken && token === configuredVerifyToken) {
    console.log('[WhatsApp Webhook] Verification challenge verified successfully.');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Verification failed: Invalid verify token or mode.');
  return res.status(403).json({ error: 'Forbidden: Invalid verify token' });
}

/**
 * Meta WhatsApp Webhook Event Processor (POST)
 */
export async function handleWhatsAppWebhook(req, res) {
  const body = req.body || {};

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const field = change?.field;
    const value = change?.value;

    if (!value) return;

    // -------------------------------------------------------------
    // 1. Mobile App Coexistence Detection (smb_message_echoes)
    // When staff replies from their personal phone WhatsApp Business App
    // -------------------------------------------------------------
    const isSmbEcho = field === 'smb_message_echoes' || Boolean(value.smb_message_echoes);
    if (isSmbEcho) {
      const echoMsg = value.smb_message_echoes?.[0] || value.messages?.[0];
      const customerPhone = (echoMsg?.to || echoMsg?.recipient_id || '').replace(/[^0-9]/g, '');
      const outboundText = echoMsg?.text?.body?.trim() || '';

      if (customerPhone && outboundText) {
        console.log(`[WhatsApp Coexistence Echo] Staff replied via Phone App to ${customerPhone}: "${outboundText}"`);

        // 1. Resolve customer & conversation
        const customer = await findOrCreateCustomer({ phone: customerPhone, name: 'Customer' });
        const conversation = await findOrCreateWhatsAppConversation(customer.id, customerPhone);

        // 2. Mirror outbound message in Live Inbox
        await logWhatsAppMessage({
          conversationId: conversation.id,
          direction: 'outbound',
          senderType: 'agent',
          content: outboundText,
          metaMessageId: echoMsg.id || `echo-${Date.now()}`,
        });

        // 3. Automatically pause the bot (Human Takeover)
        await updateConversationState(conversation.id, {
          bot_active: false,
          bot_paused_reason: 'coexistence_echo',
          bot_step: 'human_takeover',
        });
      }
      return;
    }

    // -------------------------------------------------------------
    // 2. Inbound Customer Inquiries
    // -------------------------------------------------------------
    const message = value.messages?.[0];
    if (message) {
      const senderPhone = message.from;
      const metaMessageId = message.id;
      const profileName = value.contacts?.[0]?.profile?.name || null;

      let rawText = '';
      let buttonPayload = null;

      if (message.type === 'interactive') {
        if (message.interactive?.type === 'button_reply') {
          buttonPayload = message.interactive.button_reply.id;
          rawText = message.interactive.button_reply.title;
        } else if (message.interactive?.type === 'list_reply') {
          buttonPayload = message.interactive.list_reply.id;
          rawText = message.interactive.list_reply.title;
        }
      } else if (message.button?.payload) {
        buttonPayload = message.button.payload;
        rawText = message.button.text;
      } else if (message.text?.body) {
        rawText = message.text.body;
      } else {
        rawText = `[${message.type || 'Media'}]`;
      }

      if (senderPhone && (rawText || buttonPayload)) {
        await processBotMessage({
          channel: 'whatsapp',
          channelUserId: senderPhone,
          rawText,
          buttonPayload,
          profileName,
          metaMessageId,
        });
      }
    }
  } catch (err) {
    console.error('WhatsApp Webhook Processing Error:', err);
  } finally {
    if (!res.headersSent) {
      res.status(200).json({ status: 'EVENT_RECEIVED' });
    }
  }
}

/**
 * Meta Instagram Webhook Verification Handshake (GET)
 */
export async function verifyInstagramWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const integrations = await getSetting('integrations');
  const configuredVerifyToken = integrations?.instagram?.verify_token || config.instagram.verifyToken;

  // Informative status for direct browser visits
  if (!mode && !token && !challenge) {
    return res.status(200).json({
      status: 'online',
      service: 'Instagram Graph API Webhook Handshake',
      verify_token: configuredVerifyToken || 'signature_ig_verify_secret',
      instructions: 'Configure this URL in Meta Developer Portal > Instagram > Webhooks with the verify token above.'
    });
  }

  if (mode === 'subscribe' && configuredVerifyToken && token === configuredVerifyToken) {
    console.log('[Instagram Webhook] Verification challenge verified successfully.');
    return res.status(200).send(challenge);
  }

  console.warn('[Instagram Webhook] Verification failed: Invalid verify token or mode.');
  return res.status(403).json({ error: 'Forbidden: Invalid verify token' });
}

/**
 * Meta Instagram Webhook Event Processor (POST)
 */
export async function handleInstagramWebhook(req, res) {
  const body = req.body || {};

  if (body.object !== 'instagram' && body.object !== 'page') {
    return res.status(200).json({ status: 'IGNORED_OBJECT' });
  }

  try {
    for (const entry of body.entry || []) {
      const entryAccountId = entry.id ? String(entry.id) : null;

      // 1. Direct Messages & Button Postbacks
      if (Array.isArray(entry.messaging)) {
        for (const event of entry.messaging) {
          const senderId = event.sender?.id;
          if (!senderId) continue;

          // Skip echo messages from own page
          if (event.message?.is_echo) continue;

          const metaMessageId = event.message?.mid || event.postback?.mid;
          let rawText = '';
          let buttonPayload = null;

          if (event.message?.quick_reply?.payload) {
            buttonPayload = event.message.quick_reply.payload;
            rawText = event.message.text || '';
          } else if (event.postback?.payload) {
            buttonPayload = event.postback.payload;
            rawText = event.postback.title || '';
          } else if (event.message?.text) {
            rawText = event.message.text;
          }

          if (rawText || buttonPayload) {
            await processBotMessage({
              channel: 'instagram',
              channelUserId: senderId,
              rawText,
              buttonPayload,
              metaMessageId,
            });
          }
        }
      }

      // 2. Post & Reel Comments via entry.changes
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if ((change.field === 'comments' || change.field === 'live_comments') && change.value) {
            await handleIncomingInstagramComment(change.value, entryAccountId);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Instagram Webhook Handler Error]', err);
  } finally {
    if (!res.headersSent) {
      res.status(200).json({ status: 'EVENT_RECEIVED' });
    }
  }
}
