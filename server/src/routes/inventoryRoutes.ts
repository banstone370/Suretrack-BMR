import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get(
  '/finished-goods',
  requirePermission('batches:view_all'),
  inventoryController.listFinishedGoods,
);
router.get(
  '/finished-goods/:id',
  requirePermission('batches:view_all'),
  inventoryController.getFinishedGood,
);

export default router;
