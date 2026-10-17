import { Router } from 'express';
import { getServices, createOrUpdateService, removeService } from '../controllers/service.controller.js';

const router = Router();

router.get('/', getServices);
router.post('/', createOrUpdateService);
router.delete('/:id', removeService);

export default router;

