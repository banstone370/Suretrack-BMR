import { Router } from 'express';
import * as reportsController from '../controllers/reportsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get('/:type', requirePermission('reports:view'), reportsController.getReport);

export default router;
