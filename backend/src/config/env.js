import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root or backend directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: (process.env.NODE_ENV || 'development').trim(),

  supabase: {
    url: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    anonKey: (process.env.SUPABASE_ANON_KEY || '').trim(),
  },

  whatsapp: {
    token: (process.env.WHATSAPP_TOKEN || '').trim(),
    phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    verifyToken: (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
  },

  instagram: {
    pageAccessToken: (process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '').trim(),
    pageId: (process.env.INSTAGRAM_PAGE_ID || '').trim(),
    verifyToken: (process.env.INSTAGRAM_VERIFY_TOKEN || '').trim(),
  },

  auth: {
    passcode: (process.env.STUDIO_PASSCODE || process.env.STUDIO_PIN || '').trim(),
  },

  owner: {
    phone: (process.env.OWNER_PHONE || '+91 84568 69931').trim(),
  },

  studio: {
    name: (process.env.STUDIO_NAME || 'Signature Detailing').trim(),
    phone: (process.env.STUDIO_PHONE || '+91 98612 01770').trim(),
    ownerPhone: (process.env.OWNER_PHONE || '+91 84568 69931').trim(),
    email: (process.env.STUDIO_EMAIL || 'signaturedetailing.bbsr@gmail.com').trim(),
    address: (process.env.STUDIO_ADDRESS || 'Plot no - 55, Pahala, Before Utkal Mahindra Service, Bhubaneswar, Odisha 752101').trim(),
    websiteUrl: (process.env.STUDIO_WEBSITE || 'https://signature-detailing-landing-page.signaturedetailing-bbsr.workers.dev/').trim(),
    googleMapsLink: (process.env.STUDIO_MAPS_LINK || 'https://maps.app.goo.gl/TP4S4MommkGLpAzP7').trim(),
    reviewLink: (process.env.STUDIO_REVIEW_LINK || 'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q').trim(),
  },
};
