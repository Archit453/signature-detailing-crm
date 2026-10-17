import { z } from 'zod';
import { ApiError } from '../utils/apiError.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';
import {
  findOrCreateCustomer,
  addVehicleToCustomer,
  updateCustomer,
  listCustomers,
  addCustomerActivity,
  getCustomerActivities,
} from '../services/customer.service.js';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getPipelineKPIs,
} from '../services/lead.service.js';
import {
  sendMetaWhatsAppMessage,
  findOrCreateWhatsAppConversation,
  logWhatsAppMessage,
} from '../services/whatsapp.service.js';
import { getSetting } from '../services/settings.service.js';
import { validateAndFormatPhone } from '../utils/phoneValidator.js';
import { getStudioPhone, getStudioName } from '../config/studio.config.js';

const publicLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  customerId: z.string().optional(),
  vehicleId: z.string().optional(),
  service: z.string().min(1, 'Service name is required'),
  vehicle: z.string().optional(), // e.g. "BMW 330i" or "Porsche 911"
  source: z.string().default('walk_in'),
  status: z.string().default('new'),
  notes: z.string().optional(),
});

const vehicleSchema = z.object({
  make: z.string().min(1, 'Car make is required'),
  model: z.string().min(1, 'Car model is required'),
  year: z.union([z.number(), z.string()]).optional(),
  color: z.string().optional(),
  reg_number: z.string().optional(),
  paint_condition: z.string().optional(),
  inspection_notes: z.string().optional(),
});

export async function createPublicLead(req, res) {
  const parsed = publicLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.errors[0].message);
  }

  const { name, phone, service, vehicle, source, notes, status, customerId, vehicleId: providedVehicleId } = parsed.data;

  let customer = null;
  if (customerId) {
    customer = { id: customerId };
  } else {
    if (!name || !phone) {
      throw new ApiError(400, 'Customer name and phone are required for new clients');
    }
    const phoneValidation = validateAndFormatPhone(phone);
    const finalPhone = phoneValidation.isValid ? phoneValidation.cleanPhone : phone;

    customer = await findOrCreateCustomer({
      name,
      phone: finalPhone,
      notes: notes || '',
    });
  }

  let finalVehicleId = providedVehicleId || null;
  if (!finalVehicleId && vehicle && vehicle.trim()) {
    const parts = vehicle.trim().split(/\s+/);
    const make = parts[0] || 'Unknown';
    const model = parts.slice(1).join(' ') || 'Model';
    const newVehicle = await addVehicleToCustomer(customer.id, { make, model });
    finalVehicleId = newVehicle.id;
  }

  const leadSource = source || 'website';

  // Create Lead / Service Job in CRM
  const newLead = await createLead({
    customerId: customer.id,
    vehicleId: finalVehicleId,
    serviceName: service,
    source: leadSource,
    status: status || 'new',
    notes: notes || null,
    customer,
    vehicleDetails: vehicle || null,
  });

  const studioPhone = getStudioPhone();
  const isReInquiry = Boolean(newLead?.isReInquiry || newLead?.is_reinquiry);

  // For website inquiries with customer phone, send auto confirmation WhatsApp message
  if (leadSource === 'website' && customer?.phone) {
    const custConfirmation = isReInquiry
      ? `Hi ${customer.name || 'there'}! 👋\n\n` +
        `We've updated your consultation request with your latest vehicle details for *${service}*.\n` +
        `Our detailing specialist will call you shortly!\n\n` +
        `🤖 _Note: I am an automated bot. For more information or direct assistance, please contact our studio at ${studioPhone}._`
      : `Hi ${customer.name || 'there'}! 👋\n\n` +
        `Thank you for contacting *${getStudioName()}* regarding *${service}*.\n` +
        `Our team will call you shortly to confirm your booking.\n\n` +
        `🤖 _Note: I am an automated bot. For more information or direct assistance, please contact our studio at ${studioPhone}._`;

    sendMetaWhatsAppMessage(customer.phone, custConfirmation).catch((err) =>
      console.warn('[Website Lead WhatsApp Notice]', err.message)
    );
  }

  const responseMsg = isReInquiry
    ? `Welcome back! Your consultation request has been updated with your latest details. For direct contact, reach our studio at ${studioPhone}.`
    : `Service booking submitted successfully. For direct contact, reach our studio at ${studioPhone}.`;

  return createdResponse(res, newLead, responseMsg);
}

export async function listCustomersController(req, res) {
  const { search } = req.query;
  const customers = await listCustomers({ search: search || '' });
  return successResponse(res, customers);
}

export async function listLeads(req, res) {
  const { status, search, limit } = req.query;
  const leads = await getLeads({
    status: status || null,
    search: search || '',
    limit: limit ? parseInt(limit, 10) : 100,
  });

  return successResponse(res, leads);
}

export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    throw new ApiError(400, 'Lead ID and target status are required');
  }

  const updated = await updateLeadStatus(id, status);
  return successResponse(res, updated, `Lead marked as ${status}`);
}

export async function getKPIs(req, res) {
  const metrics = await getPipelineKPIs();
  return successResponse(res, metrics);
}

export async function addCustomerVehicle(req, res) {
  const { id: customerId } = req.params;
  const parsed = vehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.errors[0].message);
  }

  const vehicle = await addVehicleToCustomer(customerId, parsed.data);
  return createdResponse(res, vehicle, 'Vehicle added to customer profile');
}

export async function updateLeadController(req, res) {
  const { id } = req.params;
  const {
    serviceName,
    status,
    notes,
    scheduledDate,
    customerName,
    phone,
    instagramUsername,
    email,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    vehicleRegNumber,
    paintCondition,
    inspectionNotes,
  } = req.body;

  const leadUpdates = {};
  if (serviceName !== undefined) leadUpdates.service_name = serviceName;
  if (status !== undefined) leadUpdates.status = status;
  if (notes !== undefined) leadUpdates.notes = notes;
  if (scheduledDate !== undefined) leadUpdates.scheduled_date = scheduledDate;

  const updatedLead = await updateLead(id, leadUpdates);

  // If customer updates provided, sync to customer record
  if (updatedLead.customer_id && (customerName || phone || instagramUsername !== undefined || email !== undefined)) {
    const custUpdates = {};
    if (customerName) custUpdates.name = customerName;
    if (phone) custUpdates.phone = phone;
    if (instagramUsername !== undefined) custUpdates.instagram_username = instagramUsername;
    if (email !== undefined) custUpdates.email = email;
    await updateCustomer(updatedLead.customer_id, custUpdates);
    if (updatedLead.customer) Object.assign(updatedLead.customer, custUpdates);
  }

  // If vehicle updates provided
  if (updatedLead.customer_id && (vehicleMake || vehicleModel)) {
    const newVeh = await addVehicleToCustomer(updatedLead.customer_id, {
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor,
      reg_number: vehicleRegNumber,
      paint_condition: paintCondition,
      inspection_notes: inspectionNotes,
    });
    await updateLead(id, { vehicle_id: newVeh.id });
    updatedLead.vehicle = newVeh;
  }

  return successResponse(res, updatedLead, 'Lead updated successfully');
}

export async function deleteLeadController(req, res) {
  const { id } = req.params;
  await deleteLead(id);
  return successResponse(res, { id, deleted: true }, 'Lead deleted successfully');
}

export async function updateCustomerController(req, res) {
  const { id } = req.params;
  const updated = await updateCustomer(id, req.body);
  return successResponse(res, updated, 'Customer updated successfully');
}

export async function getCustomerActivitiesController(req, res) {
  const { id } = req.params;
  const activities = await getCustomerActivities(id);
  return successResponse(res, activities);
}

export async function addCustomerActivityController(req, res) {
  const { id } = req.params;
  const activity = await addCustomerActivity(id, req.body);
  return successResponse(res, activity, 'Customer activity logged successfully', 201);
}

export async function sendLeadReview(req, res) {
  const { id } = req.params;
  const { customMessage } = req.body || {};

  const lead = await getLeadById(id);
  if (!lead) throw new ApiError(404, 'Lead not found');

  const customerPhone = lead.customer?.phone || lead.phone;
  if (!customerPhone) {
    throw new ApiError(400, 'Customer does not have a phone number on file');
  }

  const cleanPhone = String(customerPhone).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) {
    throw new ApiError(400, 'Invalid phone number');
  }

  // Get review settings
  const reviewSettings = (await getSetting('reviews')) || (await getSetting('google_reviews')) || {};
  const reviewLink = reviewSettings.review_link || 'https://search.google.com/local/writereview?placeid=ChIJey82fSsLGToRc9YiRRlQJ2Q';
  const defaultTemplate =
    "Hi {{customer_name}} 👋 Thank you for choosing Signature Detailing. We hope you loved the service on your {{vehicle_name}}. If you have a minute, we'd really appreciate a review:\n⭐ {{review_link}}\n\nThank you for your trust. - Signature Detailing";
  const template = reviewSettings.template || defaultTemplate;

  const rawName = lead.customer?.name || 'Valued Client';
  const firstName = rawName.split(' ')[0] || rawName;
  const veh = lead.customer?.vehicles?.[0] || lead.vehicle;
  const vehicleDesc = veh ? `${veh.make} ${veh.model}`.trim() : 'vehicle';

  const messageText = (customMessage && customMessage.trim()) || template
    .replace(/\{\{customer_name\}\}/g, firstName)
    .replace(/\{\{vehicle_name\}\}/g, vehicleDesc)
    .replace(/\{\{service\}\}/g, lead.service_name || 'detailing')
    .replace(/\{\{review_link\}\}/g, reviewLink);

  // Dispatch directly to customer WhatsApp via Meta API
  const metaResult = await sendMetaWhatsAppMessage(cleanPhone, messageText);

  // Log in conversation & customer timeline
  const conv = await findOrCreateWhatsAppConversation(lead.customer_id, cleanPhone);
  await logWhatsAppMessage({
    conversationId: conv.id,
    direction: 'outbound',
    senderType: 'agent',
    messageType: 'text',
    content: messageText,
  });

  if (lead.customer_id) {
    try {
      await addCustomerActivity(lead.customer_id, {
        type: 'review_request_sent',
        title: 'Review Request Sent',
        description: `Review request sent to +${cleanPhone} via WhatsApp`,
        channel: 'whatsapp',
      });
    } catch (actErr) {
      console.warn('[Activity Log Warning]', actErr.message);
    }
  }

  return successResponse(res, { dispatched: true, phone: cleanPhone, metaResult }, 'Review sent directly to WhatsApp');
}



