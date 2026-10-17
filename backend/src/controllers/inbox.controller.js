import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { successResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import {
  sendMetaWhatsAppMessage,
  logWhatsAppMessage,
  updateConversationState,
} from '../services/whatsapp.service.js';
import { sendInstagramOutboundMessage, getRecentInstagramComments } from '../services/instagram.service.js';

export async function listConversations(req, res) {
  const { channel = 'all' } = req.query;

  if (!isSupabaseConfigured) {
    return successResponse(res, [], 'Inbox online');
  }

  let query = supabase
    .from('conversations')
    .select('*, lead:leads(*)')
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (channel && channel !== 'all') {
    query = query.eq('channel', channel);
  }

  const { data, error } = await query;
  if (error) {
    // Fallback if lead join isn't configured in PostgREST
    const fallback = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (fallback.error) throw new ApiError(500, `Failed to load conversations: ${fallback.error.message}`);
    
    let leadsByPhone = new Map();
    try {
      const { data: leads } = await supabase.from('leads').select('*').limit(200);
      (leads || []).forEach((l) => {
        if (l.customer_phone) {
          const clean = String(l.customer_phone).replace(/[^0-9]/g, '');
          leadsByPhone.set(clean, l);
          if (clean.length >= 10) leadsByPhone.set(clean.slice(-10), l);
        }
      });
    } catch (_) {}

    const formattedFallback = (fallback.data || []).map((conv) => {
      const phoneClean = String(conv.channel_user_id || conv.customer_phone || '').replace(/[^0-9]/g, '');
      const matchedLead = leadsByPhone.get(phoneClean) || leadsByPhone.get(phoneClean.slice(-10));
      const resolvedName = (conv.customer_name && conv.customer_name !== 'Customer')
        ? conv.customer_name
        : (matchedLead?.customer_name || 'Customer');
      const resolvedPhone = conv.customer_phone || matchedLead?.customer_phone || conv.channel_user_id;
      const vehicles = matchedLead?.vehicle_info && Object.keys(matchedLead.vehicle_info).length > 0
        ? [matchedLead.vehicle_info]
        : [];

      return {
        ...conv,
        customer_name: resolvedName,
        customer: {
          id: matchedLead?.id || conv.lead_id || conv.id,
          name: resolvedName,
          phone: resolvedPhone,
          vehicles,
        },
      };
    });
    return successResponse(res, formattedFallback);
  }

  const formatted = (data || []).map((conv) => {
    const lead = conv.lead;
    const vehicles = lead?.vehicle_info && Object.keys(lead.vehicle_info).length > 0 ? [lead.vehicle_info] : [];
    return {
      ...conv,
      customer: {
        id: conv.lead_id || conv.id,
        name: conv.customer_name || lead?.customer_name || 'Customer',
        phone: conv.customer_phone || lead?.customer_phone || conv.channel_user_id,
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

  const formattedConversation = {
    ...conversation,
    customer: {
      id: conversation.lead_id || conversation.id,
      name: conversation.customer_name || lead?.customer_name || 'Customer',
      phone: conversation.customer_phone || lead?.customer_phone || conversation.channel_user_id,
      vehicles,
    },
  };

  return successResponse(res, {
    conversation: formattedConversation,
    messages: finalMessages,
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

    // Automatically silence the bot (Human Takeover) when agent replies
    await updateConversationState(conversationId, {
      bot_active: false,
      bot_paused_reason: 'manual_takeover',
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
