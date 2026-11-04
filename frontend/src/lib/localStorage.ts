import type { Customer, Lead, LeadStatus, PipelineKPIs, StudioService } from '../types';

const STORAGE_KEYS = {
  LEADS: 'signature_crm_leads',
  CUSTOMERS: 'signature_crm_customers',
  SERVICES: 'signature_crm_services',
  ACTIVITIES_PREFIX: 'signature_crm_activities_',
  SETTINGS_PREFIX: 'signature_crm_settings_',
};

const DEFAULT_SERVICES: StudioService[] = [
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
    name: '💎 Graphene Coating',
    short_code: 'graphene',
    tagline: '10H+ ultra-slick graphene matrix protection',
    description: 'Advanced graphene oxide technology offering superior heat dissipation, anti-water spotting, and extreme durability.',
    is_active: true,
    order_index: 5,
  },
];

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[localStorage Error] failed to write ${key}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Leads Storage
// ---------------------------------------------------------------------------
export function getLocalLeads(): Lead[] {
  return safeGet<Lead[]>(STORAGE_KEYS.LEADS, []);
}

export function saveLocalLeads(leads: Lead[]): void {
  safeSet(STORAGE_KEYS.LEADS, leads);
}

export function addLocalLead(lead: Lead): Lead {
  const current = getLocalLeads();
  const updated = [lead, ...current.filter((l) => l.id !== lead.id)];
  saveLocalLeads(updated);
  return lead;
}

export function updateLocalLead(leadId: string, updates: Partial<Lead>): Lead | null {
  const current = getLocalLeads();
  const idx = current.findIndex((l) => l.id === leadId);
  if (idx === -1) return null;
  const updated = {
    ...current[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  current[idx] = updated;
  saveLocalLeads(current);
  return updated;
}

export function deleteLocalLead(leadId: string): void {
  const current = getLocalLeads();
  saveLocalLeads(current.filter((l) => l.id !== leadId));
}

// ---------------------------------------------------------------------------
// Customers Storage
// ---------------------------------------------------------------------------
export function getLocalCustomers(search: string = ''): Customer[] {
  const list = safeGet<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  if (!search) return list;
  const q = search.toLowerCase();
  return list.filter(
    (c) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.vehicles?.some((v) => `${v.make} ${v.model} ${v.reg_number}`.toLowerCase().includes(q))
  );
}

export function saveLocalCustomers(customers: Customer[]): void {
  safeSet(STORAGE_KEYS.CUSTOMERS, customers);
}

export function addOrUpdateLocalCustomer(customerData: Partial<Customer>): Customer {
  const current = safeGet<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  let found = current.find(
    (c) =>
      (customerData.id && c.id === customerData.id) ||
      (customerData.phone && c.phone === customerData.phone)
  );

  if (found) {
    Object.assign(found, customerData);
    saveLocalCustomers(current);
    return found;
  }

  const newCust: Customer = {
    id: customerData.id || `cust-${Date.now()}`,
    name: customerData.name || 'New Client',
    phone: customerData.phone || null,
    instagram_id: customerData.instagram_id || null,
    instagram_username: customerData.instagram_username || null,
    email: customerData.email || null,
    notes: customerData.notes || null,
    created_at: new Date().toISOString(),
    vehicles: customerData.vehicles || [],
  };

  current.unshift(newCust);
  saveLocalCustomers(current);
  return newCust;
}

// ---------------------------------------------------------------------------
// Activities Storage
// ---------------------------------------------------------------------------
export function getLocalActivities(customerId: string): any[] {
  return safeGet<any[]>(`${STORAGE_KEYS.ACTIVITIES_PREFIX}${customerId}`, []);
}

export function saveLocalActivities(customerId: string, activities: any[]): void {
  safeSet(`${STORAGE_KEYS.ACTIVITIES_PREFIX}${customerId}`, activities);
}

export function addLocalActivity(customerId: string, activity: any): any {
  const current = getLocalActivities(customerId);
  const newActivity = {
    id: activity.id || `act-${Date.now()}`,
    customer_id: customerId,
    type: activity.type || 'system_event',
    title: activity.title || 'Timeline Event',
    description: activity.description || '',
    channel: activity.channel || 'studio',
    timestamp: activity.timestamp || new Date().toISOString(),
  };
  const updated = [newActivity, ...current];
  saveLocalActivities(customerId, updated);
  return newActivity;
}

// ---------------------------------------------------------------------------
// Services Storage
// ---------------------------------------------------------------------------
export function getLocalServices(): StudioService[] {
  const saved = safeGet<StudioService[]>(STORAGE_KEYS.SERVICES, []);
  if (saved.length > 0) return saved;
  safeSet(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
  return DEFAULT_SERVICES;
}

export function saveLocalServices(services: StudioService[]): void {
  safeSet(STORAGE_KEYS.SERVICES, services);
}

// ---------------------------------------------------------------------------
// Pipeline KPIs Calculation from Local Leads
// ---------------------------------------------------------------------------
export function calculateLocalKPIs(): PipelineKPIs {
  const leads = getLocalLeads();
  const counts = {
    total: leads.length,
    new: 0,
    contacted: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  const channelBreakdown = {
    website: 0,
    whatsapp: 0,
    instagram: 0,
    other: 0,
  };

  for (const lead of leads) {
    if (counts[lead.status as LeadStatus] !== undefined) {
      counts[lead.status as LeadStatus]++;
    }
    if (channelBreakdown[lead.source as keyof typeof channelBreakdown] !== undefined) {
      channelBreakdown[lead.source as keyof typeof channelBreakdown]++;
    } else {
      channelBreakdown.other++;
    }
  }

  const activeJobs = counts.scheduled + counts.in_progress;
  const conversionRate = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

  return {
    counts,
    channelBreakdown,
    activeJobs,
    conversionRate,
  };
}
