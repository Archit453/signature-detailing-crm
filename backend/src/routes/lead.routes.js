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

