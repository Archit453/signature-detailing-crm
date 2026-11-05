import { supabase, isSupabaseConfigured, getTableCapabilities } from '../config/supabase.js';
import { sendMetaWhatsAppMessage, invalidateConversationCache } from './whatsapp.service.js';
import { findOrCreateCustomer, addVehicleToCustomer, getCustomerById } from './customer.service.js';
import { config } from '../config/env.js';
import { getOwnerPhone } from '../config/studio.config.js';

let inMemoryLeads = [];

const DIGITAL_LEAD_SOURCES = ['whatsapp', 'instagram', 'website'];

/**
 * Formats a raw lead row from database into a consistent, rich object
 * containing a virtual `customer` and `vehicle` for 100% frontend compatibility.
 */
export function formatLeadRow(row) {
  if (!row) return null;
  const vehicleObj = row.vehicle_info && typeof row.vehicle_info === 'object' && row.vehicle_info.make
    ? row.vehicle_info
    : (row.vehicle || null);
  const vehicles = vehicleObj ? [vehicleObj] : (row.customer?.vehicles || []);
  const activities = Array.isArray(row.activities) ? row.activities : [];

  const phoneValue = row.customer?.phone || row.customer_phone || row.phone || null;
  const nameValue = (row.customer?.name && row.customer.name !== 'Customer')
    ? row.customer.name
    : (row.customer_name || row.customer?.name || 'Customer');
  const igIdValue = row.customer?.instagram_id || row.instagram_id || null;
  const igUserValue = row.customer?.instagram_username || row.instagram_username || null;

  const customerObj = row.customer
    ? {
        ...row.customer,
        name: nameValue,
        phone: phoneValue,
        instagram_id: igIdValue,
        instagram_username: igUserValue,
        vehicles: vehicles,
        activities: activities,
      }
    : {
        id: row.customer_id || row.id,
        name: nameValue,
        phone: phoneValue,
        instagram_id: igIdValue,
        instagram_username: igUserValue,
        email: row.email || null,
        vehicles: vehicles,
        activities: activities,
        notes: row.notes || null,
        created_at: row.created_at,
      };

  return {
    ...row,
    customer_id: row.customer_id || row.id,
    customer_name: nameValue,
    customer_phone: phoneValue,
    customer: customerObj,
    vehicle: vehicleObj,
    vehicles: vehicles,
  };
}

/**
 * Checks if a customer has an active/open lead in the system
 */
export async function hasOpenLead({ customerId = null, phone = null, instagramId = null } = {}) {
  const activeStatuses = ['new', 'contacted', 'scheduled', 'in_progress'];
  if (!isSupabaseConfigured) {
    return inMemoryLeads.some((l) => {
      const matchStatus = activeStatuses.includes(l.status);
      if (!matchStatus) return false;
      if (customerId && l.customer_id === customerId) return true;
      if (phone && l.customer_phone === phone) return true;
      if (instagramId && l.instagram_id === instagramId) return true;
      return false;
    });
  }

  try {
    const caps = await getTableCapabilities();
    const cleanDigits = phone ? phone.replace(/\D/g, '').slice(-10) : null;
    let query = supabase.from('leads').select('id, status').in('status', activeStatuses);

    const conditions = [];
    if (customerId && !caps.isConsolidated4Table) conditions.push(`customer_id.eq.${customerId}`);
    if (cleanDigits) conditions.push(`customer_phone.ilike.%${cleanDigits}%`);
    if (instagramId) conditions.push(`instagram_id.eq.${instagramId}`);

    if (conditions.length === 0) return false;

    query = query.or(conditions.join(','));
    const { data, error } = await query.limit(1);
    if (error) {
      console.warn('[hasOpenLead query warning]', error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.warn('[hasOpenLead error]', err.message);
    return false;
  }
}

/**
 * Dispatches an instant WhatsApp alert to the studio owner for new leads
 * arriving from WhatsApp, Instagram, or Website.
 */
export async function notifyOwnerNewLead(lead, attachedCustomer = null) {
  try {
    const source = String(lead?.source || 'website').toLowerCase();
    if (!DIGITAL_LEAD_SOURCES.includes(source)) {
      return { skipped: true, reason: 'unsupported_source' };
    }

    const ownerPhone = getOwnerPhone();
    if (!ownerPhone) {
      console.warn('[Owner Notification] No owner_phone configured in studio.config.js or environment.');
      return { skipped: true, reason: 'missing_owner_phone' };
    }

    let customer = attachedCustomer || lead?.customer;
    if (!customer && lead?.customer_id && isSupabaseConfigured) {
      try {
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', lead.customer_id)
          .maybeSingle();
        if (custData) customer = custData;
      } catch (custErr) {
        console.warn('[Owner Notification Customer Lookup Notice]', custErr.message);
      }
    }

    const customerName = customer?.name || lead?.customer_name || 'Customer';
    const customerPhone = customer?.phone || lead?.customer_phone || 'Not provided';
    const serviceName = lead?.service_name || 'Detailing Service';
    const notes = lead?.notes;
    const channelName = source === 'whatsapp' ? 'WhatsApp Bot' : source === 'instagram' ? 'Instagram DM' : 'Website Form';
    const timeString = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const alertMsg =
      `🚨 *NEW LEAD*\n` +
      `👤 ${customerName}\n` +
      `📞 ${customerPhone}\n` +
      `🛠️ ${serviceName}\n` +
      `📍 ${channelName}\n` +
      `🔗 Open CRM: https://signature-detailing-crm.vercel.app`;

    const result = await sendMetaWhatsAppMessage(ownerPhone, alertMsg);
    console.log(`[Owner Notified - ${channelName}] Alert dispatched to owner (${ownerPhone}) for lead: ${customerName} (${serviceName})`);
    return { success: true, result, ownerPhone, channel: channelName };
  } catch (err) {
    console.warn('[Owner Notification Failed]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notifies the owner when an EXISTING lead from WhatsApp/Instagram fills additional details on Website
 */
export async function notifyOwnerLeadUpdate({
  lead,
  customer = null,
  newSource = 'website',
  newServiceName = null,
  newNotes = null,
  vehicleDetails = null,
}) {
  try {
    const ownerPhone = getOwnerPhone();
    if (!ownerPhone) return { skipped: true, reason: 'missing_owner_phone' };

    const validChannels = ['whatsapp', 'instagram', 'website'];
    if (!validChannels.includes(newSource?.toLowerCase())) {
      return { success: false, reason: 'skipped_non_digital_channel' };
    }

    if (!customer && lead?.customer_id && isSupabaseConfigured) {
      try {
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', lead.customer_id)
          .maybeSingle();
        if (custData) customer = custData;
      } catch (custErr) {
        console.warn('[Owner Update Customer Lookup Notice]', custErr.message);
      }
    }

    const customerName = customer?.name || lead?.customer_name || lead?.customer?.name || 'Customer';
    const customerPhone = customer?.phone || lead?.customer_phone || lead?.customer?.phone || 'Not provided';
    const newChannel = newSource === 'whatsapp' ? 'WhatsApp Bot' : newSource === 'instagram' ? 'Instagram DM' : 'Website Form';
    const activeService = newServiceName || lead?.service_name || 'Detailing Service';

    const alertMsg =
      `🚨 *NEW LEAD*\n` +
      `👤 ${customerName}\n` +
      `📞 ${customerPhone}\n` +
      `🛠️ ${activeService}\n` +
      `📍 ${newChannel}\n` +
      `🔗 Open CRM: https://signature-detailing-crm.vercel.app`;

    const result = await sendMetaWhatsAppMessage(ownerPhone, alertMsg);
    console.log(`[Owner Notified - ${newChannel}] Alert dispatched to owner (${ownerPhone}) for: ${customerName} (${activeService})`);
    return { success: true, result, ownerPhone };
  } catch (err) {
    console.warn('[Owner Update Notification Failed]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Creates or deduplicates a lead in the unified leads table
 */
export async function createLead({
  customerId = null,
  vehicleId = null,
  serviceId = null,
  serviceName,
  source = 'website',
  status = 'new',
  notes = null,
  scheduledDate = null,
  customer = null,
  vehicleDetails = null,
  customerName = null,
  customerPhone = null,
  instagramUsername = null,
  instagramId = null,
}) {
  const cleanDate = (scheduledDate && typeof scheduledDate === 'string' && scheduledDate.trim())
    ? scheduledDate.trim()
    : null;

  const payload = {
    customer_id: customerId,
    vehicle_id: vehicleId || null,
    service_name: serviceName,
    source,
    status,
    notes: notes || null,
    scheduled_date: cleanDate,
    updated_at: new Date().toISOString(),
  };
  let finalName = customerName || customer?.name || 'Customer';
  let finalPhone = customerPhone || customer?.phone || null;
  let finalIgId = instagramId || customer?.instagram_id || null;
  let finalIgUser = instagramUsername || customer?.instagram_username || null;

  if (customerId && (!finalPhone || finalName === 'Customer')) {
    const custProfile = await getCustomerById(customerId);
    if (custProfile) {
      if (!finalPhone) finalPhone = custProfile.phone;
      if (finalName === 'Customer' && custProfile.name) finalName = custProfile.name;
      if (!finalIgId) finalIgId = custProfile.instagram_id;
      if (!finalIgUser) finalIgUser = custProfile.instagram_username;
    }
  }

  let vehicleObj = {};
  if (vehicleDetails) {
    if (typeof vehicleDetails === 'object') {
      vehicleObj = vehicleDetails;
    } else if (typeof vehicleDetails === 'string') {
      const parts = vehicleDetails.split(' ');
      vehicleObj = { make: parts[0] || 'Unknown', model: parts.slice(1).join(' ') || '' };
    }
  }

  const initialActivities = [
    {
      id: `act-${Date.now()}`,
      type: 'inquiry_created',
      title: `Inquiry via ${source.toUpperCase()}`,
      description: serviceName,
      timestamp: new Date().toISOString(),
    },
  ];

  if (!isSupabaseConfigured) {
    const existingOpenLead = inMemoryLeads.find(
      (l) =>
        (finalPhone && l.customer_phone === finalPhone && ['new', 'contacted'].includes(l.status)) ||
        (finalIgId && l.instagram_id === finalIgId && ['new', 'contacted'].includes(l.status)) ||
        (customerId && l.id === customerId && ['new', 'contacted'].includes(l.status))
    );

    if (existingOpenLead) {
      if (vehicleId) existingOpenLead.vehicle_id = vehicleId;
      if (cleanDate) existingOpenLead.scheduled_date = cleanDate;
      if (serviceName && !existingOpenLead.service_name?.toLowerCase().includes(serviceName.toLowerCase())) {
        existingOpenLead.service_name = `${existingOpenLead.service_name}, ${serviceName}`;
      }
      if (finalPhone && (!existingOpenLead.customer_phone || existingOpenLead.customer_phone !== finalPhone)) {
        existingOpenLead.customer_phone = finalPhone;
      }
      if (finalName && finalName !== 'Customer' && (existingOpenLead.customer_name === 'Customer' || !existingOpenLead.customer_name)) {
        existingOpenLead.customer_name = finalName;
      }
      if (finalIgId && !existingOpenLead.instagram_id) {
        existingOpenLead.instagram_id = finalIgId;
      }
      if (finalIgUser && !existingOpenLead.instagram_username) {
        existingOpenLead.instagram_username = finalIgUser;
      }
      const reinquiryNote = `[Additional inquiry via ${source.toUpperCase()}: ${serviceName}${notes ? ' - ' + notes : ''}]`;
      existingOpenLead.notes = existingOpenLead.notes
        ? `${existingOpenLead.notes} | ${reinquiryNote}`
        : reinquiryNote;
      if (Object.keys(vehicleObj).length > 0) {
        existingOpenLead.vehicle_info = { ...(existingOpenLead.vehicle_info || {}), ...vehicleObj };
      }
      existingOpenLead.updated_at = new Date().toISOString();
      existingOpenLead.isReInquiry = true;

      const formatted = formatLeadRow(existingOpenLead);
      notifyOwnerLeadUpdate({
        lead: formatted,
        customer: formatted.customer,
        newSource: source,
        newServiceName: serviceName,
        newNotes: notes,
        vehicleDetails,
      }).catch((err) => console.warn('[Owner Update Notification Error]', err.message));
      return formatted;
    }

    const newLead = {
      id: `lead-${Date.now()}`,
      customer_name: finalName,
      customer_phone: finalPhone,
      instagram_id: finalIgId,
      instagram_username: finalIgUser,
      service_name: serviceName,
      source,
      status,
      scheduled_date: cleanDate,
      notes,
      vehicle_info: vehicleObj,
      activities: initialActivities,
      created_at: new Date().toISOString(),
      ...payload,
      customer: customer || null,
      updated_at: new Date().toISOString(),
    };

    inMemoryLeads.unshift(newLead);
    const formatted = formatLeadRow(newLead);
    notifyOwnerNewLead(formatted, formatted.customer).catch((err) => console.warn('[Owner Notification Error]', err.message));
    return formatted;
  }

  // 1. Consolidated 4-table schema mode (leads table has customer info + activities JSONB)
  const caps = await getTableCapabilities();
  if (caps.isConsolidated4Table) {
    let openLeadQuery = supabase
      .from('leads')
      .select('*')
      .in('status', ['new', 'contacted'])
      .order('created_at', { ascending: false });

    if (finalPhone) {
      const raw = finalPhone.replace('+', '').trim();
      openLeadQuery = openLeadQuery.in('customer_phone', [raw, `+${raw}`]);
    } else if (finalIgId) {
      openLeadQuery = openLeadQuery.eq('instagram_id', finalIgId);
    } else if (customerId) {
      openLeadQuery = openLeadQuery.eq('id', customerId);
    } else {
      openLeadQuery = null;
    }

    let existing = null;
    if (openLeadQuery) {
      const { data: openLeads } = await openLeadQuery.limit(1);
      existing = openLeads?.[0] || null;
    }

    if (existing) {
      const reinquiryNote = `[Additional inquiry via ${source.toUpperCase()}: ${serviceName}${notes ? ' - ' + notes : ''}]`;
      const updatedNotes = existing.notes
        ? `${existing.notes} | ${reinquiryNote}`
        : reinquiryNote;
      const mergedServiceName = (serviceName && !existing.service_name?.toLowerCase().includes(serviceName.toLowerCase()))
        ? `${existing.service_name}, ${serviceName}`
        : (existing.service_name || serviceName);

      const updatePayload = {
        service_name: mergedServiceName,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      };
      if (finalPhone && (!existing.customer_phone || existing.customer_phone !== finalPhone)) {
        updatePayload.customer_phone = finalPhone;
      }
      if (finalName && finalName !== 'Customer' && (existing.customer_name === 'Customer' || !existing.customer_name)) {
        updatePayload.customer_name = finalName;
      }
      if (finalIgId && !existing.instagram_id) {
        updatePayload.instagram_id = finalIgId;
      }
      if (finalIgUser && !existing.instagram_username) {
        updatePayload.instagram_username = finalIgUser;
      }
      if (cleanDate) updatePayload.scheduled_date = cleanDate;
      if (Object.keys(vehicleObj).length > 0) {
        updatePayload.vehicle_info = { ...(existing.vehicle_info || {}), ...vehicleObj };
      }

      const { data: updated, error: updateError } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (!updateError && updated) {
        const formatted = formatLeadRow(updated);
        formatted.isReInquiry = true;

        // Auto-link matching conversation with lead details
        if (finalPhone || finalIgId) {
          (async () => {
            try {
              const cleanP = finalPhone ? finalPhone.replace(/\D/g, '') : null;
              if (cleanP) {
                await supabase.from('conversations').update({
                  lead_id: updated.id,
                  customer_name: finalName,
                }).or(`channel_user_id.eq.${cleanP},channel_user_id.eq.${cleanP.slice(-10)}`);
              } else if (finalIgId) {
                await supabase.from('conversations').update({
                  lead_id: updated.id,
                  customer_name: finalName,
                }).eq('channel_user_id', String(finalIgId));
              }
            } catch (_) {}
          })();
        }

        notifyOwnerLeadUpdate({
          lead: formatted,
          customer: formatted.customer,
          newSource: source,
          newServiceName: serviceName,
          newNotes: notes,
          vehicleDetails,
        }).catch((err) => console.warn('[Owner Update Notification Error]', err.message));
        return formatted;
      }
    }

    const insertPayload = {
      customer_name: finalName,
      customer_phone: finalPhone,
      instagram_id: finalIgId,
      instagram_username: finalIgUser,
      service_name: serviceName,
      source,
      status,
      scheduled_date: cleanDate,
      notes,
      vehicle_info: vehicleObj,
      activities: initialActivities,
    };

    const { data: created, error: insertError } = await supabase
      .from('leads')
      .insert([insertPayload])
      .select('*')
      .single();

    if (insertError) throw insertError;

    const formatted = formatLeadRow(created);

    // Auto-link matching conversation with lead details
    if (finalPhone || finalIgId) {
      (async () => {
        try {
          const cleanP = finalPhone ? finalPhone.replace(/\D/g, '') : null;
          if (cleanP) {
            await supabase.from('conversations').update({
              lead_id: created.id,
              customer_name: finalName,
            }).or(`channel_user_id.eq.${cleanP},channel_user_id.eq.${cleanP.slice(-10)}`);
          } else if (finalIgId) {
            await supabase.from('conversations').update({
              lead_id: created.id,
              customer_name: finalName,
            }).eq('channel_user_id', String(finalIgId));
          }
        } catch (_) {}
      })();
    }

    notifyOwnerNewLead(formatted, formatted.customer).catch((err) => console.warn('[Owner Notification Error]', err.message));
    return formatted;
  }

  // 2. Pre-migration schema fallback mode (customers & vehicles relational tables)
  let finalCustId = customerId;
  let resolvedCustomer = null;
  if (!finalCustId) {
    resolvedCustomer = await findOrCreateCustomer({
      name: finalName,
      phone: finalPhone,
      instagramId: finalIgId,
      instagramUsername: finalIgUser,
      notes,
    });
    finalCustId = resolvedCustomer.id;
  }

  let finalVehId = vehicleId;
  if (!finalVehId && Object.keys(vehicleObj).length > 0 && finalCustId) {
    const veh = await addVehicleToCustomer(finalCustId, vehicleObj);
    finalVehId = veh?.id || null;
  }

  let openLeadQuery = supabase
    .from('leads')
    .select('*, customer:customers(*, vehicles(*))')
    .in('status', ['new', 'contacted'])
    .order('created_at', { ascending: false });

  if (finalCustId) {
    openLeadQuery = openLeadQuery.eq('customer_id', finalCustId);
  }

  const { data: openLeads } = await openLeadQuery.limit(1);
  const existing = openLeads?.[0] || null;

  if (existing) {
    const reinquiryNote = `[Additional inquiry via ${source.toUpperCase()}: ${serviceName}${notes ? ' - ' + notes : ''}]`;
    const updatedNotes = existing.notes
      ? `${existing.notes} | ${reinquiryNote}`
      : reinquiryNote;
    const mergedServiceName = (serviceName && !existing.service_name?.toLowerCase().includes(serviceName.toLowerCase()))
      ? `${existing.service_name}, ${serviceName}`
      : (existing.service_name || serviceName);

    const updatePayload = {
      service_name: mergedServiceName,
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    };
    if (finalPhone && existing.customer_id) {
      updateCustomer(existing.customer_id, {
        phone: finalPhone,
        name: finalName !== 'Customer' ? finalName : undefined,
        instagram_id: finalIgId || undefined,
        instagram_username: finalIgUser || undefined,
      }).catch(() => {});
    }
    if (vehicleId) updatePayload.vehicle_id = vehicleId;
    if (cleanDate) updatePayload.scheduled_date = cleanDate;

    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*, customer:customers(*, vehicles(*))')
      .single();

    if (!updateError && updated) {
      const formatted = formatLeadRow(updated);
      formatted.isReInquiry = true;
      notifyOwnerLeadUpdate({
        lead: formatted,
        customer: formatted.customer,
        newSource: source,
        newServiceName: serviceName,
        newNotes: notes,
        vehicleDetails,
      }).catch((err) => console.warn('[Owner Update Notification Error]', err.message));
      return formatted;
    }
  }

  const insertPayload = {
    customer_id: finalCustId,
    vehicle_id: finalVehId,
    service_name: serviceName,
    source,
    status,
    scheduled_date: cleanDate,
    notes,
  };

  const { data: created, error: insertError } = await supabase
    .from('leads')
    .insert([insertPayload])
    .select('*, customer:customers(*, vehicles(*))')
    .single();

  if (insertError) throw insertError;

  const formatted = formatLeadRow(created);
  notifyOwnerNewLead(formatted, formatted.customer).catch((err) => console.warn('[Owner Notification Error]', err.message));
  return formatted;
}

/**
 * Lists leads with optional filtering, search, and pagination
 */
export async function listLeads({ status = null, source = null, limit = 100, offset = 0, search = '' } = {}) {
  if (!isSupabaseConfigured) {
    let filtered = [...inMemoryLeads];
    if (status && status !== 'all') filtered = filtered.filter((l) => l.status === status);
    if (source && source !== 'all') filtered = filtered.filter((l) => l.source === source);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.service_name?.toLowerCase().includes(q) ||
          l.customer?.name?.toLowerCase().includes(q) ||
          l.customer?.phone?.toLowerCase().includes(q) ||
          l.customer_name?.toLowerCase().includes(q) ||
          l.customer_phone?.toLowerCase().includes(q) ||
          l.vehicle?.make?.toLowerCase().includes(q) ||
          l.vehicle?.model?.toLowerCase().includes(q)
      );
    }
    return filtered.slice(offset, offset + limit).map(formatLeadRow);
  }

  const caps = await getTableCapabilities();
  const selectQuery = caps.isConsolidated4Table ? '*' : '*, customer:customers(*, vehicles(*))';
  let query = supabase
    .from('leads')
    .select(selectQuery)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (source && source !== 'all') {
    query = query.eq('source', source);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = (data || []).map(formatLeadRow);
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    results = results.filter(
      (l) =>
        l.service_name?.toLowerCase().includes(q) ||
        l.customer?.name?.toLowerCase().includes(q) ||
        l.customer?.phone?.toLowerCase().includes(q) ||
        l.customer?.instagram_username?.toLowerCase().includes(q) ||
        l.vehicle?.make?.toLowerCase().includes(q) ||
        l.vehicle?.model?.toLowerCase().includes(q) ||
        l.vehicle?.reg_number?.toLowerCase().includes(q)
    );
  }
  return results;
}

export const getLeads = listLeads;

export async function updateLead(leadId, updates) {
  const cleanUpdates = { ...updates };
  if (cleanUpdates.scheduled_date === '' || cleanUpdates.scheduledDate === '') {
    cleanUpdates.scheduled_date = null;
    delete cleanUpdates.scheduledDate;
  }

  // Handle nested vehicle updates if sent as vehicle or vehicle_info
  if (cleanUpdates.vehicle) {
    cleanUpdates.vehicle_info = cleanUpdates.vehicle;
    delete cleanUpdates.vehicle;
  }

  if (!isSupabaseConfigured) {
    const lead = inMemoryLeads.find((l) => l.id === leadId);
    if (!lead) throw new Error('Lead not found');
    Object.assign(lead, cleanUpdates, { updated_at: new Date().toISOString() });
    return formatLeadRow(lead);
  }

  const caps = await getTableCapabilities();
  const selectQuery = caps.isConsolidated4Table ? '*' : '*, customer:customers(*, vehicles(*))';

  const { data, error } = await supabase
    .from('leads')
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select(selectQuery)
    .single();

  if (error) throw error;
  return formatLeadRow(data);
}

export async function deleteLead(leadId) {
  if (!isSupabaseConfigured) {
    const idx = inMemoryLeads.findIndex((l) => l.id === leadId);
    if (idx >= 0) {
      const removed = inMemoryLeads.splice(idx, 1)[0];
      if (removed?.customer_phone) invalidateConversationCache(removed.customer_phone);
      return true;
    }
    return false;
  }

  // 1. Fetch lead details before deletion to get phone & ig
  let targetPhone = null;
  let targetIgId = null;
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('customer_phone, instagram_id')
      .eq('id', leadId)
      .maybeSingle();

    if (lead) {
      targetPhone = lead.customer_phone;
      targetIgId = lead.instagram_id;
    }
  } catch (fetchErr) {
    console.warn('[deleteLead pre-fetch warning]', fetchErr.message);
  }

  // 2. Delete lead row
  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) throw error;

  // 3. Reset conversation state so customer can start fresh
  try {
    if (targetPhone) {
      invalidateConversationCache(targetPhone);
      const cleanDigits = targetPhone.replace(/\D/g, '');
      const candidates = [cleanDigits, cleanDigits.slice(-10)].filter(Boolean);
      for (const phoneId of candidates) {
        await supabase
          .from('conversations')
          .update({
            bot_step: 'awaiting_service',
            bot_active: true,
            pending_service: null,
            pending_name: null,
          })
          .eq('channel_user_id', phoneId);
      }
    }

    if (targetIgId) {
      await supabase
        .from('conversations')
        .update({
          bot_step: 'awaiting_service',
          bot_active: true,
          pending_service: null,
          pending_name: null,
        })
        .eq('channel_user_id', targetIgId);
    }
  } catch (convErr) {
    console.warn('[deleteLead conversation reset warning]', convErr.message);
  }

  return true;
}

export async function updateLeadStatus(leadId, newStatus) {
  const validStatuses = ['new', 'contacted', 'scheduled', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status "${newStatus}". Must be one of: ${validStatuses.join(', ')}`);
  }

  if (!isSupabaseConfigured) {
    const lead = inMemoryLeads.find((l) => l.id === leadId);
    if (!lead) throw new Error('Lead not found');
    lead.status = newStatus;
    lead.updated_at = new Date().toISOString();
    return formatLeadRow(lead);
  }

  const caps = await getTableCapabilities();
  const selectQuery = caps.isConsolidated4Table ? '*' : '*, customer:customers(*, vehicles(*))';

  const { data, error } = await supabase
    .from('leads')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select(selectQuery)
    .single();

  if (error) throw error;
  return formatLeadRow(data);
}

export async function getPipelineKPIs() {
  let leads = [];
  if (!isSupabaseConfigured) {
    leads = inMemoryLeads;
  } else {
    const { data, error } = await supabase
      .from('leads')
      .select('status, source');
    if (error) throw error;
    leads = data || [];
  }

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
    if (counts[lead.status] !== undefined) counts[lead.status]++;
    if (channelBreakdown[lead.source] !== undefined) {
      channelBreakdown[lead.source]++;
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

export async function getLeadById(leadId) {
  if (!isSupabaseConfigured) {
    const lead = inMemoryLeads.find((l) => l.id === leadId);
    return lead ? formatLeadRow(lead) : null;
  }
  const caps = await getTableCapabilities();
  const selectQuery = caps.isConsolidated4Table ? '*' : '*, customer:customers(*, vehicles(*))';
  const { data, error } = await supabase
    .from('leads')
    .select(selectQuery)
    .eq('id', leadId)
    .maybeSingle();
  if (error) throw error;
  return data ? formatLeadRow(data) : null;
}


