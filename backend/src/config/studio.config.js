import { config } from './env.js';

// ==========================================
// 1. QUICK STUDIO DETAILS (SINGLE SOURCE OF TRUTH)
// Edit these lines directly to update the bot & CRM
// ==========================================
export const STUDIO_CONFIG = {
  general: {
    studio_name: config.studio?.name || 'Signature Detailing',
    owner_phone: process.env.OWNER_PHONE || config.studio?.ownerPhone || '+91 84568 69931',
    phone: config.studio?.phone || '+91 84568 69931',
    email: config.studio?.email || 'signaturedetailing.bbsr@gmail.com',
    address: config.studio?.address || 'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101',
    website_url: config.studio?.websiteUrl || 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/',
    google_maps_link: config.studio?.googleMapsLink || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7',
  },

  // ==========================================
  // 2. AUTOMATED REVIEW SETTINGS
  // ==========================================
  reviews: {
    enabled: true,
    review_link: config.studio?.reviewLink || 'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q',
    template: "Hi {{customer_name}} 👋 Thank you for choosing Signature Detailing. We hope you loved the service on your {{vehicle_name}}. If you have a minute, we'd really appreciate a review:\n⭐ {{review_link}}\n\nThank you for your trust. - Signature Detailing",
  },

  // ==========================================
  // 3. AI Bot Chat Flow & Questions
  // ==========================================
  bot_messages: {
    // Asked when user first messages the bot
    welcome_text: 'Hi! Which service are you looking for today? 🚗✨',
    
    // Asked on Instagram to get phone number
    phone_prompt_ig: 'Please share your 10-digit mobile number:',
    
    // Confirmation messages for phone numbers
    phone_confirm_wa: 'Confirm contact number {{phone}}?',
    phone_confirm_ig: 'Confirm contact number {{phone}}?',
    
    // Error message if phone number format is wrong
    phone_invalid: 'Please enter a valid 10-digit mobile number:',
    
    // Final closing message after lead is captured
    completion_text: 'Request Received ✅ {{service}} booked. We\'ll call you shortly! 📞',
    
    // Comment Automation
    comment_public_reply: 'Hi @{{username}}! Check your DM 📩',
    comment_private_dm: 'Hi! Which service are you looking for today? 🚗✨',
  },

  // ==========================================
  // 4. API & Integration Setup (Linked from .env automatically)
  // ==========================================
  integrations: {
    whatsapp: {
      phone_number_id: config.whatsapp.phoneNumberId,
      token: config.whatsapp.token,
      verify_token: config.whatsapp.verifyToken,
    },
    instagram: {
      page_access_token: config.instagram.pageAccessToken,
      verify_token: config.instagram.verifyToken,
      page_id: config.instagram.pageId,
    },
  },
};


/**
 * Resolves the studio name directly from STUDIO_CONFIG
 */
export function getStudioName() {
  return config.studio?.name || STUDIO_CONFIG?.general?.studio_name || 'Signature Detailing';
}

/**
 * Resolves the studio address directly from STUDIO_CONFIG
 */
export function getStudioAddress() {
  return (
    config.studio?.address ||
    STUDIO_CONFIG?.general?.address ||
    'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101'
  );
}

/**
 * Resolves the studio contact phone directly from STUDIO_CONFIG
 */
export function getStudioPhone() {
  return config.studio?.phone || STUDIO_CONFIG?.general?.phone || '+91 84568 69931';
}

/**
 * Resolves the studio owner's phone number directly from STUDIO_CONFIG
 */
export function getOwnerPhone() {
  return (
    process.env.OWNER_PHONE ||
    process.env.OWNER_ALERT_PHONE ||
    config.studio?.ownerPhone ||
    STUDIO_CONFIG?.general?.owner_phone ||
    config?.owner?.phone ||
    '+91 84568 69931'
  );
}

/**
 * Resolves the studio website URL directly from STUDIO_CONFIG
 */
export function getStudioWebsite() {
  return (
    config.studio?.websiteUrl ||
    STUDIO_CONFIG?.general?.website_url ||
    'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/'
  );
}

/**
 * Resolves the studio Google Maps link directly from STUDIO_CONFIG
 */
export function getStudioMapsLink() {
  return (
    config.studio?.googleMapsLink ||
    STUDIO_CONFIG?.general?.google_maps_link ||
    'https://maps.app.goo.gl/TP4S4MommkGLpAzP7'
  );
}

/**
 * Resolves the Google review link directly from STUDIO_CONFIG
 */
export function getReviewLink() {
  return (
    config.studio?.reviewLink ||
    STUDIO_CONFIG?.reviews?.review_link ||
    'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q'
  );
}
