import { Router } from 'express';
import * as sopController from '../controllers/sopController.js';
import * as attachmentController from '../controllers/attachmentController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('batches:view_all'), sopController.listSops);
router.post('/', requirePermission('sops:manage'), sopController.createSop);
router.patch('/:id', requirePermission('sops:manage'), sopController.updateSop);
router.post(
  '/:id/document',
  requirePermission('sops:manage'),
  attachmentController.upload.single('file'),
  attachmentController.uploadSopDocument,
);

export default router;
