import { Router } from 'express';
import {
  createPublicLead,
  listLeads,
  updateStatus,
  getKPIs,
  addCustomerVehicle,
  updateLeadController,
  deleteLeadController,
  updateCustomerController,
  listCustomersController,
  getCustomerActivitiesController,
  addCustomerActivityController,
  sendLeadReview,
} from '../controllers/lead.controller.js';

const router = Router();

// Public website form ingestion
router.post('/', createPublicLead);
router.post('/website', createPublicLead);

// Informational health check for browser GET requests
router.get('/website', (req, res) => {
  return res.status(200).json({
    status: 'online',
    system: 'Signature Detailing Lead Ingestion API',
    endpoint: '/api/leads/website',
    method: 'POST',
    message: 'Endpoint is active and ready to receive lead submissions from the website.',
    expected_payload: {
      name: 'Customer full name (string, required)',
      phone: 'Mobile or WhatsApp number (string, required)',
      service: 'Service of interest (string, default: "Paint Protection Film")',
      vehicle: 'Car make and model (string, optional)',
      notes: 'Customer notes or requests (string, optional)',
      source: 'website'
    }
  });
});

// CRM Lead Management
router.get('/', listLeads);
router.get('/kpis', getKPIs);
router.get('/customers', listCustomersController);
router.patch('/:id/status', updateStatus);
router.patch('/:id', updateLeadController);
router.delete('/:id', deleteLeadController);
router.post('/:id/review', sendLeadReview);

// Customer Updates, Vehicle Addition & Activities
router.patch('/customers/:id', updateCustomerController);
router.post('/customers/:id/vehicles', addCustomerVehicle);
router.get('/customers/:id/activities', getCustomerActivitiesController);
router.post('/customers/:id/activities', addCustomerActivityController);

export default router;

