import { createLead, notifyOwnerNewLead } from './lead.service.js';
import { sendMetaWhatsAppMessage } from './whatsapp.service.js';
import { getSetting, getActiveServices } from './settings.service.js';
import { config } from '../config/env.js';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { getStudioName, getStudioPhone, getStudioWebsite } from '../config/studio.config.js';
import { validateAndFormatPhone } from '../utils/phoneValidator.js';

/**
 * Resolves lead submission details from Meta Graph API using leadgen_id
 */
export async function resolveMetaLeadGen(leadgenId, customToken = null) {
  const cleanId = String(leadgenId || '').trim();
  if (!cleanId) throw new Error('Missing leadgen_id');

  const integrations = await getSetting('integrations');
  const token = customToken || integrations?.instagram?.page_access_token || config.instagram.pageAccessToken;

  if (!token) {
    throw new Error('Meta Page Access Token is not configured. Please add it in Settings > Webhooks.');
  }

  const url = `https://graph.facebook.com/v21.0/${cleanId}?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    console.error(`[Meta Lead Ads API Error (${data.error?.code})]:`, data.error?.message);
    throw new Error(data.error?.message || 'Failed to fetch lead from Meta Graph API');
  }

  return data;
}

/**
 * 100% Account & Agency Independent: Universal Fuzzy Field Normalizer
 * Automatically maps arbitrary question keys from any Meta Instant Form or external tool.
 */
export function normalizeAdFormFields(rawInput) {
  let fieldsArray = [];

  // Meta Graph API format: { field_data: [ { name: '...', values: ['...'] } ] }
  if (rawInput && Array.isArray(rawInput.field_data)) {
    fieldsArray = rawInput.field_data.map((f) => ({
      name: String(f.name || '').trim().toLowerCase(),
      value: Array.isArray(f.values) && f.values.length > 0 ? String(f.values[0] || '').trim() : '',
    }));
  } else if (rawInput && typeof rawInput === 'object') {
    // Flat JSON format (e.g. from CRM Simulator or Direct Webhook)
    fieldsArray = Object.entries(rawInput).map(([k, v]) => ({
      name: String(k || '').trim().toLowerCase(),
      value: String(v || '').trim(),
    }));
  }

  const findValue = (regex) => {
    const match = fieldsArray.find((f) => regex.test(f.name) && f.value);
    return match ? match.value : null;
  };

  const rawPhone =
    findValue(/phone|mobile|contact|cell|whatsapp|number/i) ||
    findValue(/ph_no|tel/i);

  const rawName =
    findValue(/full_name|^name$|first_name|prospect_name|customer_name|your_name/i) ||
    'Customer';

  const rawEmail =
    findValue(/email|e_mail|mail/i);

  const rawVehicle =
    findValue(/car|vehicle|model|make|drive|automobile|which_car/i);

  const rawService =
    findValue(/service|package|treatment|detailing|coating|film|ppf|interest/i);

  const rawCity =
    findValue(/city|location|address|town|pincode/i);

  return {
    fullName: rawName !== 'Customer' ? rawName : (findValue(/name/i) || 'Customer'),
    phone: rawPhone,
    email: rawEmail,
    vehicle: rawVehicle,
    service: rawService,
    city: rawCity,
    adId: rawInput?.ad_id || rawInput?.adId || null,
    formId: rawInput?.form_id || rawInput?.formId || null,
    leadgenId: rawInput?.id || rawInput?.leadgen_id || rawInput?.leadgenId || null,
    allFields: fieldsArray,
  };
}

/**
 * Main Pipeline: Ingests Ad Lead, creates CRM Lead, logs conversation,
 * and interactively engages the prospect via WhatsApp
 */
export async function processIncomingAdLead(rawLeadData, options = {}) {
  // 1. Normalize fields dynamically
  const normalized = normalizeAdFormFields(rawLeadData);
  const { fullName, phone: rawPhone, email, vehicle, service, city, adId, formId, leadgenId } = normalized;

  if (!rawPhone) {
    console.warn('[Ad Lead Warning] Received ad lead without a valid phone number:', normalized);
  }

  // 2. Validate & format phone number
  const phoneCheck = rawPhone ? validateAndFormatPhone(rawPhone, '91') : { isValid: false, cleanPhone: null };
  const finalPhone = phoneCheck.isValid ? phoneCheck.cleanPhone : rawPhone;

  // 3. Match Detailing Service with catalog
  const activeServices = await getActiveServices();
  let matchedService = '🚗 General Detailing Inquiry';
  if (service) {
    const sLower = service.toLowerCase();
    const found = activeServices.find(
      (s) => s.name.toLowerCase().includes(sLower) || s.short_code.toLowerCase() === sLower
    );
    if (found) {
      matchedService = found.name;
    } else {
      matchedService = service;
    }
  } else if (activeServices.length > 0) {
    matchedService = activeServices[0].name;
  }

  // 4. Vehicle Details Parsing
  let vehicleDetails = null;
  if (vehicle) {
    const parts = vehicle.trim().split(' ');
    vehicleDetails = {
      make: parts[0] || 'Unknown',
      model: parts.slice(1).join(' ') || vehicle.trim(),
    };
  }

  // 5. Build Notes & Meta Attribution
  const notesParts = [
    `📥 Lead from Instagram Ad Instant Form`,
    vehicle ? `🚗 Vehicle: ${vehicle}` : null,
    city ? `📍 Location: ${city}` : null,
    email ? `✉️ Email: ${email}` : null,
    formId ? `📋 Form ID: ${formId}` : null,
    adId ? `🎯 Ad ID: ${adId}` : null,
    leadgenId ? `🆔 Meta Lead ID: ${leadgenId}` : null,
  ].filter(Boolean);

  // 6. Create or deduplicate lead in CRM
  const createdLead = await createLead({
    customerName: fullName,
    customerPhone: finalPhone,
    serviceName: matchedService,
    source: 'instagram_ad',
    status: 'new',
    notes: notesParts.join(' | '),
    vehicleDetails,
  });

  console.log(`[Instagram Ad Lead Captured] ID: ${createdLead.id} | ${fullName} (${finalPhone}) | Service: ${matchedService}`);

  // 7. Interactive Prospect Engagement (Automated WhatsApp Confirmation with Buttons)
  let prospectNotified = false;
  if (finalPhone && phoneCheck.isValid) {
    try {
      const studioName = getStudioName();
      const studioPhone = getStudioPhone();
      const vehicleSnippet = vehicle ? ` for your *${vehicle}*` : '';

      const confirmText =
        `Greetings *${fullName}*! 👋\n\n` +
        `Thank you for reaching out to *${studioName}* on Instagram.\n\n` +
        `We have received your inquiry${vehicleSnippet} regarding *${matchedService}*.\n\n` +
        `Our studio detailing specialist will call you shortly on *+${finalPhone}* to confirm package details & reserve your vehicle slot.\n\n` +
        `Feel free to tap below to explore our services or view our studio location:`;

      const interactiveButtons = [
        { id: 'ACTION_SERVICES', title: '🚗 View Packages' },
        { id: 'ACTION_LOCATION', title: '📍 Studio Location' },
      ];

      const sendRes = await sendMetaWhatsAppMessage(finalPhone, confirmText, { buttons: interactiveButtons });
      prospectNotified = Boolean(sendRes.success || sendRes.simulated);

      // Log conversation turn into CRM Inbox
      if (isSupabaseConfigured) {
        try {
          const nowIso = new Date().toISOString();
          const initialMessages = [
            {
              id: `msg-ad-form-${Date.now()}`,
              direction: 'inbound',
              content: `📋 Submitted Instagram Ad Form: "${matchedService}"${vehicle ? ` (${vehicle})` : ''}`,
              created_at: nowIso,
            },
            {
              id: `msg-ad-confirm-${Date.now()}`,
              direction: 'outbound',
              content: confirmText,
              created_at: nowIso,
            },
          ];

          const { data: existingConv } = await supabase
            .from('conversations')
            .select('*')
            .eq('channel', 'whatsapp')
            .eq('channel_user_id', finalPhone)
            .maybeSingle();

          if (existingConv) {
            const currentMsgs = Array.isArray(existingConv.recent_messages) ? existingConv.recent_messages : [];
            await supabase
              .from('conversations')
              .update({
                recent_messages: [...currentMsgs, ...initialMessages].slice(-25),
                last_message_preview: `📋 Instagram Ad Lead: ${matchedService}`,
                last_message_at: nowIso,
                unread_count: (existingConv.unread_count || 0) + 1,
              })
              .eq('id', existingConv.id);
          } else {
            await supabase.from('conversations').insert([{
              channel: 'whatsapp',
              channel_user_id: finalPhone,
              customer_name: fullName,
              customer_phone: finalPhone,
              recent_messages: initialMessages,
              last_message_preview: `📋 Instagram Ad Lead: ${matchedService}`,
              last_message_at: nowIso,
              unread_count: 1,
              bot_active: true,
              bot_step: 'awaiting_service',
            }]);
          }
        } catch (convErr) {
          console.warn('[Ad Lead Conversation Notice]', convErr.message);
        }
      }
    } catch (msgErr) {
      console.warn('[Ad Lead Prospect Interactive Engagement Notice]', msgErr.message);
    }
  }

  // 8. Notify Studio Owner & Staff in parallel
  notifyOwnerNewLead(createdLead).catch(() => {});

  return {
    success: true,
    lead: createdLead,
    normalized,
    prospectNotified,
  };
}

