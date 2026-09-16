import { Router } from 'express';
import * as dispatchController from '../controllers/dispatchController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('batches:view_all'), dispatchController.listCustomers);
router.post('/', requirePermission('dispatch:create'), dispatchController.createCustomer);

export default router;
