import { getSetting, getActiveServices } from './settings.service.js';
import { BOT_MESSAGES, formatMessage } from '../config/botMessages.js';
import { findOrCreateCustomer } from './customer.service.js';
import { createLead, hasOpenLead } from './lead.service.js';
import {
  sendMetaWhatsAppMessage,
  findOrCreateWhatsAppConversation,
  logWhatsAppMessage,
  logBotTurnMessages,
  updateConversationState as baseUpdateConversationState,
} from './whatsapp.service.js';
import { sendInstagramOutboundMessage } from './instagram.service.js';
import { validateAndFormatPhone } from '../utils/phoneValidator.js';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import {
  getStudioWebsite,
  getStudioName,
  getStudioAddress,
  getStudioPhone,
} from '../config/studio.config.js';

let inMemoryIgConversations = [];
const igConversationCache = new Map();
const IG_CONV_CACHE_TTL = 3600000; // 1 hour TTL
const fallbackTracker = new Map(); // tracks consecutive unhandled queries per channelUserId

export async function updateConversationState(conversationId, updates) {
  for (const entry of igConversationCache.values()) {
    if (entry?.conversation?.id === conversationId) {
      Object.assign(entry.conversation, updates);
    }
  }
  const inMemIg = inMemoryIgConversations.find((c) => c.id === conversationId);
  if (inMemIg) {
    Object.assign(inMemIg, updates);
  }
  return await baseUpdateConversationState(conversationId, updates);
}

/**
 * Generates the transparent bot disclaimer (short & crisp)
 */
export function getBotDisclaimer() {
  return BOT_MESSAGES.bot_disclaimer;
}

/**
 * Appends bot disclosure to outbound customer messages
 */
export function withBotDisclaimer(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.includes('Signature Bot') || text.includes('automated bot')) return text;
  return `${text}${getBotDisclaimer()}`;
}

/**
 * Finds or initializes an Instagram conversation in Supabase or memory
 */
export async function findOrCreateInstagramConversation(customerId, igsid, customerName = null) {
  const cleanId = String(igsid).replace(/^ig_/, '').trim();
  const cached = igConversationCache.get(cleanId);
  if (cached && cached.expiresAt > Date.now()) {
    if (customerName && (!cached.conversation.customer_name || cached.conversation.customer_name === 'Instagram User' || cached.conversation.customer_name === 'Instagram Customer')) {
      cached.conversation.customer_name = customerName;
      if (isSupabaseConfigured && cached.conversation.id) {
        supabase.from('conversations').update({ customer_name: customerName }).eq('id', cached.conversation.id).then(() => {}, () => {});
      }
    }
    return cached.conversation;
  }

  if (!isSupabaseConfigured) {
    let conv = inMemoryIgConversations.find((c) => c.channel === 'instagram' && c.channel_user_id === cleanId);
    if (!conv) {
      conv = {
        id: `conv-ig-${cleanId}`,
        customer_id: customerId,
        customer_name: customerName || 'Instagram User',
        channel: 'instagram',
        channel_user_id: cleanId,
        bot_active: true,
        bot_paused_reason: null,
        bot_step: 'awaiting_service',
        last_message_preview: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date().toISOString(),
      };
      inMemoryIgConversations.push(conv);
    } else if (customerName && (!conv.customer_name || conv.customer_name === 'Instagram User' || conv.customer_name === 'Instagram Customer')) {
      conv.customer_name = customerName;
    }
    igConversationCache.set(cleanId, { conversation: conv, expiresAt: Date.now() + IG_CONV_CACHE_TTL });
    return conv;
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('channel', 'instagram')
    .eq('channel_user_id', cleanId)
    .maybeSingle();

  if (existing) {
    if (customerName && (!existing.customer_name || existing.customer_name === 'Instagram User' || existing.customer_name === 'Instagram Customer')) {
      existing.customer_name = customerName;
      await supabase.from('conversations').update({ customer_name: customerName }).eq('id', existing.id);
    }
    igConversationCache.set(cleanId, { conversation: existing, expiresAt: Date.now() + IG_CONV_CACHE_TTL });
    return existing;
  }

  const insertData = {
    customer_name: customerName || 'Instagram User',
    channel: 'instagram',
    channel_user_id: cleanId,
    bot_active: true,
    bot_step: 'awaiting_service',
  };

  const { data: created, error } = await supabase
    .from('conversations')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  if (created) igConversationCache.set(cleanId, { conversation: created, expiresAt: Date.now() + IG_CONV_CACHE_TTL });
  return created;
}

const NAME_STOP_WORDS = new Set([
  'hi', 'hello', 'helloo', 'hellooo', 'hey', 'heyy', 'hola', 'namaste',
  'good morning', 'good afternoon', 'good evening', 'gm', 'ge', 'gn',
  'ok', 'okay', 'okk', 'yes', 'no', 'yeah', 'yep', 'nope', 'sure', 'fine', 'k',
  'thanks', 'thank you', 'thx', 'ty', 'welcome',
  'price', 'cost', 'rates', 'rate', 'pricing', 'kitna', 'charges', 'quote',
  'location', 'address', 'where', 'service', 'services', 'package', 'packages',
  'details', 'info', 'information', 'help', 'call', 'call me',
  'bot', 'human', 'agent', 'executive', 'admin', 'test', 'demo',
  're-enter', 'reenter', 're-enter name', 'reenter name', 're enter', 're enter name',
  'change', 'change name', 'name', 'full name', 'my name', 'my full name',
  'yes correct', 'yes, correct', 'correct'
]);

/**
 * Parses customer name heuristics from text input
 */
export function extractCustomerName(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return 'Customer';
  let clean = rawInput
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F\uFE0E\s]+/u, '')
    .replace(/(\+?[0-9][0-9\s-]{8,14}[0-9])/g, '')
    .replace(/\+?[0-9\s-]{4,}/g, '')
    .replace(/[0-9]/g, '')
    .replace(/[,:/\-()_!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  clean = clean.replace(/^(my full name is|my name is|full name is|name is|i am|i'm|iam|this is|it's|its|myself|call me|name:?)\s+/i, '').trim();
  clean = clean.replace(/^(?:hey|hi|hello|helloo|hola|namaste)\s+/i, '');
  clean = clean.replace(/^(?:my\s+)?(?:full\s+)?name\s*(?:is|:)?\s+/i, '');
  clean = clean.replace(/^(?:i\s*am|i'm|iam|this\s+is|it\'s|myself|call\s+me)\s+/i, '');
  clean = clean.trim();

  const lower = clean.toLowerCase();
  if (!clean || NAME_STOP_WORDS.has(lower) || lower === 'my name' || lower === 'name' || lower === 'full name') {
    return 'Customer';
  }

  if (clean.length >= 2 && /[a-zA-Z\u0900-\u097F]/.test(clean)) {
    return clean
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Customer';
}

/**
 * Builds WhatsApp interactive list payload dynamically from active services
 */
export async function buildWhatsAppServicesList(providedServices = null) {
  const services = providedServices || await getActiveServices();
  const rows = services.map((srv) => {
    const cleanName = (srv.name || '').replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F\uFE0E\s]+/u, '').trim();
    let title = cleanName;
    if (title.length > 24) {
      const match = title.match(/\(([^)]+)\)/);
      if (match && match[1].length <= 24) {
        title = match[1];
      } else {
        title = title.slice(0, 24);
      }
    }
    return {
      id: `SERVICE_${srv.short_code}`,
      title: title || (srv.name || '').slice(0, 24),
      description: (srv.tagline || srv.description || '').slice(0, 72),
    };
  });

  return {
    button: 'View Packages 🚗',
    sections: [
      {
        title: 'Signature Detailing Packages',
        rows,
      },
    ],
  };
}

/**
 * Format button title strictly <= 20 chars for Meta Generic Template
 */
function formatButtonTitle(name) {
  let t = (name || '').trim();
  t = t.replace(/\s*\([^)]*\)/, '')
       .replace(/\s+Package$/i, '')
       .replace(/\s+Detailing$/i, ' Detail')
       .trim();
  return t.slice(0, 20);
}

/**
 * Builds 3-by-3 Instagram Carousel Cards exactly matching the studio design
 */
export async function buildInstagramServicesCarousel(providedServices = null) {
  const services = providedServices || await getActiveServices();
  const elements = [];
  const chunkSize = 3;
  const totalCards = Math.ceil(services.length / chunkSize);

  for (let i = 0; i < services.length; i += chunkSize) {
    const chunk = services.slice(i, i + chunkSize);
    const cardIndex = Math.floor(i / chunkSize) + 1;

    let subtitle = 'Select a premium service package:';
    if (cardIndex === 1) {
      subtitle = 'Exterior Paint Protection & Correction';
    } else if (cardIndex === 2) {
      subtitle = 'Interior Deep Clean & Full Makeover';
    }

    const buttons = chunk.map((srv) => ({
      type: 'postback',
      title: formatButtonTitle(srv.name),
      payload: `SERVICE_${srv.short_code}`,
    }));

    if (buttons.length < 3) {
      const websiteUrl = getStudioWebsite();
      buttons.push({
        type: 'web_url',
        title: '🌐 View Website',
        url: websiteUrl,
      });
    }

    elements.push({
      title: `🚗 Detailing Packages (${cardIndex}/${totalCards})`,
      subtitle: subtitle.slice(0, 80),
      buttons,
    });
  }

  return elements;
}

export async function buildInstagramServicesMenu() {
  const services = await getActiveServices();
  return {
    text: 'Here are our premium detailing packages 🚗✨',
    quickReplies: services.slice(0, 10).map((srv) => ({
      content_type: 'text',
      title: formatButtonTitle(srv.name),
      payload: `SERVICE_${srv.short_code}`,
    })),
  };
}

export function formatFriendlyMessageText(input, services = []) {
  if (!input || typeof input !== 'string') return input;
  if (input.startsWith('SERVICE_')) {
    const code = input.replace('SERVICE_', '');
    const matched = (services || []).find((s) => s.short_code === code || s.id === code);
    if (matched) return `✨ Selected: ${matched.name}`;
    const friendlyCode = code.charAt(0).toUpperCase() + code.slice(1);
    return `✨ Selected: ${friendlyCode}`;
  }
  switch (input) {
    case 'ACTION_SERVICES':
      return '🚗 Viewed Detailing Packages';
    case 'ACTION_LOCATION':
      return '📍 Asked for Studio Location';
    case 'ACTION_WEBSITE':
      return '🌐 Visited Studio Website';
    case 'ACTION_TALK_HUMAN':
      return '👤 Requested Specialist Callback';
    case 'PHONE_CHANGE':
      return '📱 Requested Phone Number Change';
    case 'START_FLOW':
      return '👋 Started Detailing Inquiry';
    default:
      return input;
  }
}

/**
 * Main Qualification Bot Engine (Ultra-Fast Sub-Second Architecture)
 */
export async function processBotMessage({
  channel = 'whatsapp',
  channelUserId,
  rawText,
  buttonPayload = null,
  profileName = null,
  metaMessageId = null,
  accountId = null,
}) {
  const cleanInput = (buttonPayload || rawText || '').trim();
  const lowerInput = cleanInput.toLowerCase();

  // Phone check: Is channelUserId a valid phone number or an opaque ID?
  const isOpaqueId = String(channelUserId).startsWith('ig_') || channel === 'instagram';
  const userPhoneCheck = isOpaqueId ? { isValid: false, cleanPhone: null } : validateAndFormatPhone(channelUserId);
  const hasDetectedPhone = !isOpaqueId && userPhoneCheck.isValid;

  // 1. Ultra-fast parallel pre-fetch: Loads settings & resolves customer concurrently
  const [botConfigRaw, activeServices, customer] = await Promise.all([
    getSetting('bot_messages'),
    getActiveServices(),
    findOrCreateCustomer({
      name: profileName || (channel === 'whatsapp' ? 'WhatsApp Customer' : 'Instagram Customer'),
      phone: hasDetectedPhone ? userPhoneCheck.cleanPhone : null,
      instagramId: channel === 'instagram' ? channelUserId : null,
    }),
  ]);
  const botConfig = botConfigRaw || {};
  const displayInput = formatFriendlyMessageText(cleanInput, activeServices);

  const conversation = channel === 'whatsapp'
    ? await findOrCreateWhatsAppConversation(customer.id, channelUserId)
    : await findOrCreateInstagramConversation(customer.id, channelUserId, profileName);

  // Manual Bot Pause Check (only silences if manually toggled off in CRM)
  if (conversation.bot_active === false && conversation.bot_paused_reason === 'manual_toggle') {
    const isResetIntent = ['hi', 'hello', 'hey', 'start', 'menu', 'reset', 'restart', 'bot'].includes(lowerInput);
    if (isResetIntent) {
      console.log(`[Bot Resumed] Customer ${channelUserId} sent reset keyword. Reactivating bot.`);
      fallbackTracker.delete(channelUserId);
      conversation.bot_active = true;
      conversation.bot_step = 'awaiting_service';
      conversation.bot_paused_reason = null;
      conversation.fallback_count = 0;
      if (isSupabaseConfigured && conversation.id) {
        supabase.from('conversations').update({
          bot_active: true,
          bot_step: 'awaiting_service',
          bot_paused_reason: null,
        }).eq('id', conversation.id).then(() => {}, () => {});
      }
    } else {
      console.log(`[Bot Silenced] Conversation ${conversation.id} is manually paused. Skipping automated bot reply.`);
      await logWhatsAppMessage({
        conversationId: conversation.id,
        direction: 'inbound',
        senderType: 'customer',
        messageType: buttonPayload ? 'button_reply' : 'text',
        content: displayInput,
        metaMessageId,
      });
      return { handled: true, botPaused: true };
    }
  }

  // Edge Case 1: Explicit Request to Speak with a Human / Staff Member
  const HUMAN_KEYWORDS = [
    'human', 'agent', 'executive', 'person', 'real person', 'talk to person',
    'talk to human', 'speak to someone', 'call me', 'talk to someone',
    'talk to owner', 'manager', 'speak with someone', 'representative',
    'help me', 'customer care', 'support', 'staff', 'owner'
  ];
  const wantsHuman = cleanInput === 'ACTION_TALK_HUMAN' ||
    HUMAN_KEYWORDS.some((kw) => lowerInput === kw || (kw.length >= 5 && lowerInput.includes(kw)));

  if (wantsHuman) {
    const studioConfig = (await getSetting('general')) || {};
    const studioName = studioConfig.studio_name || getStudioName();
    const address = studioConfig.address || getStudioAddress();
    const phone = studioConfig.phone || getStudioPhone();
    const websiteUrl = studioConfig.website_url || getStudioWebsite();
    const mapsUrl = studioConfig.google_maps_link || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7';

    const handoverMsg = formatMessage('human_handover', {
      studioName,
      address,
      phone,
      studioPhone: phone,
      websiteUrl,
      mapsUrl,
    });

    const closingButtons = [
      { type: 'web_url', title: '🌐 Visit Website', url: websiteUrl },
      { type: 'web_url', title: '📍 Google Maps', url: mapsUrl },
    ];

    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, handoverMsg)
      : sendInstagramOutboundMessage(channelUserId, handoverMsg, { buttons: closingButtons });

    Object.assign(conversation, {
      bot_active: true,
      bot_step: 'human_takeover',
      bot_paused_reason: null,
      fallback_count: 0,
    });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: handoverMsg },
      conversationUpdates: {
        bot_active: true,
        bot_step: 'human_takeover',
        bot_paused_reason: null,
      },
    });

    // Notify studio owner / staff on WhatsApp about the human takeover request
    const ownerPhone = studioConfig.phone || config.studio?.ownerPhone || '917008457284';
    if (ownerPhone && ownerPhone !== channelUserId) {
      const ownerAlertText = `🔔 *Staff Attention Needed!*\n\nCustomer *${customer?.name || channelUserId}* on ${channel.toUpperCase()} requested a human agent.\n\n💬 Message: "${cleanInput}"\n👉 Open CRM Inbox to reply.`;
      sendMetaWhatsAppMessage(ownerPhone, ownerAlertText).catch(() => {});
    }

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'human_takeover', botPaused: false };
  }

  // Quick Action: Studio Website
  if (cleanInput === 'ACTION_WEBSITE' || lowerInput === 'website' || lowerInput.includes('studio website')) {
    const websiteUrl = getStudioWebsite();
    const websiteMsg =
      `🌐 *Signature Detailing Official Website*\n\nExplore our detailing packages, paint protection films (PPF), ceramic coatings, and studio gallery:\n👉 ${websiteUrl}\n\nFeel free to choose an option below:`;
    const navButtons = [
      { id: 'ACTION_LOCATION', title: BOT_MESSAGES.btn_studio_location },
    ];
    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, websiteMsg, { buttons: navButtons })
      : sendInstagramOutboundMessage(channelUserId, websiteMsg, { buttons: navButtons });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: websiteMsg },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, action: 'website' };
  }

  // Quick Action: Studio Location
  if (cleanInput === 'ACTION_LOCATION' || lowerInput === 'location' || lowerInput.includes('studio location')) {
    const studioConfig = (await getSetting('general')) || {};
    const studioName = studioConfig.studio_name || getStudioName();
    const address = studioConfig.address || getStudioAddress();
    const phone = studioConfig.phone || getStudioPhone();
    const websiteUrl = studioConfig.website_url || getStudioWebsite();
    const mapsUrl = studioConfig.google_maps_link || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7';

    let locationMsg = formatMessage('studio_location', {
      studioName,
      address,
      phone,
      studioPhone: phone,
      websiteUrl,
      mapsUrl,
    });

    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, locationMsg)
      : sendInstagramOutboundMessage(channelUserId, locationMsg);

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: locationMsg },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, action: 'location' };
  }

  // =========================================================================
  // ACTION: CHANGE PHONE NUMBER
  // =========================================================================
  const isChangePhoneAction =
    cleanInput === 'PHONE_CHANGE' ||
    ['change phone number', 'change phone', 'change number', 'alternate number', 'edit phone', 'edit number'].includes(lowerInput) ||
    lowerInput.startsWith('change phone') ||
    lowerInput.startsWith('change number');

  if (isChangePhoneAction) {
    const askNewPhone = 'Please share your 10-digit mobile number so our detailing specialist can reach out:';
    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, askNewPhone)
      : sendInstagramOutboundMessage(channelUserId, askNewPhone);

    Object.assign(conversation, { bot_step: 'awaiting_phone_update' });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: askNewPhone },
      conversationUpdates: { bot_step: 'awaiting_phone_update' },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'awaiting_phone_update' };
  }

  // =========================================================================
  // STEP: AWAITING PHONE UPDATE
  // =========================================================================
  if (conversation.bot_step === 'awaiting_phone_update') {
    const phoneValidation = validateAndFormatPhone(cleanInput);
    if (phoneValidation.isValid) {
      const formattedNewPhone = phoneValidation.cleanPhone.startsWith('+')
        ? phoneValidation.cleanPhone
        : `+${phoneValidation.cleanPhone}`;

      // Update customer & latest lead in DB
      if (isSupabaseConfigured) {
        try {
          if (customer?.id) {
            await supabase.from('customers').update({ phone: formattedNewPhone }).eq('id', customer.id);
          }
          const cleanOldDigits = channelUserId.replace(/\D/g, '').slice(-10);
          await supabase
            .from('leads')
            .update({ customer_phone: formattedNewPhone })
            .ilike('customer_phone', `%${cleanOldDigits}%`)
            .order('created_at', { ascending: false })
            .limit(1);
        } catch (dbErr) {
          console.warn('[Phone Update DB Error]', dbErr.message);
        }
      }

      const confirmMsg =
        `Got it! ✅ We've updated your contact number to ${formattedNewPhone}.\n\n` +
        `Our detailing team will call you on this number to confirm your booking.`;

      const navButtons = [
        { id: 'ACTION_LOCATION', title: '📍 Studio Location' },
      ];

      const sendPromise = channel === 'whatsapp'
        ? sendMetaWhatsAppMessage(channelUserId, confirmMsg, { buttons: navButtons })
        : sendInstagramOutboundMessage(channelUserId, confirmMsg, { buttons: navButtons });

      Object.assign(conversation, { bot_step: 'completed' });

      const dbPromise = logBotTurnMessages({
        conversationId: conversation.id,
        inbound: { content: displayInput, metaMessageId },
        outbound: { content: confirmMsg },
        conversationUpdates: { bot_step: 'completed' },
      });

      await Promise.all([sendPromise, dbPromise]);
      return { handled: true, step: 'completed', updatedPhone: formattedNewPhone };
    }

    // Invalid phone number
    const invalidText = BOT_MESSAGES.phone_invalid;
    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, invalidText)
      : sendInstagramOutboundMessage(channelUserId, invalidText);

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: invalidText },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'awaiting_phone_update', invalid: true };
  }

  // =========================================================================
  // POST-COMPLETION HANDLER: Customer already booked -> Say bot disclaimer, NEVER ask for service again!
  // Prevents duplicate leads and re-prompting.
  // =========================================================================
  if (conversation.bot_step === 'completed') {
    const isGreeting =
      ['hi', 'hello', 'hey', 'start', 'menu', 'reset', 'restart', 'namaste', 'helli', 'helo'].includes(lowerInput) ||
      ['hi', 'hello', 'hey'].some((g) => lowerInput.startsWith(g));

    if (isGreeting) {
      const activeLeadExists = await hasOpenLead({
        customerId: customer?.id,
        phone: customer?.phone || channelUserId,
      });

      // If lead was deleted from CRM (or no active lead exists), reset conversation and show Welcome Menu!
      if (!activeLeadExists) {
        conversation.bot_step = 'awaiting_service';
      }
    }

    if (conversation.bot_step === 'completed') {
      const studioPhone = getStudioPhone();
      const botNotice = formatMessage('already_booked', { studioPhone });
      const quickActions = [
        { id: 'PHONE_CHANGE', title: BOT_MESSAGES.btn_change_phone },
      ];

      const sendPromise = channel === 'whatsapp'
        ? sendMetaWhatsAppMessage(channelUserId, botNotice, { buttons: quickActions })
        : sendInstagramOutboundMessage(channelUserId, botNotice, { buttons: quickActions });

      const dbPromise = logBotTurnMessages({
        conversationId: conversation.id,
        inbound: { content: displayInput, metaMessageId },
        outbound: { content: botNotice },
      });

      await Promise.all([sendPromise, dbPromise]);
      return { handled: true, step: 'completed', botContactNotice: true };
    }
  }

  // Quick Action: View Packages
  if (cleanInput === 'ACTION_SERVICES' || lowerInput === 'services' || lowerInput === 'view packages' || lowerInput.includes('view packages')) {
    const welcomeText = 'Here are our premium detailing services 🚗✨\n\nTap to select a package:';
    const sendPromise = channel === 'whatsapp'
      ? buildWhatsAppServicesList(activeServices).then((listPayload) => sendMetaWhatsAppMessage(channelUserId, welcomeText, { list: listPayload }))
      : buildInstagramServicesCarousel(activeServices).then((carouselElements) => sendInstagramOutboundMessage(channelUserId, welcomeText, { elements: carouselElements }));

    const nextStep = 'awaiting_service';
    const nextBotActive = true;
    const nextPauseReason = null;

    Object.assign(conversation, {
      bot_step: nextStep,
      bot_active: nextBotActive,
      bot_paused_reason: nextPauseReason,
    });
    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: welcomeText },
      conversationUpdates: {
        bot_step: nextStep,
        bot_active: nextBotActive,
        bot_paused_reason: nextPauseReason,
      },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: nextStep, botPaused: false };
  }

  // Check if customer selected a service (via button payload, short code, or name match)
  let selectedService = null;
  if (cleanInput.startsWith('SERVICE_')) {
    const code = cleanInput.replace('SERVICE_', '');
    selectedService = activeServices.find((s) => s.short_code === code);
  } else if (/^[1-9]$/.test(cleanInput)) {
    const index = parseInt(cleanInput, 10) - 1;
    if (activeServices[index]) {
      selectedService = activeServices[index];
    }
  } else {
    selectedService = activeServices.find(
      (s) => s.short_code.toLowerCase() === lowerInput || s.name.toLowerCase().includes(lowerInput)
    );
  }

  const isGreetingOrReset =
    ['hi', 'hello', 'hey', 'start', 'menu', 'reset', 'restart'].includes(lowerInput);

  // =========================================================================
  // STEP 1: SERVICE MENU SELECTION
  // =========================================================================
  if (!selectedService && (isGreetingOrReset || !conversation.bot_step)) {
    const welcomeText = botConfig.welcome_text || BOT_MESSAGES.welcome;

    const sendPromise = channel === 'whatsapp'
      ? buildWhatsAppServicesList(activeServices).then((listPayload) => sendMetaWhatsAppMessage(channelUserId, welcomeText, { list: listPayload }))
      : buildInstagramServicesCarousel(activeServices).then((carouselElements) => sendInstagramOutboundMessage(channelUserId, welcomeText, { elements: carouselElements }));

    const nextStep = 'awaiting_service';
    const nextBotActive = true;
    const nextPauseReason = null;

    Object.assign(conversation, {
      bot_step: nextStep,
      bot_active: nextBotActive,
      bot_paused_reason: nextPauseReason,
    });
    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: welcomeText },
      conversationUpdates: {
        bot_step: nextStep,
        bot_active: nextBotActive,
        bot_paused_reason: nextPauseReason,
      },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: nextStep, botPaused: false };
  }

  // =========================================================================
  // STEP 2: SERVICE SELECTED -> PROMPT FOR NAME / VEHICLE & PHONE
  // =========================================================================
  if (selectedService) {
    const targetService = selectedService.name;
    const hasKnownName = profileName && profileName !== 'Customer' && profileName !== 'WhatsApp Customer' && profileName !== 'Instagram Customer' && profileName !== 'Instagram User';
    const candidateName = hasKnownName
      ? extractCustomerName(profileName)
      : (customer.name && customer.name !== 'Customer' && customer.name !== 'WhatsApp Customer' && customer.name !== 'Instagram Customer' && customer.name !== 'Instagram User' ? extractCustomerName(customer.name) : null);

    // If channel does not provide a verified phone number (e.g. Instagram):
    if (!hasDetectedPhone) {
      if (!candidateName || candidateName === 'Customer') {
        const askNameMsg = `Selected: *${targetService}* ✨\n\nMay I know your full name to proceed with your booking?`;
        const sendPromise = channel === 'whatsapp'
          ? sendMetaWhatsAppMessage(channelUserId, askNameMsg)
          : sendInstagramOutboundMessage(channelUserId, askNameMsg);

        Object.assign(conversation, {
          bot_step: 'awaiting_name',
          pending_service: targetService,
          pending_name: null,
        });

        const dbPromise = logBotTurnMessages({
          conversationId: conversation.id,
          inbound: { content: displayInput, metaMessageId },
          outbound: { content: askNameMsg },
          conversationUpdates: {
            bot_step: 'awaiting_name',
            pending_service: targetService,
            pending_name: null,
          },
        });

        await Promise.all([sendPromise, dbPromise]);
        return { handled: true, step: 'awaiting_name', service: targetService };
      }

      // If name is already known (e.g. resolved from Instagram profile)
      const askPhoneMsg = `Hi ${candidateName}! 👋 Selected: *${targetService}* ✨\n\nWhich car or bike do you drive? And please share your 10-digit mobile number to confirm your booking:`;
      const sendPromise = channel === 'whatsapp'
        ? sendMetaWhatsAppMessage(channelUserId, askPhoneMsg)
        : sendInstagramOutboundMessage(channelUserId, askPhoneMsg);

      Object.assign(conversation, {
        bot_step: 'awaiting_phone_input',
        pending_service: targetService,
        pending_name: candidateName,
      });

      const dbPromise = logBotTurnMessages({
        conversationId: conversation.id,
        inbound: { content: displayInput, metaMessageId },
        outbound: { content: askPhoneMsg },
        conversationUpdates: {
          bot_step: 'awaiting_phone_input',
          pending_service: targetService,
          pending_name: candidateName,
        },
      });

      await Promise.all([sendPromise, dbPromise]);
      return { handled: true, step: 'awaiting_phone_input', service: targetService, name: candidateName };
    }

    // DIRECT 1-TAP FLOW: Phone detected (WhatsApp native user flow)
    const finalName = candidateName || 'Customer';
    const finalPhone = userPhoneCheck.cleanPhone || channelUserId;

    return await completeLeadCapture({
      conversation,
      channel,
      channelUserId,
      finalName,
      finalPhone,
      serviceName: targetService,
      botConfig,
      inboundInput: cleanInput,
      metaMessageId,
    });
  }

  // =========================================================================
  // STEP 2B: AWAITING NAME
  // =========================================================================
  if (conversation.bot_step === 'awaiting_name') {
    const serviceName = conversation.pending_service || 'Signature Detailing';
    const extracted = extractCustomerName(cleanInput);
    const finalName = extracted !== 'Customer' ? extracted : cleanInput.trim().slice(0, 40);

    conversation.pending_name = finalName;
    conversation.customer_name = finalName;
    if (isSupabaseConfigured && conversation.id) {
      supabase.from('conversations').update({ customer_name: finalName }).eq('id', conversation.id).then(() => {}, () => {});
    }

    const askVehicleAndPhone = `Nice to connect with you, ${finalName}! 🚗\n\nWhich car or bike do you drive? And please share your 10-digit mobile number to confirm your booking:`;
    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, askVehicleAndPhone)
      : sendInstagramOutboundMessage(channelUserId, askVehicleAndPhone);

    Object.assign(conversation, {
      bot_step: 'awaiting_phone_input',
      pending_name: finalName,
      pending_service: serviceName,
    });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: askVehicleAndPhone },
      conversationUpdates: {
        bot_step: 'awaiting_phone_input',
        pending_name: finalName,
        pending_service: serviceName,
        customer_name: finalName,
      },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'awaiting_phone_input', name: finalName, service: serviceName };
  }

  // =========================================================================
  // STEP 3: PHONE CONFIRMATION / NUMBER INPUT
  // =========================================================================
  if (conversation.bot_step === 'awaiting_phone' || conversation.bot_step === 'awaiting_phone_input') {
    const candidateName = conversation.pending_name || customer.name || 'Customer';
    const serviceName = conversation.pending_service || 'Signature Detailing';

    // Case A: User confirmed detected phone number ("✅ Yes, Correct", "yes", "correct")
    const isPhoneConfirmed =
      cleanInput === 'PHONE_CONFIRMED' ||
      ['yes', 'correct', 'yep', 'yeah', 'ha', 'haan', 'right', 'true', 'yes correct', 'yes, correct'].includes(lowerInput) ||
      lowerInput.startsWith('yes');

    if (isPhoneConfirmed && hasDetectedPhone) {
      const finalName = candidateName;
      const finalPhone = userPhoneCheck.cleanPhone || channelUserId;

      return await completeLeadCapture({
        conversation,
        channel,
        channelUserId,
        finalName,
        finalPhone,
        serviceName,
        botConfig,
        inboundInput: cleanInput,
        metaMessageId,
      });
    }

    // Case B: User requested alternate number ("✏️ Alternate Number", "change", "alternate")
    const isChangeRequested =
      cleanInput === 'PHONE_CHANGE' ||
      ['change', 'alternate', 'no', 'different'].some((w) => lowerInput.includes(w));

    if (isChangeRequested) {
      const askNewPhone = 'Please share your 10-digit mobile number:';
      const sendPromise = channel === 'whatsapp'
        ? sendMetaWhatsAppMessage(channelUserId, askNewPhone)
        : sendInstagramOutboundMessage(channelUserId, askNewPhone);

      Object.assign(conversation, { bot_step: 'awaiting_phone_input' });

      const dbPromise = logBotTurnMessages({
        conversationId: conversation.id,
        inbound: { content: displayInput, metaMessageId },
        outbound: { content: askNewPhone },
        conversationUpdates: { bot_step: 'awaiting_phone_input' },
      });

      await Promise.all([sendPromise, dbPromise]);
      return { handled: true, step: 'awaiting_phone_input' };
    }

    // Case C: User typed a phone number (e.g. "Sure! My number is 9820112345" or "9820112345")
    const phoneValidation = validateAndFormatPhone(cleanInput);
    if (phoneValidation.isValid) {
      const finalName = candidateName;
      const finalPhone = phoneValidation.cleanPhone;

      let vehicleInfo = null;
      const cleanWithoutPhone = cleanInput
        .replace(/(\+?[0-9][0-9\s-]{8,14}[0-9])/g, '')
        .replace(/^(my number is|number is|phone is|phone:|ph:|my car is|car is|drive a)\s*/i, '')
        .replace(/[,\-–.]/g, ' ')
        .trim();
      if (cleanWithoutPhone.length >= 3 && !NAME_STOP_WORDS.has(cleanWithoutPhone.toLowerCase())) {
        vehicleInfo = { model: cleanWithoutPhone };
      }

      return await completeLeadCapture({
        conversation,
        channel,
        channelUserId,
        finalName,
        finalPhone,
        serviceName,
        vehicleInfo,
        botConfig,
        inboundInput: cleanInput,
        metaMessageId,
      });
    }

    // Case D: User typed their name instead
    const maybeName = extractCustomerName(cleanInput);
    if (maybeName !== 'Customer' && hasDetectedPhone) {
      const finalPhone = userPhoneCheck.cleanPhone;
      return await completeLeadCapture({
        conversation,
        channel,
        channelUserId,
        finalName: maybeName,
        finalPhone,
        serviceName,
        botConfig,
        inboundInput: cleanInput,
        metaMessageId,
      });
    }

    // Case E: Invalid phone number reprompt
    const invalidText = botConfig.phone_invalid || 'Please enter a valid 10-digit mobile number:';
    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, invalidText)
      : sendInstagramOutboundMessage(channelUserId, invalidText);

    Object.assign(conversation, { bot_step: 'awaiting_phone_input' });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: invalidText },
      conversationUpdates: { bot_step: 'awaiting_phone_input' },
    });

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'awaiting_phone_input', invalid: true };
  }

  // =========================================================================
  // STEP 4: QUICK ACTIONS / FALLBACK (With 2-Strike Human Handover)
  // =========================================================================
  const currentFallback = (fallbackTracker.get(channelUserId) || 0) + 1;
  fallbackTracker.set(channelUserId, currentFallback);

  const studioConfig = (await getSetting('general')) || {};
  const studioName = studioConfig.studio_name || getStudioName();
  const address = studioConfig.address || getStudioAddress();
  const studioPhone = studioConfig.phone || getStudioPhone();
  const websiteUrl = studioConfig.website_url || getStudioWebsite();
  const mapsUrl = studioConfig.google_maps_link || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7';

  // If customer asked unrecognized questions 2+ times in a row, auto-handover to human!
  if (currentFallback >= 2) {
    fallbackTracker.delete(channelUserId);
    const handoverMsg = formatMessage('human_handover', {
      studioName,
      address,
      phone: studioPhone,
      studioPhone,
      websiteUrl,
      mapsUrl,
    });

    const closingButtons = [
      { type: 'web_url', title: '🌐 Visit Website', url: websiteUrl },
      { type: 'web_url', title: '📍 Google Maps', url: mapsUrl },
    ];

    const sendPromise = channel === 'whatsapp'
      ? sendMetaWhatsAppMessage(channelUserId, handoverMsg)
      : sendInstagramOutboundMessage(channelUserId, handoverMsg, { buttons: closingButtons });

    Object.assign(conversation, {
      bot_active: true,
      bot_step: 'human_takeover',
      bot_paused_reason: null,
    });

    const dbPromise = logBotTurnMessages({
      conversationId: conversation.id,
      inbound: { content: displayInput, metaMessageId },
      outbound: { content: handoverMsg },
      conversationUpdates: {
        bot_active: true,
        bot_step: 'human_takeover',
        bot_paused_reason: null,
      },
    });

    // Alert studio owner
    const ownerPhone = studioPhone || config.studio?.ownerPhone || '917008457284';
    if (ownerPhone && ownerPhone !== channelUserId) {
      const ownerAlertText = `🔔 *Staff Attention Needed!*\n\nCustomer *${customer?.name || channelUserId}* on ${channel.toUpperCase()} asked complex questions requiring human assistance.\n\n💬 Last inquiry: "${cleanInput}"\n👉 Open CRM Inbox to reply.`;
      sendMetaWhatsAppMessage(ownerPhone, ownerAlertText).catch(() => {});
    }

    await Promise.all([sendPromise, dbPromise]);
    return { handled: true, step: 'human_takeover', botPaused: false };
  }

  // 1st unrecognized query: gentle guidance with options
  const fallbackText = formatMessage('fallback', { studioPhone });
  const quickActions = [
    { id: 'ACTION_SERVICES', title: '🚗 View Packages' },
    { id: 'ACTION_LOCATION', title: '📍 Studio Location' },
    { id: 'ACTION_TALK_HUMAN', title: '👤 Talk to Human' },
  ];

  const sendPromise = channel === 'whatsapp'
    ? sendMetaWhatsAppMessage(channelUserId, fallbackText, { buttons: quickActions })
    : sendInstagramOutboundMessage(channelUserId, fallbackText, { buttons: quickActions });

  const dbPromise = logBotTurnMessages({
    conversationId: conversation.id,
    inbound: { content: displayInput, metaMessageId },
    outbound: { content: fallbackText },
  });

  await Promise.all([sendPromise, dbPromise]);
  return { handled: true };
}

/**
 * Completes lead qualification: sends confirmation FIRST for speed, saves in CRM in parallel
 */
async function completeLeadCapture({
  conversation,
  channel,
  channelUserId,
  finalName,
  finalPhone,
  serviceName,
  vehicleInfo = null,
  botConfig,
  inboundInput,
  metaMessageId,
}) {
  const formattedPhone = finalPhone?.startsWith('+') ? finalPhone : (finalPhone ? `+${finalPhone}` : '');
  const studioPhone = getStudioPhone();
  const completionMessage = formatMessage('booking_confirmed', {
    service: serviceName,
    phone: formattedPhone,
    studioPhone,
  });

  const postLeadButtons = [
    { id: 'PHONE_CHANGE', title: BOT_MESSAGES.btn_change_phone },
  ];

  // Studio location message automatically dispatched right after confirmation card
  const studioConfig = (await getSetting('general')) || {};
  const studioName = studioConfig.studio_name || getStudioName();
  const address = studioConfig.address || getStudioAddress();
  const phone = studioConfig.phone || getStudioPhone();
  const websiteUrl = studioConfig.website_url || getStudioWebsite();
  const mapsUrl = studioConfig.google_maps_link || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7';
  const locationMsg = formatMessage('studio_location', {
    studioName,
    address,
    phone,
    studioPhone: phone,
    websiteUrl,
    mapsUrl,
  });

  const closingButtons = [
    { type: 'web_url', title: '🌐 Visit Website', url: websiteUrl },
    { type: 'web_url', title: '📍 Google Maps', url: mapsUrl },
  ];

  // 1. Send outbound message immediately to user (instant delivery!)
  const sendPromise = (async () => {
    if (channel === 'whatsapp') {
      await sendMetaWhatsAppMessage(channelUserId, completionMessage, { buttons: postLeadButtons });
      await sendMetaWhatsAppMessage(channelUserId, locationMsg);
    } else {
      await sendInstagramOutboundMessage(channelUserId, completionMessage, { buttons: postLeadButtons });
      await sendInstagramOutboundMessage(channelUserId, locationMsg, { buttons: closingButtons });
    }
  })();

  // Update in-memory state immediately so subsequent turns recognize completion
  Object.assign(conversation, {
    bot_step: 'completed',
    pending_name: null,
    pending_service: null,
  });

  // 2. Parallel background database persistence:
  const dbPromise = (async () => {
    const customer = await findOrCreateCustomer({
      name: finalName,
      phone: finalPhone,
      instagramId: channel === 'instagram' ? channelUserId : null,
    });

    const [lead] = await Promise.all([
      createLead({
        customerId: customer.id,
        serviceName,
        source: channel,
        status: 'new',
        notes: `Qualified automatically via ${channel.toUpperCase()} Bot.`,
        vehicle: vehicleInfo,
        customer,
      }),
      logBotTurnMessages({
        conversationId: conversation.id,
        inbound: { content: formatFriendlyMessageText(inboundInput), metaMessageId },
        outbound: { content: `${completionMessage}\n\n${locationMsg}` },
        conversationUpdates: {
          bot_step: 'completed',
          pending_name: null,
          pending_service: null,
        },
      }),
    ]);

    return lead;
  })();

  const [sendResult, outDbResult] = await Promise.all([sendPromise, dbPromise]);
  return { handled: true, step: 'completed', lead: outDbResult, phone: formattedPhone };
}
