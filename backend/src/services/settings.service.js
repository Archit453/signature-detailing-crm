import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { config } from '../config/env.js';
import { STUDIO_PACKAGES } from '../config/packages.js';

import { STUDIO_CONFIG as DEFAULT_SETTINGS } from '../config/studio.config.js';

const DEFAULT_SERVICES = [
  {
    id: 's-1',
    name: '🛡️ PPF (Paint Protection Film)',
    short_code: 'ppf',
    tagline: 'Self-healing ultra-gloss TPU protective film',
    description: 'Complete vehicle armor against stone chips, scratches, road debris, and UV yellowing.',
    is_active: true,
    order_index: 1,
  },
  {
    id: 's-2',
    name: '✨ Ceramic Coating',
    short_code: 'ceramic',
    tagline: '9H/10H deep gloss nano ceramic shield',
    description: 'Extreme hydrophobic protection, candy gloss, and multi-year chemical resistance.',
    is_active: true,
    order_index: 2,
  },
  {
    id: 's-3',
    name: '🚘 Paint Correction',
    short_code: 'correction',
    tagline: 'Multi-stage swirl & scratch elimination',
    description: 'Rotary and dual-action polish to restore deep optical clarity and showroom finish.',
    is_active: true,
    order_index: 3,
  },
  {
    id: 's-4',
    name: '🧼 Interior Detailing',
    short_code: 'interior',
    tagline: 'Deep cabin steam clean & leather hygiene',
    description: 'Complete extraction, antimicrobial steam treatment, leather conditioning, and odor removal.',
    is_active: true,
    order_index: 4,
  },
  {
    id: 's-5',
    name: '🏎️ Full Detail Package',
    short_code: 'full_detail',
    tagline: 'Comprehensive interior & exterior transformation',
    description: 'Bumper-to-bumper deep cleansing, decontamination, engine bay detail, and 1-year sealant.',
    is_active: true,
    order_index: 5,
  },
];

let inMemorySettings = { ...DEFAULT_SETTINGS };

let inMemoryServices = [...STUDIO_PACKAGES];

const CACHE_TTL_MS = 3600000; // 1 hour TTL
const settingsCache = new Map();

// Pre-warm settings cache with defaults so bot responds in 0ms without database roundtrips
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  if (k !== 'integrations' || (v?.whatsapp?.token && v?.instagram?.page_access_token)) {
    settingsCache.set(k, { value: v, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}

// Eagerly pre-load all database settings (including credentials) from Supabase on startup
if (isSupabaseConfigured) {
  supabase
    .from('studio_settings')
    .select('key, value')
    .then(({ data }) => {
      if (Array.isArray(data)) {
        for (const row of data) {
          settingsCache.set(row.key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
        }
      }
    })
    .catch(() => {});
}

// Pre-warm services cache
let servicesCache = {
  active: STUDIO_PACKAGES.filter((s) => s.is_active),
  all: [...STUDIO_PACKAGES],
  expiresAt: Date.now() + CACHE_TTL_MS,
};

export function invalidateSettingsCache(key = null) {
  if (key) {
    settingsCache.delete(key);
  } else {
    settingsCache.clear();
  }
}

export function invalidateServicesCache() {
  servicesCache = null;
}

export async function getSetting(key) {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (!isSupabaseConfigured) {
    const fallback = inMemorySettings[key] || DEFAULT_SETTINGS[key] || null;
    settingsCache.set(key, { value: fallback, expiresAt: now + CACHE_TTL_MS });
    return fallback;
  }
  try {
    const { data, error } = await supabase
      .from('studio_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) {
      const fallback = DEFAULT_SETTINGS[key] || null;
      settingsCache.set(key, { value: fallback, expiresAt: now + CACHE_TTL_MS });
      return fallback;
    }
    settingsCache.set(key, { value: data.value, expiresAt: now + CACHE_TTL_MS });
    return data.value;
  } catch {
    const fallback = DEFAULT_SETTINGS[key] || null;
    settingsCache.set(key, { value: fallback, expiresAt: now + CACHE_TTL_MS });
    return fallback;
  }
}

export async function updateSetting(key, value) {
  inMemorySettings[key] = { ...inMemorySettings[key], ...value };
  invalidateSettingsCache(key);

  if (!isSupabaseConfigured) {
    return inMemorySettings[key];
  }
  try {
    const { data, error } = await supabase
      .from('studio_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select('value')
      .single();

    if (error) throw error;
    settingsCache.set(key, { value: data.value, expiresAt: Date.now() + CACHE_TTL_MS });
    return data.value;
  } catch (err) {
    console.warn(`[Settings Update Warning] Failed to persist ${key}: ${err.message}`);
    return inMemorySettings[key];
  }
}

export async function getActiveServices() {
  const now = Date.now();
  if (servicesCache && servicesCache.expiresAt > now && Array.isArray(servicesCache.active) && servicesCache.active.length > 0) {
    return servicesCache.active;
  }

  if (!isSupabaseConfigured) {
    const active = inMemoryServices.filter((s) => s.is_active).sort((a, b) => a.order_index - b.order_index);
    servicesCache = {
      active,
      all: inMemoryServices.sort((a, b) => a.order_index - b.order_index),
      expiresAt: now + CACHE_TTL_MS,
    };
    return active;
  }
  try {
    const { data, error } = await supabase
      .from('studio_services')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error || !data || data.length === 0) {
      const active = inMemoryServices.filter((s) => s.is_active);
      return active;
    }
    const active = data.filter((s) => s.is_active);

    servicesCache = {
      active: data,
      all: data,
      expiresAt: now + CACHE_TTL_MS,
    };
    return active;
  } catch {
    return inMemoryServices.filter((s) => s.is_active);
  }
  return inMemoryServices.filter((s) => s.is_active !== false);
}

export async function getAllServices() {
  const now = Date.now();
  if (servicesCache && servicesCache.expiresAt > now) {
    return servicesCache.all;
  }

  if (!isSupabaseConfigured) {
    return inMemoryServices.sort((a, b) => a.order_index - b.order_index);
  }
  try {
    const { data, error } = await supabase
      .from('studio_services')
      .select('*')
      .order('order_index', { ascending: true });

    if (error || !data || data.length === 0) {
      return inMemoryServices;
    }
    servicesCache = {
      active: data.filter((s) => s.is_active),
      all: data,
      expiresAt: now + CACHE_TTL_MS,
    };
    return data;
  } catch {
    return inMemoryServices;
  }
  return inMemoryServices;
}

export async function upsertService(serviceData) {
  invalidateServicesCache();
  const name = String(serviceData.name || '').trim();
  const shortCode = serviceData.short_code || name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  const payload = {
    ...serviceData,
    id: serviceData.id || `s-${Date.now()}`,
    name,
    short_code: shortCode,
    updated_at: new Date().toISOString(),
    is_active: serviceData.is_active !== false,
    order_index: serviceData.order_index ?? (inMemoryServices.length + 1),
  };

  const idx = inMemoryServices.findIndex((s) => s.id === payload.id || s.short_code === shortCode);
  if (idx >= 0) {
    inMemoryServices[idx] = { ...inMemoryServices[idx], ...payload };
  } else {
    inMemoryServices.push(payload);
  }

  if (!isSupabaseConfigured) {
    return payload;
  }

  try {
    const { data, error } = await supabase
      .from('studio_services')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn(`[Service Upsert Warning] Failed to persist service: ${err.message}`);
    return payload;
  }
}

export async function deleteService(id) {
  invalidateServicesCache();
  inMemoryServices = inMemoryServices.filter((s) => s.id !== id && s.short_code !== id && s.name !== id);

  if (!isSupabaseConfigured) {
    return true;
  }

  try {
    const { error } = await supabase.from('studio_services').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn(`[Service Delete Warning] Failed to delete service ${id}: ${err.message}`);
  }
  return true;
}
