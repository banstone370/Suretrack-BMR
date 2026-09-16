import { Router } from 'express';
import * as auditController from '../controllers/auditController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('audit:view'), auditController.listAuditLogs);

export default router;
