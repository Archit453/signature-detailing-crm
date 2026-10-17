import { supabase, isSupabaseConfigured, getTableCapabilities } from '../config/supabase.js';
import { config } from '../config/env.js';
import { getSetting } from './settings.service.js';
import { cacheCustomer, findOrCreateCustomer } from './customer.service.js';

let inMemoryMessages = [];
let inMemoryConversations = [];

/**
 * Validates whether a phone number ID is a valid production ID rather than a placeholder/dummy.
 */
function isValidPhoneNumberId(id) {
  if (!id) return false;
  const s = String(id).trim();
  return s.length >= 10 && s !== '100236173166560' && s !== '123456789' && s !== '123456789012345';
}

/**
 * Dispatches WhatsApp message via Meta Cloud API
 * Supports interactive lists, buttons (max 3), or plain text
 */
export async function sendMetaWhatsAppMessage(to, text, options = {}) {
  const cleanTo = String(to || '').replace(/[^0-9]/g, '');
  if (!cleanTo) return { simulated: true, error: 'Missing recipient phone' };

  // Fetch dynamic integration tokens from DB settings with fallback safeguards
  const integrations = await getSetting('integrations');
  const token = integrations?.whatsapp?.token || config.whatsapp.token;
  const rawPhoneId = integrations?.whatsapp?.phone_number_id;
  const phoneNumberId = isValidPhoneNumberId(rawPhoneId)
    ? rawPhoneId.trim()
    : (isValidPhoneNumberId(config.whatsapp.phoneNumberId) ? config.whatsapp.phoneNumberId.trim() : '1344182455438369');

  let payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
  };

  if (options.interactive) {
    payload.type = 'interactive';
    payload.interactive = options.interactive;
  } else if (Array.isArray(options.buttons) && options.buttons.length > 0) {
    payload.type = 'interactive';
    payload.interactive = {
      type: 'button',
      body: { text: String(text || '').slice(0, 1024) },
      action: {
        buttons: options.buttons.slice(0, 3).map((btn, idx) => ({
          type: 'reply',
          reply: {
            id: String(btn.id || idx + 1).slice(0, 256),
            title: String(btn.title || btn.text || '').slice(0, 20),
          },
        })),
      },
    };
    if (options.header) payload.interactive.header = { type: 'text', text: String(options.header).slice(0, 60) };
    if (options.footer) payload.interactive.footer = { text: String(options.footer).slice(0, 60) };
  } else if (options.list) {
    const rawSections = options.list.sections || [];
    const sanitizedSections = rawSections.map((sec) => ({
      title: String(sec.title || 'Studio Services').slice(0, 24),
      rows: (sec.rows || []).slice(0, 10).map((r, idx) => ({
        id: String(r.id || idx + 1).slice(0, 200),
        title: String(r.title || '').slice(0, 24),
        ...(r.description ? { description: String(r.description).slice(0, 72) } : {}),
      })),
    }));

    payload.type = 'interactive';
    payload.interactive = {
      type: 'list',
      body: { text: String(text || '').slice(0, 1024) },
      action: {
        button: String(options.list.button || 'View Packages 🚗').slice(0, 20),
        sections: sanitizedSections,
      },
    };
    if (options.header) payload.interactive.header = { type: 'text', text: String(options.header).slice(0, 60) };
    if (options.footer) payload.interactive.footer = { text: String(options.footer).slice(0, 60) };
  } else if (options.flow) {
    payload.type = 'interactive';
    payload.interactive = {
      type: 'flow',
      body: { text: String(text || '').slice(0, 1024) },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: options.flow.token || `flow_${Date.now()}`,
          flow_id: options.flow.id,
          flow_cta: String(options.flow.cta || 'Fill Details 📝').slice(0, 20),
          flow_action: 'navigate',
          flow_action_payload: {
            screen: options.flow.screen || 'DETAILS_SCREEN',
            data: options.flow.data || {},
          },
        },
      },
    };
    if (options.header) payload.interactive.header = { type: 'text', text: String(options.header).slice(0, 60) };
    if (options.footer) payload.interactive.footer = { text: String(options.footer).slice(0, 60) };
  } else {
    payload.type = 'text';
    payload.text = { body: String(text || '') };
  }

  // If token is missing, simulate message
  if (!token || !phoneNumberId || phoneNumberId === '123456789' || config.nodeEnv === 'test') {
    console.log(`[Meta WhatsApp Simulated] ➔ ${cleanTo} (${payload.type}):\n${text}`);
    return { simulated: true, payload };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.warn('[Meta WhatsApp API Warning]', data);
      return { simulated: true, error: data.error };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('[Meta WhatsApp Network Error]', err.message);
    return { simulated: true, error: err.message };
  }
}

/**
 * Finds or creates a conversation record for WhatsApp
 */
const conversationCache = new Map();
const CONV_CACHE_TTL = 3600000; // 1 hour TTL

export function invalidateConversationCache(phone) {
  if (!phone) return;
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  conversationCache.delete(cleanPhone);
  if (cleanPhone.length > 10) {
    conversationCache.delete(cleanPhone.slice(-10));
  }
}

export async function findOrCreateWhatsAppConversation(customerId, phone) {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');

  const cached = conversationCache.get(cleanPhone);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.conversation;
  }

  if (!isSupabaseConfigured) {
    let conv = inMemoryConversations.find(
      (c) => c.channel === 'whatsapp' && c.channel_user_id === cleanPhone
    );
    if (!conv) {
      conv = {
        id: `conv-wa-${cleanPhone}`,
        customer_id: customerId,
        channel: 'whatsapp',
        channel_user_id: cleanPhone,
        customer_phone: cleanPhone,
        bot_active: true,
        bot_paused_reason: null,
        bot_step: 'awaiting_service',
        last_message_preview: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        recent_messages: [],
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryConversations.push(conv);
    }
    conversationCache.set(cleanPhone, { conversation: conv, expiresAt: Date.now() + CONV_CACHE_TTL });
    return conv;
  }

  const caps = await getTableCapabilities();
  const selectQuery = caps.isConsolidated4Table ? '*, lead:leads(*)' : '*, customer:customers(*)';

  // Try finding existing conversation
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select(selectQuery)
    .eq('channel', 'whatsapp')
    .eq('channel_user_id', cleanPhone)
    .maybeSingle();

  if (!findError && existing) {
    if (existing.lead) {
      existing.customer = {
        name: existing.lead.customer_name,
        phone: existing.lead.customer_phone,
      };
      cacheCustomer(existing.customer, cleanPhone);
    } else if (existing.customer) {
      cacheCustomer(existing.customer, cleanPhone);
    }
    conversationCache.set(cleanPhone, { conversation: existing, expiresAt: Date.now() + CONV_CACHE_TTL });
    return existing;
  }

  const insertData = {
    channel: 'whatsapp',
    channel_user_id: cleanPhone,
    customer_phone: cleanPhone,
    bot_active: true,
    bot_step: 'awaiting_service',
  };

  if (!caps.isConsolidated4Table) {
    const cust = await findOrCreateCustomer({ phone: cleanPhone });
    insertData.customer_id = cust.id;
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert([insertData])
    .select('*')
    .single();

  if (error) throw error;
  if (created) conversationCache.set(cleanPhone, { conversation: created, expiresAt: Date.now() + CONV_CACHE_TTL });
  return created;
}

/**
 * Ultra-fast batch logging for a single bot turn:
 * Appends inbound and outbound messages into conversations.messages / recent_messages JSONB
 * (Capped at rolling 15 messages for permanent zero bloat)
 */
export async function logBotTurnMessages({
  conversationId,
  inbound = null,
  outbound = null,
  conversationUpdates = null,
}) {
  const newMessages = [];
  const now = new Date().toISOString();

  if (inbound && inbound.content) {
    newMessages.push({
      id: `msg-${Date.now()}-in`,
      direction: 'inbound',
      sender_type: inbound.senderType || 'customer',
      message_type: inbound.messageType || 'text',
      content: inbound.content,
      meta_message_id: inbound.metaMessageId || null,
      created_at: now,
    });
  }

  if (outbound && outbound.content) {
    newMessages.push({
      id: `msg-${Date.now()}-out`,
      direction: 'outbound',
      sender_type: outbound.senderType || 'bot',
      message_type: outbound.messageType || 'text',
      content: outbound.content,
      meta_message_id: outbound.metaMessageId || null,
      created_at: now,
    });
  }

  const preview = outbound?.content?.slice(0, 80) || inbound?.content?.slice(0, 80) || '';
  const finalUpdates = {
    last_message_preview: preview,
    last_message_at: now,
    ...(conversationUpdates || {}),
  };

  // Update in-memory cache
  let cachedConv = null;
  for (const entry of conversationCache.values()) {
    if (entry?.conversation?.id === conversationId) {
      cachedConv = entry.conversation;
      Object.assign(entry.conversation, finalUpdates);
      const currentMsgs = Array.isArray(entry.conversation.recent_messages)
        ? entry.conversation.recent_messages
        : (Array.isArray(entry.conversation.messages) ? entry.conversation.messages : []);
      entry.conversation.recent_messages = [...currentMsgs, ...newMessages].slice(-15);
      entry.conversation.messages = entry.conversation.recent_messages;
    }
  }

  if (!isSupabaseConfigured) {
    const conv = inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) {
      Object.assign(conv, finalUpdates);
      const currentMsgs = Array.isArray(conv.recent_messages)
        ? conv.recent_messages
        : (conv.messages || []);
      conv.recent_messages = [...currentMsgs, ...newMessages].slice(-15);
      conv.messages = conv.recent_messages;
    }
    return;
  }

  try {
    const caps = await getTableCapabilities();
    const col = caps.conversationsHasRecentMessages !== false ? 'recent_messages' : 'messages';

    let currentMsgs = [];
    if (cachedConv && Array.isArray(cachedConv[col])) {
      currentMsgs = cachedConv[col];
    } else {
      const { data: convData } = await supabase
        .from('conversations')
        .select(col)
        .eq('id', conversationId)
        .maybeSingle();
      if (convData && Array.isArray(convData[col])) {
        currentMsgs = convData[col];
      }
    }

    finalUpdates[col] = [...currentMsgs, ...newMessages].slice(-15);

    await supabase
      .from('conversations')
      .update(finalUpdates)
      .eq('id', conversationId);
  } catch (err) {
    console.warn('[Batch Message Log Error]', err.message);
  }
}

/**
 * Logs message to database by appending to conversations messages JSONB array
 */
export async function logWhatsAppMessage({
  conversationId,
  direction,
  senderType,
  messageType = 'text',
  content,
  metaMessageId = null,
  mediaUrl = null,
  metadata = {},
}) {
  const msg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    direction,
    sender_type: senderType,
    message_type: messageType,
    content,
    meta_message_id: metaMessageId,
    media_url: mediaUrl,
    metadata,
    created_at: new Date().toISOString(),
  };

  const updates = {
    last_message_preview: content.slice(0, 80),
    last_message_at: msg.created_at,
  };

  if (!isSupabaseConfigured) {
    const conv = inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) {
      Object.assign(conv, updates);
      if (!Array.isArray(conv.recent_messages)) conv.recent_messages = [];
      conv.recent_messages = [...conv.recent_messages, msg].slice(-15);
      conv.messages = conv.recent_messages;
      if (direction === 'inbound') conv.unread_count = (conv.unread_count || 0) + 1;
    }
    return msg;
  }

  try {
    const caps = await getTableCapabilities();
    const col = caps.conversationsHasRecentMessages !== false ? 'recent_messages' : 'messages';

    const { data: conv } = await supabase
      .from('conversations')
      .select(`${col}, unread_count`)
      .eq('id', conversationId)
      .maybeSingle();

    const currentMsgs = Array.isArray(conv?.[col]) ? conv[col] : [];
    updates[col] = [...currentMsgs, msg].slice(-15);
    if (direction === 'inbound') {
      updates.unread_count = (conv?.unread_count || 0) + 1;
    }

    await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);

    return msg;
  } catch (err) {
    console.warn(`[Message Log Error] ${err.message}`);
    return msg;
  }
}

/**
 * Updates conversation state (bot step, active status, pending fields)
 */
export async function updateConversationState(conversationId, updates) {
  // Sync in-memory cache instantly
  for (const entry of conversationCache.values()) {
    if (entry?.conversation?.id === conversationId) {
      Object.assign(entry.conversation, updates);
    }
  }

  if (!isSupabaseConfigured) {
    const conv = inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) Object.assign(conv, updates);
    return conv;
  }

  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);

  if (error) console.warn(`[Conversation State Update Error] ${error.message}`);
  return updates;
}

/**
 * Auto-prune stub — In the 4-table model, conversations JSONB is already
 * continuously capped at a rolling 15-message buffer (zero bloat, ~1.5KB max).
 */
export async function pruneOldMessages(daysToKeep = 30) {
  return { success: true, pruned: 0, message: 'Rolling 15-message buffer active in conversations table' };
}
