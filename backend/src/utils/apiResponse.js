export function successResponse(res, data, message = 'Success', statusCode = 200, meta = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  });
}

export function createdResponse(res, data, message = 'Resource created successfully') {
  return successResponse(res, data, message, 201);
}

