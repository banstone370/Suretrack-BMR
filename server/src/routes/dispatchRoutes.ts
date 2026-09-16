import { Router } from 'express';
import * as dispatchController from '../controllers/dispatchController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('batches:view_all'), dispatchController.listDispatches);
router.post('/', requirePermission('dispatch:create'), dispatchController.createDispatch);
router.post(
  '/:id/confirm',
  requirePermission('dispatch:confirm'),
  dispatchController.confirmDispatch,
);
router.post(
  '/:id/cancel',
  requirePermission('dispatch:create'),
  dispatchController.cancelDispatch,
);

export default router;
