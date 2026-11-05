import { config } from '../config/env.js';
import { getSetting } from '../services/settings.service.js';
import { processBotMessage, findOrCreateInstagramConversation } from '../services/bot.service.js';
import { handleIncomingInstagramComment } from '../services/instagram.service.js';
import { resolveMetaLeadGen, processIncomingAdLead } from '../services/leadAd.service.js';
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
  const configuredVerifyToken = (config.nodeEnv === 'test' ? config.whatsapp.verifyToken : null) || integrations?.whatsapp?.verify_token || config.whatsapp.verifyToken;

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
  const configuredVerifyToken = (config.nodeEnv === 'test' ? config.instagram.verifyToken : null) || integrations?.instagram?.verify_token || config.instagram.verifyToken;

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

      // 1. Collect Direct Messages & Button Postbacks from entry.messaging & entry.changes
      const messagingEvents = [];
      if (Array.isArray(entry.messaging)) {
        messagingEvents.push(...entry.messaging);
      }
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'messages' || change.field === 'messaging') {
            if (Array.isArray(change.value?.messaging)) {
              messagingEvents.push(...change.value.messaging);
            } else if (change.value && (change.value.sender || change.value.message)) {
              messagingEvents.push(change.value);
            }
          }
        }
      }

      if (messagingEvents.length > 0) {
        for (const event of messagingEvents) {
          const senderId = event.sender?.id;
          if (!senderId) continue;

          // Skip echo messages from own page
          // Mirror outbound reply from studio staff in Instagram app & pause bot (Human Takeover)
          if (event.message?.is_echo) {
            const customerId = event.recipient?.id;
            const outboundText = event.message?.text || '[Media]';
            if (customerId) {
              const customer = await findOrCreateCustomer({ instagramId: customerId, name: 'Instagram Customer' });
              const conversation = await findOrCreateInstagramConversation(customer.id, customerId);
              await logWhatsAppMessage({
                conversationId: conversation.id,
                direction: 'outbound',
                senderType: 'agent',
                content: outboundText,
                metaMessageId: event.message?.mid || `echo-ig-${Date.now()}`,
              });
              await updateConversationState(conversation.id, {
                bot_active: false,
                bot_paused_reason: 'instagram_echo',
                bot_step: 'human_takeover',
              });
            }
            continue;
          }

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
              accountId: entryAccountId,
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

          // 3. Meta Instagram Lead Ad Instant Forms via entry.changes
          if (change.field === 'leadgen' && change.value) {
            const leadgenId = change.value.leadgen_id || change.value.id;
            if (leadgenId) {
              console.log(`[Meta Lead Ads Webhook] Incoming leadgen event: ${leadgenId} (Page ${entryAccountId || change.value.page_id})`);
              try {
                const leadDetails = await resolveMetaLeadGen(leadgenId);
                await processIncomingAdLead({
                  ...leadDetails,
                  form_id: change.value.form_id,
                  ad_id: change.value.ad_id,
                  adgroup_id: change.value.adgroup_id,
                  campaign_id: change.value.campaign_id,
                  page_id: entryAccountId || change.value.page_id,
                });
              } catch (leadErr) {
                console.error('[Meta Lead Ads Resolution Error]', leadErr);
              }
            }
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

/**
 * Direct & Simulator Lead Ad Webhook Handshake (GET)
 */
export async function verifyDirectLeadAdWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const integrations = await getSetting('integrations');
  const configuredVerifyToken = integrations?.instagram?.verify_token || config.instagram?.verifyToken || 'signature_ig_verify_secret';

  if (mode === 'subscribe' && token === configuredVerifyToken) {
    console.log('[Lead Ad Webhook] Verification challenge verified successfully.');
    return res.status(200).send(challenge);
  }

  return res.status(200).json({
    status: 'ACTIVE',
    endpoint: 'Instagram & Meta Lead Ads Webhook',
    message: 'Ready to receive direct and Meta Instant Form leads',
  });
}

/**
 * Direct & Simulator Lead Ad Webhook Handler (POST)
 * Supports Meta Lead Ads Testing Tool, In-CRM Simulator, Zapier, or landing page ad forms
 */
export async function handleDirectLeadAdWebhook(req, res) {
  try {
    const body = req.body || {};

    // Case 1: Standard Meta Webhook payload wrapped in { object, entry: [ { changes: [ { field: 'leadgen' } ] } ] }
    if (body.object && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen' && change.value) {
              const leadgenId = change.value.leadgen_id || change.value.id;
              if (leadgenId) {
                const leadDetails = await resolveMetaLeadGen(leadgenId);
                const result = await processIncomingAdLead({
                  ...leadDetails,
                  form_id: change.value.form_id,
                  ad_id: change.value.ad_id,
                });
                return res.status(200).json({ status: 'LEAD_PROCESSED', result });
              }
            }
          }
        }
      }
      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    }

    // Case 2: Direct or Simulated JSON payload (e.g. { name, phone, service, vehicle, email })
    const result = await processIncomingAdLead(body);
    return res.status(200).json({
      status: 'LEAD_CAPTURED',
      success: true,
      leadId: result.lead?.id,
      lead: result.lead,
      prospectNotified: result.prospectNotified,
    });
  } catch (err) {
    console.error('[Direct Lead Ad Handler Error]', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to process ad lead',
    });
  }
}
