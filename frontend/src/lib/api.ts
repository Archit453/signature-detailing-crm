import {
  getLocalLeads,
  saveLocalLeads,
  addLocalLead,
  updateLocalLead,
  deleteLocalLead,
  getLocalCustomers,
  saveLocalCustomers,
  addOrUpdateLocalCustomer,
  getLocalActivities,
  saveLocalActivities,
  addLocalActivity,
  getLocalServices,
  saveLocalServices,
  calculateLocalKPIs,
} from './localStorage';

const API_BASE = '/api';

async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || `API error (${response.status})`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Inbox & Messaging
  getConversations: async (channel: string = 'all') => {
    try {
      return await fetchJson<any[]>(`/inbox/conversations?channel=${channel}`);
    } catch {
      return [];
    }
  },

  getConversationMessages: (id: string) =>
    fetchJson<{ conversation: any; messages: any[] }>(`/inbox/conversations/${id}/messages`),

  sendMessage: (conversationId: string, content: string, messageType: 'text' | 'internal_note' = 'text') =>
    fetchJson('/inbox/messages/send', {
      method: 'POST',
      body: JSON.stringify({ conversationId, content, messageType }),
    }),

  toggleBot: (conversationId: string, botActive: boolean) =>
    fetchJson('/inbox/bot-toggle', {
      method: 'POST',
      body: JSON.stringify({ conversationId, botActive }),
    }),

  getInstagramComments: () =>
    fetchJson<any[]>('/inbox/instagram/comments'),

  // Leads & Pipeline with LocalStorage Fallback & Cache
  getLeads: async (status?: string, search?: string) => {
    try {
      const serverLeads = await fetchJson<any[]>(
        `/leads?${status ? `status=${status}&` : ''}${search ? `search=${search}` : ''}`
      );
      if (Array.isArray(serverLeads)) {
        if (!status && !search) {
          saveLocalLeads(serverLeads);
        }
        const customersFromLeads = serverLeads
          .filter((l) => l.customer)
          .map((l) => ({
            ...l.customer,
            vehicles: l.vehicle ? [l.vehicle] : l.customer.vehicles || [],
          }));
        if (customersFromLeads.length > 0) {
          const existingCusts = getLocalCustomers();
          const merged = [...existingCusts];
          for (const c of customersFromLeads) {
            const idx = merged.findIndex((m) => m.id === c.id || (c.phone && m.phone === c.phone));
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...c };
            } else {
              merged.push(c);
            }
          }
          saveLocalCustomers(merged);
        }
        return serverLeads;
      }
    } catch (err) {
      console.warn('[API fallback] Could not fetch server leads, using localStorage:', err);
    }
    let local = getLocalLeads();
    if (status && status !== 'all') local = local.filter((l) => l.status === status);
    if (search) {
      const q = search.toLowerCase();
      local = local.filter(
        (l) =>
          l.service_name?.toLowerCase().includes(q) ||
          l.customer?.name?.toLowerCase().includes(q) ||
          l.customer?.phone?.toLowerCase().includes(q) ||
          l.vehicle?.make?.toLowerCase().includes(q) ||
          l.vehicle?.model?.toLowerCase().includes(q)
      );
    }
    return local;
  },

  updateLeadStatus: async (leadId: string, status: string) => {
    updateLocalLead(leadId, { status: status as any });
    try {
      return await fetchJson(`/leads/${leadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.warn('[API fallback] updateLeadStatus failed, stored locally:', err);
      return { id: leadId, status };
    }
  },

  updateLead: async (leadId: string, data: any) => {
    updateLocalLead(leadId, data);
    try {
      return await fetchJson(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('[API fallback] updateLead failed, stored locally:', err);
      return { id: leadId, ...data };
    }
  },

  deleteLead: async (leadId: string) => {
    deleteLocalLead(leadId);
    try {
      return await fetchJson(`/leads/${leadId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[API fallback] deleteLead failed, deleted locally:', err);
      return true;
    }
  },

  sendLeadReview: async (leadId: string, customMessage?: string) => {
    return await fetchJson<{ success: boolean; messageId?: string; error?: string }>(`/leads/${leadId}/review`, {
      method: 'POST',
      body: JSON.stringify({ customMessage }),
    });
  },

  updateCustomer: async (customerId: string, data: any) => {
    addOrUpdateLocalCustomer({ id: customerId, ...data });
    try {
      return await fetchJson(`/leads/customers/${customerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('[API fallback] updateCustomer failed, saved locally:', err);
      return { id: customerId, ...data };
    }
  },

  getPipelineKPIs: async () => {
    try {
      return await fetchJson<any>('/leads/kpis');
    } catch {
      return calculateLocalKPIs();
    }
  },

  getCustomers: async (search?: string) => {
    try {
      const serverCustomers = await fetchJson<any[]>(`/leads/customers?search=${encodeURIComponent(search || '')}`);
      if (Array.isArray(serverCustomers)) {
        if (!search) {
          saveLocalCustomers(serverCustomers);
        }
        return serverCustomers;
      }
    } catch (err) {
      console.warn('[API fallback] getCustomers failed, reading from localStorage:', err);
    }
    return getLocalCustomers(search);
  },

  createWebsiteLead: async (data: {
    name?: string;
    phone?: string;
    service: string;
    vehicle?: string;
    source?: string;
    status?: string;
    customerId?: string;
    vehicleId?: string;
    notes?: string;
  }) => {
    try {
      const res = await fetchJson('/leads', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res && res.id) {
        addLocalLead(res);
        if (res.customer) {
          addOrUpdateLocalCustomer(res.customer);
        }
        return res;
      }
    } catch (err) {
      console.warn('[API fallback] createWebsiteLead failed, saving locally:', err);
    }

    const customer = data.customerId
      ? getLocalCustomers().find((c) => c.id === data.customerId) || {
          id: data.customerId,
          name: data.name || 'Client',
          phone: data.phone || null,
          created_at: new Date().toISOString(),
        }
      : addOrUpdateLocalCustomer({
          name: data.name || 'Walk-in Client',
          phone: data.phone || null,
          notes: data.notes || null,
        });

    const localLead: any = {
      id: `lead-${Date.now()}`,
      customer_id: customer.id,
      vehicle_id: data.vehicleId || null,
      service_name: data.service,
      source: (data.source as any) || 'walk_in',
      status: (data.status as any) || 'new',
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      customer,
      vehicle: data.vehicle ? { id: `veh-${Date.now()}`, customer_id: customer.id, make: data.vehicle, model: '' } : null,
    };

    addLocalLead(localLead);
    return localLead;
  },

  addCustomerVehicle: async (customerId: string, vehicleData: any) => {
    try {
      return await fetchJson(`/leads/customers/${customerId}/vehicles`, {
        method: 'POST',
        body: JSON.stringify(vehicleData),
      });
    } catch (err) {
      console.warn('[API fallback] addCustomerVehicle failed, saved locally:', err);
      const cust = addOrUpdateLocalCustomer({ id: customerId });
      const newVeh = { id: `veh-${Date.now()}`, customer_id: customerId, ...vehicleData };
      cust.vehicles = [...(cust.vehicles || []), newVeh];
      addOrUpdateLocalCustomer(cust);
      return newVeh;
    }
  },

  // Services Catalog
  getServices: async () => {
    try {
      const serverServices = await fetchJson<any[]>('/services');
      if (Array.isArray(serverServices) && serverServices.length > 0) {
        saveLocalServices(serverServices);
        return serverServices;
      }
    } catch (err) {
      console.warn('[API fallback] getServices failed, reading from localStorage:', err);
    }
    return getLocalServices();
  },

  saveService: (serviceData: any) =>
    fetchJson('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    }),

  deleteService: (id: string) =>
    fetchJson(`/services/${id}`, {
      method: 'DELETE',
    }),

  // Settings & Integrations
  getGeneralSettings: () =>
    fetchJson<any>('/settings/general'),

  saveGeneralSettings: (settings: any) =>
    fetchJson('/settings/general', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  getBotMessages: () =>
    fetchJson<any>('/settings/bot-messages'),

  saveBotMessages: (messages: any) =>
    fetchJson('/settings/bot-messages', {
      method: 'POST',
      body: JSON.stringify(messages),
    }),

  getIntegrations: () =>
    fetchJson<any>('/settings/integrations'),

  saveIntegrations: (integrations: any) =>
    fetchJson('/settings/integrations', {
      method: 'POST',
      body: JSON.stringify(integrations),
    }),

  // Google Reviews & Reputation Settings
  getReviewSettings: () =>
    fetchJson<{ enabled: boolean; review_link: string; template: string }>('/settings/reviews'),

  saveReviewSettings: (settings: { enabled: boolean; review_link: string; template?: string }) =>
    fetchJson('/settings/reviews', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Customer Activities & Timeline
  getCustomerActivities: async (customerId: string) => {
    try {
      const acts = await fetchJson<any[]>(`/leads/customers/${customerId}/activities`);
      if (Array.isArray(acts)) {
        saveLocalActivities(customerId, acts);
        return acts;
      }
    } catch (err) {
      console.warn('[API fallback] getCustomerActivities failed, reading from localStorage:', err);
    }
    return getLocalActivities(customerId);
  },

  addCustomerActivity: async (customerId: string, activity: { type: string; title: string; description: string; channel?: string }) => {
    addLocalActivity(customerId, activity);
    try {
      return await fetchJson(`/leads/customers/${customerId}/activities`, {
        method: 'POST',
        body: JSON.stringify(activity),
      });
    } catch (err) {
      console.warn('[API fallback] addCustomerActivity failed, stored locally:', err);
      return activity;
    }
  },

  // System Health & Supabase Keep-Alive
  getHealth: () =>
    fetchJson<{
      status: string;
      system: string;
      database: string;
      dbLatencyMs: number | null;
      uptime: number;
      keepAlive: string;
      timestamp: string;
    }>('/health'),

  // Database Retention & Pruning
  pruneDatabase: (daysToKeep: number = 30) =>
    fetchJson<{ success: boolean; pruned: number }>('/settings/database/prune', {
      method: 'POST',
      body: JSON.stringify({ daysToKeep }),
    }),

  // Simple Studio Authentication
  verifyAuth: async (passcode: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      return data;
    } catch {
      return { success: false, message: 'Unable to reach the authentication service' };
    }
  },
};
