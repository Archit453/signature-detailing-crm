import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { successResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import {
  sendMetaWhatsAppMessage,
  logWhatsAppMessage,
  updateConversationState,
} from '../services/whatsapp.service.js';
import {
  sendInstagramOutboundMessage,
  getRecentInstagramComments,
  getInstagramUserProfile,
} from '../services/instagram.service.js';

function formatPreview(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith('SERVICE_')) {
    const rawCode = text.replace('SERVICE_', '');
    const map = {
      ceramic: '✨ Selected: Ceramic Coating',
      ppf: '🛡️ Selected: Paint Protection Film (PPF)',
      interior: '🧼 Selected: Deep Interior Spa',
      rubbing: '✨ Selected: Paint Correction & Polish',
      graphene: '⚡ Selected: Graphene Coating',
    };
    return map[rawCode] || `✨ Selected: ${rawCode.charAt(0).toUpperCase() + rawCode.slice(1)}`;
  }
  if (text === 'ACTION_SERVICES') return '🚗 Viewed Detailing Packages';
  if (text === 'ACTION_LOCATION') return '📍 Asked for Studio Location';
  if (text === 'ACTION_WEBSITE') return '🌐 Visited Studio Website';
  if (text === 'ACTION_TALK_HUMAN') return '👤 Requested Specialist Callback';
  if (text === 'PHONE_CHANGE') return '📱 Requested Phone Number Change';
  if (text === 'START_FLOW') return '👋 Started Detailing Inquiry';
  return text;
}

export async function listConversations(req, res) {
  const { channel = 'all' } = req.query;

  if (!isSupabaseConfigured) {
    return successResponse(res, [], 'Inbox online');
  }

  // 1. Fetch conversations (filtering out synthetic test records)
  let query = supabase
    .from('conversations')
    .select('*, lead:leads(*)')
    .not('channel_user_id', 'ilike', 'unit_test%')
    .not('channel_user_id', 'ilike', 'takeover_test%')
    .not('channel_user_id', 'ilike', 'fallback_test%')
    .not('channel_user_id', 'ilike', 'test_%')
    .not('channel_user_id', 'ilike', 'tester_%')
    .not('channel_user_id', 'ilike', 'local_debug%')
    .not('channel_user_id', 'eq', '178414999999999')
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (channel && channel !== 'all') {
    query = query.eq('channel', channel);
  }

  let { data, error } = await query;
  if (error) {
    const fallback = await supabase
      .from('conversations')
      .select('*')
      .not('channel_user_id', 'ilike', 'unit_test%')
      .not('channel_user_id', 'ilike', 'takeover_test%')
      .not('channel_user_id', 'ilike', 'fallback_test%')
      .not('channel_user_id', 'ilike', 'test_%')
      .not('channel_user_id', 'ilike', 'tester_%')
      .not('channel_user_id', 'ilike', 'local_debug%')
      .not('channel_user_id', 'eq', '178414999999999')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (fallback.error) throw new ApiError(500, `Failed to load conversations: ${fallback.error.message}`);
    data = fallback.data || [];
  }

  // 2. Pre-fetch leads for robust cross-channel customer matching
  let leadsByPhone = new Map();
  let leadsByIg = new Map();
  try {
    const { data: leads } = await supabase.from('leads').select('*').limit(300);
    (leads || []).forEach((l) => {
      if (l.customer_phone) {
        const clean = String(l.customer_phone).replace(/[^0-9]/g, '');
        leadsByPhone.set(clean, l);
        if (clean.length >= 10) leadsByPhone.set(clean.slice(-10), l);
      }
      if (l.instagram_id) leadsByIg.set(String(l.instagram_id), l);
      if (l.instagram_username) leadsByIg.set(String(l.instagram_username).toLowerCase().replace(/^@/, ''), l);
    });
  } catch (leadFetchErr) {
    console.warn('[Inbox leads lookup note]', leadFetchErr.message);
  }

  // 3. Concurrently resolve missing Instagram customer names in background
  await Promise.all(
    (data || []).map(async (conv) => {
      if (
        conv.channel === 'instagram' &&
        (!conv.customer_name || conv.customer_name === 'Instagram User' || conv.customer_name === 'Instagram Customer') &&
        conv.channel_user_id &&
        /^\d+$/.test(conv.channel_user_id)
      ) {
        try {
          const profile = await getInstagramUserProfile(conv.channel_user_id);
          if (profile?.displayName) {
            conv.customer_name = profile.displayName;
            supabase
              .from('conversations')
              .update({ customer_name: profile.displayName })
              .eq('id', conv.id)
              .then(() => {}, () => {});
          }
        } catch (e) {}
      }
    })
  );

  // 4. Format conversations with high-fidelity customer resolution
  const formatted = (data || []).map((conv) => {
    const phoneClean = String(conv.channel_user_id || conv.customer_phone || '').replace(/[^0-9]/g, '');
    const matchedLead = conv.lead ||
      leadsByPhone.get(phoneClean) ||
      (phoneClean.length >= 10 ? leadsByPhone.get(phoneClean.slice(-10)) : null) ||
      leadsByIg.get(String(conv.channel_user_id));

    // Extract name from review request text if available
    let extractedNameFromMsg = null;
    const allText = `${conv.last_message_preview || ''} ${(conv.recent_messages || []).map((m) => m.content || '').join(' ')}`;
    const reviewMatch = allText.match(/Hi\s+([A-Za-z~]+)\s*👋/);
    if (reviewMatch) extractedNameFromMsg = reviewMatch[1];

    let resolvedName = null;
    if (conv.customer_name && conv.customer_name !== 'Customer') {
      resolvedName = conv.customer_name;
    } else if (matchedLead?.customer_name && matchedLead.customer_name !== 'Customer') {
      resolvedName = matchedLead.customer_name;
    } else if (extractedNameFromMsg) {
      resolvedName = extractedNameFromMsg;
    } else if (conv.channel === 'whatsapp' && phoneClean.length >= 10) {
      const ten = phoneClean.slice(-10);
      resolvedName = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
    } else if (conv.channel === 'instagram') {
      resolvedName = conv.customer_name || 'Instagram User';
    } else {
      resolvedName = 'Customer';
    }

    const resolvedPhone = conv.customer_phone || matchedLead?.customer_phone || (conv.channel === 'whatsapp' ? conv.channel_user_id : null);
    const vehicles = matchedLead?.vehicle_info && Object.keys(matchedLead.vehicle_info).length > 0
      ? [matchedLead.vehicle_info]
      : [];

    // Background sync to persist name onto conversation row if missing
    if (!conv.customer_name && resolvedName && resolvedName !== 'Customer') {
      supabase
        .from('conversations')
        .update({
          customer_name: resolvedName,
          lead_id: matchedLead?.id || conv.lead_id || null,
        })
        .eq('id', conv.id)
        .then(() => {}, () => {});
    }

    return {
      ...conv,
      customer_name: resolvedName,
      last_message_preview: formatPreview(conv.last_message_preview),
      customer: {
        id: matchedLead?.id || conv.lead_id || conv.id,
        name: resolvedName,
        phone: resolvedPhone,
        vehicles,
      },
    };
  });

  return successResponse(res, formatted);
}

export async function getConversationMessages(req, res) {
  const { id } = req.params;
  if (!id) throw new ApiError(400, 'Conversation ID is required');

  if (!isSupabaseConfigured) {
    return successResponse(res, { conversation: null, messages: [] });
  }

  let conversation = null;
  const { data, error } = await supabase
    .from('conversations')
    .select('*, lead:leads(*)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    const fallback = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    conversation = fallback?.data || null;
  } else {
    conversation = data;
  }

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Reset unread count
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', id);

  const lead = conversation.lead;
  const vehicles = lead?.vehicle_info && Object.keys(lead.vehicle_info).length > 0 ? [lead.vehicle_info] : [];

  // Check rolling messages array from conversation (4-table model) or fallback to messages table
  let finalMessages = Array.isArray(conversation.recent_messages)
    ? conversation.recent_messages
    : (Array.isArray(conversation.messages) ? conversation.messages : []);

  if (finalMessages.length === 0) {
    const { data: dbMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (dbMessages && dbMessages.length > 0) {
      finalMessages = dbMessages;
    }
  }

  // Concurrently resolve missing Instagram user profile if needed
  if (
    conversation.channel === 'instagram' &&
    (!conversation.customer_name || conversation.customer_name === 'Instagram User' || conversation.customer_name === 'Instagram Customer') &&
    conversation.channel_user_id &&
    /^\d+$/.test(conversation.channel_user_id)
  ) {
    try {
      const profile = await getInstagramUserProfile(conversation.channel_user_id);
      if (profile?.displayName) {
        conversation.customer_name = profile.displayName;
        supabase
          .from('conversations')
          .update({ customer_name: profile.displayName })
          .eq('id', id)
          .then(() => {}, () => {});
      }
    } catch (e) {}
  }

  const formattedMessages = finalMessages.map((msg) => ({
    ...msg,
    content: formatPreview(msg.content),
  }));

  const formattedConversation = {
    ...conversation,
    last_message_preview: formatPreview(conversation.last_message_preview),
    customer: {
      id: conversation.lead_id || conversation.id,
      name: conversation.customer_name || lead?.customer_name || (conversation.channel === 'instagram' ? 'Instagram User' : 'Customer'),
      phone: conversation.customer_phone || lead?.customer_phone || conversation.channel_user_id,
      vehicles,
    },
  };

  return successResponse(res, {
    conversation: formattedConversation,
    messages: formattedMessages,
  });
}

export async function sendAgentReply(req, res) {
  const { conversationId, content, messageType = 'text' } = req.body;

  if (!conversationId || !content || !content.trim()) {
    throw new ApiError(400, 'Conversation ID and message content are required');
  }

  const cleanContent = content.trim();

  // Fetch conversation
  let conversation = null;
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    conversation = data;
  }

  // 1. Internal Team Note (Yellow Bubble) — NEVER dispatch to Meta API
  if (messageType === 'internal_note') {
    const savedNote = await logWhatsAppMessage({
      conversationId,
      direction: 'outbound',
      senderType: 'agent',
      messageType: 'internal_note',
      content: cleanContent,
    });
    return successResponse(res, savedNote, 'Internal note saved successfully');
  }

  // 2. Public Customer Reply — Dispatch to Meta API
  if (conversation) {
    if (conversation.channel === 'whatsapp') {
      await sendMetaWhatsAppMessage(conversation.channel_user_id, cleanContent);
    } else if (conversation.channel === 'instagram') {
      await sendInstagramOutboundMessage(conversation.channel_user_id, cleanContent);
    }

    // Note agent reply without pausing the bot (bot remains active for customer)
    await updateConversationState(conversationId, {
      bot_step: 'human_takeover',
    });
  }

  const savedMessage = await logWhatsAppMessage({
    conversationId,
    direction: 'outbound',
    senderType: 'agent',
    messageType: 'text',
    content: cleanContent,
  });

  return successResponse(res, savedMessage, 'Message dispatched and logged successfully');
}

export async function toggleBotState(req, res) {
  const { conversationId, botActive } = req.body;

  if (!conversationId || typeof botActive !== 'boolean') {
    throw new ApiError(400, 'Valid conversationId and botActive flag are required');
  }

  let nextStep = 'awaiting_service';
  if (botActive && isSupabaseConfigured) {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('bot_step')
        .eq('id', conversationId)
        .maybeSingle();
      if (conv?.bot_step === 'completed') {
        nextStep = 'completed';
      }
    } catch {
      // fallback
    }
  }

  const updates = botActive
    ? { bot_active: true, bot_paused_reason: null, bot_step: nextStep }
    : { bot_active: false, bot_paused_reason: 'manual_toggle', bot_step: 'human_takeover' };

  const updated = await updateConversationState(conversationId, updates);
  return successResponse(
    res,
    updated,
    botActive ? 'Bot resumed successfully' : 'Bot paused for human takeover'
  );
}

export async function getCommentsFeed(req, res) {
  const comments = await getRecentInstagramComments(50);
  return successResponse(res, comments);
}
