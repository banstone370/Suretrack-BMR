import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/', requirePermission('system:configure'), settingsController.updateSettings);

export default router;
