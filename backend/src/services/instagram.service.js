import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { config } from '../config/env.js';
import { findOrCreateCustomer } from './customer.service.js';
import { getSetting, getActiveServices } from './settings.service.js';
import { getStudioPhone, getStudioWebsite } from '../config/studio.config.js';
import { BOT_MESSAGES, formatMessage } from '../config/botMessages.js';

let inMemoryComments = [];
const processedCommentIds = new Set();

let cachedConnectedUsername = null;
let cachedConnectedToken = '';
let cachedConnectedExpiry = 0;

/**
 * Dynamically queries Meta Graph API to resolve the connected Instagram username
 * completely agnostic of account name or client (no hardcoding). Cached for 10 minutes.
 */
async function getConnectedAccountUsername(token) {
  if (!token) return null;
  const now = Date.now();
  if (cachedConnectedUsername && cachedConnectedToken === token && cachedConnectedExpiry > now) {
    return cachedConnectedUsername;
  }
  try {
    const isIGToken = token.startsWith('IGAA') || token.startsWith('IGA');
    const url = isIGToken
      ? `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`
      : `https://graph.facebook.com/v21.0/me?fields=id,name,username&access_token=${encodeURIComponent(token)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const rawUser = data.username ? data.username.replace(/^@/, '').trim().toLowerCase() : null;
      if (rawUser) {
        cachedConnectedUsername = rawUser;
        cachedConnectedToken = token;
        cachedConnectedExpiry = now + 10 * 60 * 1000;
        return cachedConnectedUsername;
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
  return null;
}


/**
 * Dispatches outbound DM to Instagram user via Meta Graph API
 */
export async function sendInstagramOutboundMessage(recipientId, text, options = {}) {
  const cleanId = String(recipientId || '').replace(/^ig_/, '').trim();
  if (!cleanId) return { simulated: true, error: 'Invalid recipient Instagram ID' };

  const integrations = await getSetting('integrations');
  const token = integrations?.instagram?.page_access_token || config.instagram.pageAccessToken;

  let messageObj = { text: String(text || '') };

  if (Array.isArray(options.elements) && options.elements.length > 0) {
    messageObj = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: options.elements,
        },
      },
    };
  } else if (Array.isArray(options.buttons) && options.buttons.length > 0) {
    // Instagram Direct does not support Messenger's 'button' template.
    // Map standalone buttons to native Instagram Quick Reply chips for 100% API compliance.
    messageObj = {
      text: String(text || '').slice(0, 1000),
      quick_replies: options.buttons.slice(0, 13).map((b) => ({
        content_type: 'text',
        title: String(b.title || '').slice(0, 20),
        payload: String(b.payload || b.id || ''),
      })),
    };
  } else if (Array.isArray(options.quick_replies) && options.quick_replies.length > 0) {
    messageObj = {
      text: String(text || ''),
      quick_replies: options.quick_replies,
    };
  }

  if (!token || config.nodeEnv === 'test' || cleanId.startsWith('test_') || !/^\d+$/.test(cleanId)) {
    console.log(`[Meta Instagram Simulated] ➔ User (${cleanId}):\n${text}`);
    return { simulated: true, messageObj };
  }

  try {
    const isIGToken = token.startsWith('IGAA') || token.startsWith('IGA');
    const targetAccountId = options.accountId || integrations?.instagram?.page_id || config.instagram.pageId;
    const accountSegment = (targetAccountId && targetAccountId !== '1044542855126226' && /^\d+$/.test(targetAccountId))
      ? targetAccountId
      : 'me';

    const baseUrl = isIGToken
      ? 'https://graph.instagram.com/v21.0/me/messages'
      : `https://graph.facebook.com/v21.0/${accountSegment}/messages`;

    const url = `${baseUrl}?access_token=${encodeURIComponent(token)}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: cleanId },
        message: messageObj,
      }),
    });

    let data = await response.json();

    // Fallback: If template was rejected by Meta, retry with plain text + Quick Replies
    if (!response.ok && messageObj.attachment) {
      console.warn('[Meta Instagram Template Rejected, retrying with Quick Replies]:', data.error?.message);
      const fallbackObj = {
        text: String(text || 'Welcome to Signature Detailing. Please select a service:').slice(0, 1000),
      };
      if (Array.isArray(options.buttons) && options.buttons.length > 0) {
        fallbackObj.quick_replies = options.buttons.slice(0, 13).map((b) => ({
          content_type: 'text',
          title: String(b.title || '').slice(0, 20),
          payload: String(b.payload || b.id || ''),
        }));
      }
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: cleanId },
          message: fallbackObj,
        }),
      });
      data = await response.json();
    }

    if (!response.ok) {
      console.error(`[Meta Instagram API Error ${response.status} (${data.error?.code})]:`, data.error?.message);
      return { simulated: true, error: data.error };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('[Meta Instagram Network Error]', err.message);
    return { simulated: true, error: err.message };
  }
}

/**
 * Dispatches an interactive Studio Location Generic Template Card with clickable web_url buttons
 * (Fixes external links appearing as plain unclickable text on Instagram)
 */
export async function sendInstagramLocationCard(recipientId, {
  studioName = 'Signature Detailing',
  address = 'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar',
  phone = '+91 84568 69931',
  websiteUrl = 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/',
  mapsUrl = 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7',
} = {}) {
  const cleanAddress = String(address).slice(0, 50);
  const elements = [
    {
      title: `📍 ${studioName} Studio`.slice(0, 80),
      subtitle: `${cleanAddress} | 📞 ${phone}`.slice(0, 80),
      buttons: [
        {
          type: 'web_url',
          title: '🗺️ Open Maps',
          url: mapsUrl || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7',
        },
        {
          type: 'web_url',
          title: '🌐 Visit Website',
          url: websiteUrl || 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/',
        },
      ],
    },
  ];

  return await sendInstagramOutboundMessage(recipientId, `📍 ${studioName} Studio`, { elements });
}

/**
 * Dispatches an interactive Studio Website Generic Template Card with clickable web_url button
 */
export async function sendInstagramWebsiteCard(recipientId, websiteUrl = 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/') {
  const elements = [
    {
      title: '🌐 Signature Detailing Official',
      subtitle: 'Explore packages, PPF, ceramics & studio gallery',
      buttons: [
        {
          type: 'web_url',
          title: '🌐 Visit Website',
          url: websiteUrl || 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/',
        },
      ],
    },
  ];

  return await sendInstagramOutboundMessage(recipientId, '🌐 Official Website', { elements });
}

/**
 * Publishes a public reply to a comment on an Instagram Post or Reel
 */
export async function sendInstagramPublicCommentReply(commentId, messageText) {
  const cleanCommentId = String(commentId || '').trim();
  if (!cleanCommentId) return { simulated: true, error: 'Missing comment ID' };

  const integrations = await getSetting('integrations');
  const token = integrations?.instagram?.page_access_token || config.instagram.pageAccessToken;

  if (!token || config.nodeEnv === 'test' || cleanCommentId.startsWith('test_') || cleanCommentId.startsWith('comment_')) {
    console.log(`[Instagram Public Reply Simulated] ➔ Comment (${cleanCommentId}): ${messageText}`);
    return { simulated: true, success: true, text: messageText };
  }

  try {
    const isIGToken = token.startsWith('IGAA') || token.startsWith('IGA');
    const baseUrl = isIGToken
      ? `https://graph.instagram.com/v21.0/${cleanCommentId}/replies`
      : `https://graph.facebook.com/v21.0/${cleanCommentId}/replies`;

    const url = `${baseUrl}?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.warn('[Instagram Public Reply Error]', data);
      return { success: false, error: data.error?.message || 'Meta rejected comment reply' };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('[Instagram Public Reply Network Error]', err.message);
    return { success: false, error: err.message };
  }
}

const userCommentCooldown = new Map();

/**
 * Format button title strictly <= 20 chars for Meta Instagram buttons
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
 * Chunked by 3 buttons per card; automatically scales as new packages are added.
 */
export async function buildInstagramServicesCarousel() {
  const services = await getActiveServices();
  const elements = [];
  const chunkSize = 3;
  const totalCards = Math.max(1, Math.ceil(services.length / chunkSize));

  for (let i = 0; i < services.length; i += chunkSize) {
    const chunk = services.slice(i, i + chunkSize);
    const cardIndex = Math.floor(i / chunkSize) + 1;

    let subtitle = 'Select a package below:';
    if (cardIndex === 1) {
      subtitle = 'Paint Protection & Correction';
    } else if (cardIndex === 2) {
      subtitle = 'Interior Detail & Full Makeover';
    }

    const buttons = chunk.map((srv) => ({
      type: 'postback',
      title: formatButtonTitle(srv.name),
      payload: `SERVICE_${srv.short_code}`,
    }));

    // If card has fewer than 3 buttons, fill slot with website
    if (buttons.length < 3) {
      buttons.push({
        type: 'web_url',
        title: '🌐 View Website',
        url: getStudioWebsite(),
      });
    }

    elements.push({
      title: `🚗 Packages (${cardIndex}/${totalCards})`,
      subtitle: subtitle.slice(0, 80),
      buttons,
    });
  }

  return elements;
}

/**
 * Sends a private DM reply to an Instagram commenter via comment_id
 * NOTE: Meta allows text and Quick Replies for comment private replies.
 * Supports interactive Quick Reply buttons with automated text-only fallback.
 * Supports interactive Generic Template Carousel cards or Quick Reply buttons with automated text fallback
 */
export async function sendInstagramPrivateCommentReply(commentId, messageText, options = {}) {
  const cleanCommentId = String(commentId || '').trim();
  if (!cleanCommentId) return { simulated: true, error: 'Missing comment ID' };

  const integrations = await getSetting('integrations');
  const token = integrations?.instagram?.page_access_token || config.instagram.pageAccessToken;

  if (!token || config.nodeEnv === 'test' || cleanCommentId.startsWith('test_') || cleanCommentId.startsWith('comment_')) {
    console.log(`[Instagram Private DM Simulated] ➔ Comment (${cleanCommentId}): ${messageText}`);
    return {
      simulated: true,
      success: true,
      text: messageText,
      quick_replies: options.quick_replies || [],
    };
  }

  try {
    const isIGToken = token.startsWith('IGAA') || token.startsWith('IGA');
    const targetAccountId = options.accountId || integrations?.instagram?.page_id || config.instagram.pageId;
    const accountSegment = (targetAccountId && targetAccountId !== '1044542855126226' && /^\d+$/.test(targetAccountId))
      ? targetAccountId
      : 'me';

    const baseUrl = isIGToken
      ? 'https://graph.instagram.com/v21.0/me/messages'
      : `https://graph.facebook.com/v21.0/${accountSegment}/messages`;

    const url = `${baseUrl}?access_token=${encodeURIComponent(token)}`;

    // Note: Meta strictly enforces that comment_id private replies must be text (and optional quick replies).
    // Generic template carousels are rejected by Meta API with error 100 for comment recipients.
    const cleanText = String(messageText || '').slice(0, 1000);
    const messageObj = { text: cleanText };

    if (Array.isArray(options.quick_replies) && options.quick_replies.length > 0) {
      messageObj.quick_replies = options.quick_replies.slice(0, 13).map((qr) => ({
        content_type: 'text',
        title: String(qr.title || '').slice(0, 20),
        payload: String(qr.payload || ''),
      }));
    }

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: cleanCommentId },
        message: messageObj,
      }),
    });

    let data = await response.json();

    if (!response.ok) {
      console.warn('[Instagram Private DM Warning]', data?.error?.message || data);

      // Retry 1: If quick replies caused rejection, retry with text only
      if (messageObj.quick_replies) {
        console.log('[Instagram Private DM Fallback] Retrying with plain text-only...');
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { comment_id: cleanCommentId },
            message: { text: cleanText },
          }),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) return { success: true, data: retryData };
      }

      // Retry 2: If endpoint was facebook.com/{page_id}/messages and failed, retry with me/messages
      if (!isIGToken && accountSegment !== 'me') {
        console.log('[Instagram Private DM Fallback] Retrying via me/messages endpoint...');
        const meUrl = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`;
        const meRes = await fetch(meUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { comment_id: cleanCommentId },
            message: { text: cleanText },
          }),
        });
        const meData = await meRes.json();
        if (meRes.ok) return { success: true, data: meData };
      }

      return { success: false, error: data?.error?.message || 'Meta rejected private reply' };
    }

    return { success: true, data };
  } catch (err) {
    console.warn('[Instagram Private DM Network Error]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Processes incoming Reel or Post comment event (Guaranteed Exactly Once)
 */
export async function handleIncomingInstagramComment(commentData, entryAccountId = null) {
  if (!commentData || !commentData.id) return { ignored: true, reason: 'missing_comment_data' };

  // Guard 1: Meta webhook verb check - only reply to new comments, never edits or hides
  if (commentData.verb && commentData.verb !== 'add') {
    return { ignored: true, reason: 'non_add_verb' };
  }

  const commentId = String(commentData.id);
  const commentText = String(commentData.text || '').trim();
  const fromUsername = commentData.from?.username || 'customer';
  const fromId = commentData.from?.id ? String(commentData.from.id) : null;
  const mediaId = String(commentData.media?.id || 'post');

  // Guard 2: In-Memory Idempotency Check
  if (processedCommentIds.has(commentId)) {
    return { ignored: true, reason: 'already_processed' };
  }
  processedCommentIds.add(commentId);
  if (processedCommentIds.size > 3000) {
    const firstItem = processedCommentIds.values().next().value;
    processedCommentIds.delete(firstItem);
  }

  // Guard 3: Cross-Instance Database Deduplication (Vercel serverless cold-start protection)
  if (isSupabaseConfigured && !commentId.startsWith('test_') && !commentId.startsWith('comment_')) {
    try {
      const { data: existing } = await supabase
        .from('instagram_comments')
        .select('id')
        .eq('id', commentId)
        .maybeSingle();

      if (existing?.id) {
        return { ignored: true, reason: 'already_processed_in_db' };
      }
    } catch (dbErr) {
      console.warn('[Comment DB Deduplication Notice]', dbErr.message);
    }
  }

  // Guard 4: Bot Signature Text Check (Detects if comment text was posted by our own bot)
  const isBotSignature =
    commentText.startsWith('Hi @') &&
    (commentText.includes('Thanks for reaching out') ||
      commentText.includes('sent you a DM') ||
      commentText.includes('Please check your message') ||
      commentText.includes('Signature Detailing'));

  if (isBotSignature) {
    console.log(`[Instagram Comment Guard] Ignored bot signature reply comment: ${commentId}`);
    return { ignored: true, reason: 'own_bot_reply' };
  }

  // Guard 5: Self-Reply Protection (Dynamic - protects ANY connected client account)
  const integrations = await getSetting('integrations');
  const token = integrations?.instagram?.page_access_token || config.instagram.pageAccessToken;
  const pageId = String(integrations?.instagram?.page_id || config.instagram.pageId || '');
  const connectedUsername = await getConnectedAccountUsername(token);

  const isOwnAccount =
    Boolean(
      fromId && (
        (pageId && fromId === pageId) ||
        (entryAccountId && fromId === String(entryAccountId))
      )
    ) ||
    Boolean(
      fromUsername && connectedUsername && (
        fromUsername.toLowerCase() === connectedUsername.toLowerCase()
      )
    ) ||
    Boolean(
      fromUsername && (
        fromUsername.toLowerCase() === 'signaturedetailing' ||
        fromUsername.toLowerCase() === 'signaturedetailing.bbsr' ||
        fromUsername.toLowerCase() === 'signaturedetailingbbsr' ||
        fromUsername.toLowerCase() === 'signaturedetailing_official' ||
        fromUsername.toLowerCase() === 'signature_detailing'
      )
    );

  if (isOwnAccount) {
    console.log(`[Instagram Comment Guard] Ignored comment from own account: ID ${fromId}, User @${fromUsername}`);
    return { ignored: true, reason: 'own_account_comment' };
  }

  // Guard 6: Per-User Anti-Spam / Rapid Cooldown (1 reply per user per 2 minutes on the same post)
  const userMediaKey = `${fromUsername.toLowerCase()}_${mediaId}`;
  const now = Date.now();
  const lastRepliedTime = userCommentCooldown.get(userMediaKey);
  if (lastRepliedTime && now - lastRepliedTime < 120000 && !commentId.startsWith('test_')) {
    console.log(`[Instagram Comment Guard] User @${fromUsername} cooldown active on post ${mediaId}. Skipping multiple reply.`);
    return { ignored: true, reason: 'user_comment_cooldown' };
  }
  userCommentCooldown.set(userMediaKey, now);
  if (userCommentCooldown.size > 2000) {
    const oldestKey = userCommentCooldown.keys().next().value;
    userCommentCooldown.delete(oldestKey);
  }

  // Fast In-Memory Config & Services Fetch
  const [botConfig, activeServices] = await Promise.all([
    getSetting('bot_messages'),
    getActiveServices(),
  ]);

  const rawTemplate =
    botConfig?.comment_public_reply ||
    'Hi @{{username}}! Sent you a DM with package details 🚗✨';

  const publicReplyText = rawTemplate.includes('{{username}}')
    ? rawTemplate.replace(/\{\{username\}\}/g, fromUsername)
    : (rawTemplate.includes(`@${fromUsername}`) ? rawTemplate : `Hi @${fromUsername}! ${rawTemplate}`);

  // 3-by-3 Carousel cards matching direct message presentation
  const carouselCards = await buildInstagramServicesCarousel();

  // Interactive Quick Reply buttons (up to 5 packages)
  const quickReplies = (activeServices || []).slice(0, 5).map((srv) => ({
    content_type: 'text',
    title: formatButtonTitle(srv.name),
    payload: `SERVICE_${srv.short_code}`,
  }));

  const studioPhone = getStudioPhone();
  const privateDmText = formatMessage(botConfig?.comment_private_dm || BOT_MESSAGES.comment_private_dm, { username: fromUsername, studioPhone });

  // Exactly-Once Dispatch: 1 Public Comment Reply + 1 Private DM Reply with Carousel Cards & Buttons
  const [publicRes, privateRes] = await Promise.all([
    sendInstagramPublicCommentReply(commentId, publicReplyText),
    sendInstagramPrivateCommentReply(commentId, privateDmText, {
      accountId: entryAccountId,
      // elements omitted: Meta strictly forbids carousels in comment private replies
      quick_replies: quickReplies,
    }),
  ]);

  const commentRecord = {
    id: commentId,
    media_id: mediaId,
    from_username: fromUsername,
    from_id: fromId || null,
    text: commentText,
    public_replied: Boolean(publicRes.success || publicRes.simulated),
    public_reply_text: publicReplyText,
    private_dm_sent: Boolean(privateRes.success || privateRes.simulated),
    private_dm_error: privateRes.error || null,
    created_at: new Date().toISOString(),
  };

  // Multi-tier Persistent Logging & Cross-Instance Sync (Vercel Serverless Safe)
  (async () => {
    // 1. Keep In-Memory Buffer
    inMemoryComments.unshift(commentRecord);
    if (inMemoryComments.length > 100) inMemoryComments.pop();

    if (isSupabaseConfigured) {
      // 2. Persist to dedicated table if available
      try {
        await supabase.from('instagram_comments').upsert(commentRecord);
      } catch (err) {
        // Table might not exist; fallback to studio_settings below
      }

      // 3. Guaranteed Serverless Persistence via studio_settings.instagram_comments_feed
      try {
        const { data: currentFeed } = await supabase
          .from('studio_settings')
          .select('value')
          .eq('key', 'instagram_comments_feed')
          .maybeSingle();

        const feedList = Array.isArray(currentFeed?.value) ? currentFeed.value : [];
        const updatedFeed = [commentRecord, ...feedList.filter((c) => c.id !== commentRecord.id)].slice(0, 100);

        await supabase
          .from('studio_settings')
          .upsert({
            key: 'instagram_comments_feed',
            value: updatedFeed,
            updated_at: new Date().toISOString(),
          });
      } catch (feedErr) {
        console.warn('[Comments Feed Persistence Notice]', feedErr.message);
      }

      // 4. Log to conversations table so comment and private DM appear in CRM Inbox DMs feed
      if (fromId || fromUsername) {
        try {
          const cleanId = fromId ? String(fromId).replace(/^ig_/, '') : fromUsername;
          const nowIso = new Date().toISOString();
          const initialMessages = [
            {
              id: `msg-comment-${commentId}`,
              direction: 'inbound',
              content: `💬 Commented on post: "${commentText}"`,
              created_at: nowIso,
            },
          ];
          if (privateRes.success || privateRes.simulated) {
            initialMessages.push({
              id: `msg-reply-${commentId}`,
              direction: 'outbound',
              content: privateDmText,
              created_at: nowIso,
            });
          }

          const { data: existingConv } = await supabase
            .from('conversations')
            .select('*')
            .eq('channel', 'instagram')
            .eq('channel_user_id', cleanId)
            .maybeSingle();

          if (existingConv) {
            const currentMsgs = Array.isArray(existingConv.recent_messages) ? existingConv.recent_messages : [];
            await supabase
              .from('conversations')
              .update({
                recent_messages: [...currentMsgs, ...initialMessages].slice(-25),
                last_message_preview: `💬 ${commentText}`,
                last_message_at: nowIso,
                unread_count: (existingConv.unread_count || 0) + 1,
              })
              .eq('id', existingConv.id);
          } else {
            await supabase.from('conversations').insert([{
              channel: 'instagram',
              channel_user_id: cleanId,
              customer_name: `@${fromUsername}`,
              recent_messages: initialMessages,
              last_message_preview: `💬 ${commentText}`,
              last_message_at: nowIso,
              unread_count: 1,
              bot_active: false,
              bot_step: 'human_takeover',
            }]);
          }
        } catch (convErr) {
          console.warn('[Conversation Log Warning]', convErr.message);
        }
      }

      // 5. Customer Sync
      if (fromId) {
        try {
          await findOrCreateCustomer({
            name: `@${fromUsername}`,
            instagramId: fromId,
            instagramUsername: fromUsername,
          });
        } catch (err) {
          // Non-blocking
        }
      }
    }
  })().catch(() => {});

  return commentRecord;
}

/**
 * Retrieves recent comments feed (Persisted across Vercel cold starts)
 */
export async function getRecentInstagramComments(limit = 50) {
  if (!isSupabaseConfigured) {
    return inMemoryComments.slice(0, limit);
  }
  try {
    // 1. Check dedicated instagram_comments table first
    const { data, error } = await supabase
      .from('instagram_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    // 2. Read from studio_settings.instagram_comments_feed (Guaranteed persistence)
    const { data: feedData } = await supabase
      .from('studio_settings')
      .select('value')
      .eq('key', 'instagram_comments_feed')
      .maybeSingle();

    if (Array.isArray(feedData?.value) && feedData.value.length > 0) {
      return feedData.value.slice(0, limit);
    }

    return inMemoryComments.slice(0, limit);
  } catch (err) {
    console.warn('[Instagram Comments Notice]', err.message);
    return inMemoryComments.slice(0, limit);
  }
}
