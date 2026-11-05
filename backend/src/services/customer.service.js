import { supabase, isSupabaseConfigured, getTableCapabilities } from '../config/supabase.js';
import { randomUUID } from 'crypto';

let inMemoryCustomers = [];
let inMemoryVehicles = [];
let inMemoryActivities = [];

const customerCache = new Map();
const CUST_CACHE_TTL = 3600000; // 1 hour TTL

export function cacheCustomer(cust, cleanPhone = null, cleanIgId = null) {
  if (!cust) return;
  const expiresAt = Date.now() + CUST_CACHE_TTL;
  if (cust.id) {
    customerCache.set(String(cust.id), { customer: cust, expiresAt });
  }
  if (cust.phone) {
    const raw = String(cust.phone).replace('+', '').trim();
    customerCache.set(raw, { customer: cust, expiresAt });
    customerCache.set(`+${raw}`, { customer: cust, expiresAt });
  }
  if (cust.instagram_id) {
    customerCache.set(String(cust.instagram_id), { customer: cust, expiresAt });
  }
  if (cleanPhone) {
    const raw = String(cleanPhone).replace('+', '').trim();
    customerCache.set(raw, { customer: cust, expiresAt });
    customerCache.set(`+${raw}`, { customer: cust, expiresAt });
  }
  if (cleanIgId) customerCache.set(String(cleanIgId), { customer: cust, expiresAt });
}

/**
 * Finds existing customer details from leads/customers table or memory, or generates a customer object
 */
export async function findOrCreateCustomer({ name, phone, instagramId, instagramUsername, notes = '' }) {
  const cleanName = (name || '').trim() || 'Customer';
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanIgId = instagramId ? String(instagramId).trim() : null;

  const cacheKey = cleanPhone || cleanIgId;
  const lookupKeys = [];
  if (cleanPhone) {
    const raw = cleanPhone.replace('+', '').trim();
    lookupKeys.push(raw, `+${raw}`);
  }
  if (cleanIgId) lookupKeys.push(cleanIgId);

  for (const k of lookupKeys) {
    const cached = customerCache.get(k);
    if (cached && cached.expiresAt > Date.now()) {
      if (cleanName !== 'Customer' && cached.customer.name === 'Customer') {
        cached.customer.name = cleanName;
      }
      if (cleanPhone && (!cached.customer.phone || cached.customer.phone !== cleanPhone)) {
        cached.customer.phone = cleanPhone;
      }
      if (cleanIgId && !cached.customer.instagram_id) {
        cached.customer.instagram_id = cleanIgId;
      }
      if (instagramUsername && !cached.customer.instagram_username) {
        cached.customer.instagram_username = instagramUsername;
      }
      return cached.customer;
    }
  }

  if (!isSupabaseConfigured) {
    let existing = inMemoryCustomers.find(
      (c) => (cleanPhone && c.phone === cleanPhone) || (cleanIgId && c.instagram_id === cleanIgId)
    );
    if (existing) {
      if (cleanName !== 'Customer' && existing.name === 'Customer') {
        existing.name = cleanName;
      }
      if (cleanPhone && !existing.phone) existing.phone = cleanPhone;
      if (cleanIgId && !existing.instagram_id) existing.instagram_id = cleanIgId;
      if (instagramUsername) existing.instagram_username = instagramUsername;
      cacheCustomer(existing, cleanPhone, cleanIgId);
      return existing;
    }
    const newCust = {
      id: randomUUID(),
      name: cleanName,
      phone: cleanPhone,
      instagram_id: cleanIgId,
      instagram_username: instagramUsername || null,
      notes,
      vehicles: [],
      activities: [],
      created_at: new Date().toISOString(),
    };
    inMemoryCustomers.push(newCust);
    if (cacheKey) customerCache.set(cacheKey, { customer: newCust, expiresAt: Date.now() + CUST_CACHE_TTL });
    cacheCustomer(newCust, cleanPhone, cleanIgId);
    return newCust;
  }

  // Normalize phone for robust querying (with and without +)
  const caps = await getTableCapabilities();
  const phoneWithoutPlus = cleanPhone ? cleanPhone.replace('+', '').trim() : null;
  const phoneWithPlus = phoneWithoutPlus ? '+' + phoneWithoutPlus : null;

  // 1. Consolidated 4-table schema mode (leads table acts as customer repository)
  if (caps.isConsolidated4Table) {
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (cleanPhone && cleanIgId) {
      query = query.or(`customer_phone.eq.${phoneWithoutPlus},customer_phone.eq.${phoneWithPlus},instagram_id.eq.${cleanIgId}`);
    } else if (cleanPhone) {
      query = query.in('customer_phone', [phoneWithoutPlus, phoneWithPlus]);
    } else if (cleanIgId) {
      query = query.eq('instagram_id', cleanIgId);
    } else {
      const virtual = {
        id: randomUUID(),
        name: cleanName,
        phone: null,
        instagram_id: null,
        instagram_username: null,
        vehicles: [],
        activities: [],
        notes,
      };
      cacheCustomer(virtual, cleanPhone, cleanIgId);
      return virtual;
    }

    const { data: matchedRows } = await query.limit(1);
    const matched = matchedRows?.[0] || null;

    if (matched) {
      if (cleanPhone && (!matched.customer_phone || matched.customer_phone !== cleanPhone)) {
        supabase.from('leads').update({
          customer_phone: cleanPhone,
          customer_name: cleanName !== 'Customer' ? cleanName : matched.customer_name,
        }).eq('id', matched.id).then(() => {}, () => {});
      }
      const custProfile = {
        id: matched.id,
        name: (cleanName !== 'Customer' ? cleanName : matched.customer_name) || 'Customer',
        phone: cleanPhone || matched.customer_phone || null,
        instagram_id: cleanIgId || matched.instagram_id || null,
        instagram_username: instagramUsername || matched.instagram_username || null,
        vehicles: matched.vehicle_info && matched.vehicle_info.make ? [matched.vehicle_info] : [],
        activities: matched.activities || [],
      };
      cacheCustomer(custProfile, cleanPhone, cleanIgId);
      return custProfile;
    }

    const newProfile = {
      id: randomUUID(),
      name: cleanName,
      phone: cleanPhone,
      instagram_id: cleanIgId,
      instagram_username: instagramUsername || null,
      vehicles: [],
      activities: [],
      notes,
    };
    cacheCustomer(newProfile, cleanPhone, cleanIgId);
    return newProfile;
  }

  // 2. Pre-migration schema mode (dedicated customers table)
  let query = supabase.from('customers').select('*, vehicles(*)');
  if (cleanPhone && cleanIgId) {
    query = query.or(`phone.eq.${phoneWithoutPlus},phone.eq.${phoneWithPlus},instagram_id.eq.${cleanIgId}`);
  } else if (cleanPhone) {
    query = query.in('phone', [phoneWithoutPlus, phoneWithPlus]);
  } else if (cleanIgId) {
    query = query.eq('instagram_id', cleanIgId);
  } else {
    // Cannot match without phone or igId; create new
    const { data: created, error } = await supabase
      .from('customers')
      .insert([{ name: cleanName, notes }])
      .select('*, vehicles(*)')
      .single();
    if (error) throw error;
    cacheCustomer(created, cleanPhone, cleanIgId);
    return created;
  }

  const { data: existingRows } = await query.limit(1);
  const existing = existingRows?.[0] || null;

  if (existing) {
    const updates = {};
    if (cleanName !== 'Customer' && existing.name === 'Customer') updates.name = cleanName;
    if (cleanPhone && (!existing.phone || existing.phone !== cleanPhone)) updates.phone = cleanPhone;
    if (cleanIgId && !existing.instagram_id) updates.instagram_id = cleanIgId;
    if (instagramUsername && !existing.instagram_username) updates.instagram_username = instagramUsername;

    if (Object.keys(updates).length > 0) {
      const { data: updated } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', existing.id)
        .select('*, vehicles(*)')
        .single();
      const resCust = updated || existing;
      cacheCustomer(resCust, cleanPhone, cleanIgId);
      return resCust;
    }

    cacheCustomer(existing, cleanPhone, cleanIgId);
    return existing;
  }

  // Create new customer
  const { data: created, error } = await supabase
    .from('customers')
    .insert([
      {
        name: cleanName,
        phone: cleanPhone,
        instagram_id: cleanIgId,
        instagram_username: instagramUsername || null,
        notes,
      },
    ])
    .select('*, vehicles(*)')
    .single();

  if (error) throw error;
  cacheCustomer(created, cleanPhone, cleanIgId);
  return created;
}

export async function getCustomerById(customerId) {
  if (!customerId) return null;
  const cached = customerCache.get(String(customerId));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.customer;
  }

  if (!isSupabaseConfigured) {
    const cust = inMemoryCustomers.find((c) => c.id === customerId);
    if (!cust) return null;
    const vehicles = inMemoryVehicles.filter((v) => v.customer_id === customerId);
    return { ...cust, vehicles: vehicles.length > 0 ? vehicles : (cust.vehicles || []) };
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (error || !lead) return null;

    return {
      id: lead.id,
      name: lead.customer_name || 'Customer',
      phone: lead.customer_phone || null,
      instagram_id: lead.instagram_id || null,
      instagram_username: lead.instagram_username || null,
      email: lead.email || null,
      vehicles: lead.vehicle_info && lead.vehicle_info.make ? [lead.vehicle_info] : [],
      activities: lead.activities || [],
      created_at: lead.created_at,
    };
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*, vehicles(*)')
    .eq('id', customerId)
    .maybeSingle();

  if (error || !customer) return null;
  return customer;
}

export const getCustomerWithVehicles = getCustomerById;

export async function listCustomers({ search = '', limit = 50 }) {
  if (!isSupabaseConfigured) {
    return inMemoryCustomers;
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,instagram_username.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((l) => ({
      id: l.id,
      name: l.customer_name || 'Customer',
      phone: l.customer_phone || null,
      instagram_id: l.instagram_id || null,
      instagram_username: l.instagram_username || null,
      vehicles: l.vehicle_info && l.vehicle_info.make ? [l.vehicle_info] : [],
      activities: l.activities || [],
      created_at: l.created_at,
    }));
  }

  let query = supabase
    .from('customers')
    .select('*, vehicles(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,instagram_username.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addVehicleToCustomer(customerId, vehicleData) {
  const payload = {
    customer_id: customerId,
    make: vehicleData.make || 'Unknown Make',
    model: vehicleData.model || 'Unknown Model',
    year: vehicleData.year ? parseInt(vehicleData.year, 10) : null,
    color: vehicleData.color || null,
    reg_number: vehicleData.reg_number ? vehicleData.reg_number.toUpperCase().trim() : null,
    paint_condition: vehicleData.paint_condition || 'Good',
    inspection_notes: vehicleData.inspection_notes || null,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const newVehicle = { id: `veh-${Date.now()}`, ...payload };
    inMemoryVehicles.push(newVehicle);
    const cust = inMemoryCustomers.find((c) => c.id === customerId);
    if (cust) {
      if (!cust.vehicles) cust.vehicles = [];
      cust.vehicles.unshift(newVehicle);
    }
    return newVehicle;
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, vehicle_info')
      .eq('id', customerId)
      .maybeSingle();

    if (lead) {
      await supabase
        .from('leads')
        .update({ vehicle_info: payload, updated_at: new Date().toISOString() })
        .eq('id', lead.id);
    }
    return payload;
  }

  const { data: created, error } = await supabase
    .from('vehicles')
    .insert([{ customer_id: customerId, ...payload }])
    .select('*')
    .single();

  if (error) {
    console.warn('[addVehicleToCustomer Error]', error.message);
    return payload;
  }
  return created;
}

export async function updateVehicle(vehicleId, vehicleData) {
  const payload = {
    ...vehicleData,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const idx = inMemoryVehicles.findIndex((v) => v.id === vehicleId);
    if (idx >= 0) {
      inMemoryVehicles[idx] = { ...inMemoryVehicles[idx], ...payload };
      return inMemoryVehicles[idx];
    }
    return null;
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update(payload)
    .eq('id', vehicleId)
    .select('*')
    .single();

  if (error) {
    console.warn('[updateVehicle Error]', error.message);
    return payload;
  }
  return data;
}

export async function updateCustomer(customerId, customerData) {
  const payload = {
    ...customerData,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const cust = inMemoryCustomers.find((c) => c.id === customerId);
    if (cust) Object.assign(cust, customerData);
    return cust;
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    const updates = {};
    if (customerData.name) updates.customer_name = customerData.name;
    if (customerData.phone) updates.customer_phone = customerData.phone;
    if (customerData.instagram_username) updates.instagram_username = customerData.instagram_username;
    if (customerData.email) updates.email = customerData.email;

    const { data, error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('customers')
    .update({ ...customerData, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Customer Timeline Activities (Service Completed, Review Sent, Review Received)
// ---------------------------------------------------------------------------
export async function addCustomerActivity(customerId, activityData) {
  const activity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: activityData.type || 'system_event',
    title: activityData.title || 'Timeline Event',
    description: activityData.description || '',
    channel: activityData.channel || 'system',
    timestamp: activityData.timestamp || new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    inMemoryActivities.unshift(activity);
    const cust = inMemoryCustomers.find((c) => c.id === customerId);
    if (cust) {
      if (!cust.activities) cust.activities = [];
      cust.activities.unshift(activity);
    }
    return activity;
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    try {
      const { data: lead } = await supabase
        .from('leads')
        .select('id, activities')
        .eq('id', customerId)
        .maybeSingle();

      if (lead) {
        const currentActivities = Array.isArray(lead.activities) ? lead.activities : [];
        const updated = [activity, ...currentActivities];
        await supabase
          .from('leads')
          .update({ activities: updated, updated_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    } catch (err) {
      console.warn('[addCustomerActivity Warning]', err.message);
    }
    return activity;
  }

  try {
    await supabase.from('customer_activities').insert([
      {
        customer_id: customerId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        channel: activity.channel,
      },
    ]);
  } catch (err) {
    console.warn('[Supabase addCustomerActivity Exception]:', err.message);
    inMemoryActivities.unshift(activity);
  }
  return activity;
}

export async function getCustomerActivities(customerId) {
  if (!isSupabaseConfigured) {
    const cust = inMemoryCustomers.find((c) => c.id === customerId);
    return cust?.activities || inMemoryActivities.filter((a) => a.customer_id === customerId);
  }

  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    const { data: lead } = await supabase
      .from('leads')
      .select('activities')
      .eq('id', customerId)
      .maybeSingle();
    return lead?.activities || [];
  }

  try {
    const { data, error } = await supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false });

    if (error || !data) {
      return inMemoryActivities.filter((a) => a.customer_id === customerId);
    }
    return data;
  } catch {
    return inMemoryActivities.filter((a) => a.customer_id === customerId);
  }
}
