import { getAllServices, upsertService, deleteService } from '../services/settings.service.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

export async function getServices(req, res) {
  const services = await getAllServices();
  return successResponse(res, services);
}

export async function createOrUpdateService(req, res) {
  const { name, short_code, tagline, description, is_active, order_index, id } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Service package name is required');
  }

  const service = await upsertService({
    id,
    name: name.trim(),
    short_code,
    tagline,
    description,
    is_active: is_active !== false,
    order_index: order_index || 0,
  });

  return createdResponse(res, service, 'Service package saved successfully');
}

export async function removeService(req, res) {
  const { id } = req.params;
  if (!id) throw new ApiError(400, 'Service ID is required');

  await deleteService(id);
  return successResponse(res, { id }, 'Service deleted successfully');
}

