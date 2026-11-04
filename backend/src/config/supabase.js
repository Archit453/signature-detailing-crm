import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

export const isSupabaseConfigured = Boolean(
  config.supabase.url && (config.supabase.serviceRoleKey || config.supabase.anonKey)
);

const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey || 'dummy-key-for-dev';
const supabaseUrl = config.supabase.url || 'https://placeholder.supabase.co';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

if (!isSupabaseConfigured) {
  console.warn('[Supabase Config Notice] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not yet provided in .env. Database operations will be simulated until configured.');
}

let detectedCapabilities = null;

export async function getTableCapabilities() {
  if (detectedCapabilities) return detectedCapabilities;

  // Default to the 4-table consolidated schema (Canonical)
  detectedCapabilities = {
    isConsolidated4Table: true,
    leadsHasActivities: true,
    leadsHasCustomerName: true,
    conversationsHasCustomerPhone: true,

    conversationsHasMessages: false,
    conversationsHasRecentMessages: true,
  };

  if (!isSupabaseConfigured) {
    detectedCapabilities = {
      isConsolidated4Table: true,
      leadsHasActivities: true,
      leadsHasCustomerName: true,
      conversationsHasCustomerPhone: true,
  
      conversationsHasMessages: false,
      conversationsHasRecentMessages: true,
    };
    return detectedCapabilities;
  }

  try {
    const cleanUrl = (config.supabase.url || '').trim().replace(/\/+$/, '');
    if (cleanUrl) {
      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          apikey: config.supabase.serviceRoleKey || config.supabase.anonKey,
          Accept: 'application/openapi+json',
        },
      });
      if (res.ok) {
        const openapi = await res.json();
        const hasCustomers = 'customers' in (openapi.definitions || {});
        const leadProps = openapi.definitions?.leads?.properties || {};
        const convProps = openapi.definitions?.conversations?.properties || {};
        detectedCapabilities = {
          isConsolidated4Table: !hasCustomers || ('activities' in leadProps),
          leadsHasActivities: 'activities' in leadProps,
          leadsHasCustomerName: 'customer_name' in leadProps,
          conversationsHasCustomerPhone: 'customer_phone' in convProps,

          conversationsHasMessages: 'messages' in convProps,
          conversationsHasRecentMessages: 'recent_messages' in convProps,
        };
        return detectedCapabilities;
      }
    }
  } catch (err) {
    console.warn('[Table Detection Notice]', err.message);
  }

  detectedCapabilities = {
    isConsolidated4Table: false,
    leadsHasActivities: false,
    leadsHasCustomerName: false,
    conversationsHasCustomerPhone: false,
    conversationsHasMessages: false,
  };
  return detectedCapabilities;
}

