import { config } from './env.js';

// ============================================================================
// SIGNATURE DETAILING — CENTRAL BOT MESSAGES & TEMPLATES
// ============================================================================
// 🎯 YOU CAN EDIT ANY MESSAGE HERE TO CHANGE WHAT THE BOT SAYS!
//
// Available placeholders (automatically filled in by the bot):
//   {{service}}      - Selected detailing package (e.g. "✨ Ceramic Coating")
//   {{phone}}        - Customer phone number (e.g. "+91 84568 69931")
//   {{studioPhone}}  - Studio helpline (e.g. "+91 84568 69931")
//   {{studioName}}   - Studio name (e.g. "Signature Detailing")
//   {{address}}      - Studio address
//   {{mapsUrl}}      - Google Maps navigation link
//   {{websiteUrl}}   - Studio official website URL
//   {{username}}     - Instagram username (e.g. "thar_enthusiast_india")
// ============================================================================

export const BOT_MESSAGES = {
  // --------------------------------------------------------------------------
  // 1. WELCOME & GREETING (Phase 1: When customer first messages on WhatsApp/IG)
  // --------------------------------------------------------------------------
  welcome: 'Which service are you looking for today? 🚗✨',

  btn_view_packages: 'View Packages 🚗',
  services_menu_title: 'Select a Detailing Package 🚗✨',

  // --------------------------------------------------------------------------
  // 2. BOOKING CONFIRMATION CARD (Phase 2: Sent immediately after service chosen)
  // --------------------------------------------------------------------------
  booking_confirmed:
    'Request Received ✅\n' +
    '{{service}} booked for {{phone}}.\n' +
    'We\'ll call you shortly! 📞',

  btn_change_phone: 'Change Phone Number',

  // --------------------------------------------------------------------------
  // 3. STUDIO LOCATION (Auto-dispatched immediately after booking card)
  // --------------------------------------------------------------------------
  studio_location:
    '📍 *{{studioName}}*\n' +
    '🏢 {{address}}\n' +
    '📞 {{studioPhone}}\n' +
    '💬 WhatsApp: {{whatsappUrl}}\n' +
    '🌐 {{websiteUrl}}\n' +
    '🗺️ {{mapsUrl}}',

  btn_studio_location: '📍 Studio Location',

  // --------------------------------------------------------------------------
  // 4. POST-COMPLETION RE-GREETING (When customer messages again after booking)
  // --------------------------------------------------------------------------
  already_booked:
    'Booking received ✅ We\'ll call you shortly!\n' +
    'Helpline: {{studioPhone}}',

  // --------------------------------------------------------------------------
  // 5. PHONE NUMBER CHANGE & INPUT PROMPTS
  // --------------------------------------------------------------------------
  ask_new_phone: 'Please enter your 10-digit mobile number:',

  phone_updated:
    'Number updated to {{phone}} ✅\n' +
    'We\'ll call you here!',

  phone_invalid: 'Please enter a valid 10-digit mobile number:',

  // Prompt used on Instagram to collect phone number
  phone_prompt_ig: 'Please share your 10-digit mobile number:',

  // --------------------------------------------------------------------------
  // 6. BOT TRANSPARENCY DISCLAIMER (Appended in Phase 2)
  // --------------------------------------------------------------------------
  bot_disclaimer: '',

  // --------------------------------------------------------------------------
  // 7. FALLBACK / DIRECT HELP (When user types unrecognized message)
  // --------------------------------------------------------------------------
  fallback: 'How can we help? Choose an option below or call {{studioPhone}}:',

  // --------------------------------------------------------------------------
  // 8. STUDIO WEBSITE INFO
  // --------------------------------------------------------------------------
  website_info:
    '🌐 Visit our website:\n' +
    '👉 {{websiteUrl}}',

  // --------------------------------------------------------------------------
  // 8B. HUMAN AGENT TAKEOVER & CLOSING CARD
  // --------------------------------------------------------------------------
  human_handover:
    'Specialist alerted 👤 We\'ll message you shortly!\n\n' +
    '📞 {{studioPhone}}\n' +
    '💬 WhatsApp: {{whatsappUrl}}\n' +
    '🌐 {{websiteUrl}}\n' +
    '📍 {{mapsUrl}}',

  // --------------------------------------------------------------------------
  // 9. INSTAGRAM COMMENT AUTOMATION (Public Reel Reply & Private DM)
  // --------------------------------------------------------------------------
  comment_public_reply: 'Hi @{{username}}! Check your DM 📩',
  comment_private_dm: 'Which service are you looking for today? 🚗✨',
};

/**
 * Helper to render any message template with dynamic placeholders
 * @param {string} keyOrTemplate - Key in BOT_MESSAGES or a custom template string
 * @param {Record<string, string|number>} data - Placeholder values
 * @returns {string} Formatted message
 */
export function formatMessage(keyOrTemplate, data = {}) {
  let template = BOT_MESSAGES[keyOrTemplate] || keyOrTemplate || '';
  if (typeof template !== 'string') return '';

  const defaultWebsite = config.studio?.websiteUrl || 'https://signature-detailing.pages.dev/';
  const defaultStudioPhone = config.studio?.phone || '+91 98612 01770';
  const defaultOwnerPhone = config.studio?.ownerPhone || '+91 84568 69931';
  const defaultStudioName = config.studio?.name || 'Signature Detailing';
  const defaultAddress = config.studio?.address || 'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101';
  const defaultMaps = config.studio?.googleMapsLink || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7';
  const cleanOwnerPhone = defaultOwnerPhone.replace(/\D/g, '') || '918456869931';
  const defaultWhatsApp = `https://wa.me/${cleanOwnerPhone}`;

  const merged = {
    websiteUrl: defaultWebsite,
    studioPhone: defaultStudioPhone,
    botPhone: defaultStudioPhone,
    ownerPhone: defaultOwnerPhone,
    studioName: defaultStudioName,
    address: defaultAddress,
    mapsUrl: defaultMaps,
    whatsappUrl: defaultWhatsApp,
    cleanPhone: cleanOwnerPhone,
    ...data,
  };

  // If phone is not passed, default to studioPhone for location cards
  if (!merged.phone && (keyOrTemplate === 'studio_location' || template.includes('Studio'))) {
    merged.phone = defaultStudioPhone;
  }

  for (const [key, value] of Object.entries(merged)) {
    template = template.replaceAll(`{{${key}}}`, value != null ? String(value) : '');
  }

  // Safety fallbacks if any placeholder was still unreplaced:
  template = template.replaceAll('{{websiteUrl}}', defaultWebsite);
  template = template.replaceAll('{{studioPhone}}', defaultStudioPhone);
  template = template.replaceAll('{{botPhone}}', defaultStudioPhone);
  template = template.replaceAll('{{ownerPhone}}', defaultOwnerPhone);

  return template;
}

export const renderMessage = formatMessage;
