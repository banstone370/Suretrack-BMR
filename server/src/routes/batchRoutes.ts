import { Router } from 'express';
import * as batchController from '../controllers/batchController.js';
import * as lifecycle from '../controllers/batchLifecycleController.js';
import * as attachmentController from '../controllers/attachmentController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createBatchSchema, updateBatchDraftSchema } from '../validators/index.js';
import stageRoutes from './stageRoutes.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('batches:view_all'), batchController.listBatches);
router.post(
  '/',
  requirePermission('batches:create'),
  validateBody(createBatchSchema),
  batchController.createBatch,
);
router.get('/:batchId', requirePermission('batches:view_all'), batchController.getBatch);
router.patch(
  '/:batchId',
  requirePermission('batches:edit_production'),
  validateBody(updateBatchDraftSchema),
  batchController.updateBatchDraft,
);
router.post(
  '/:batchId/start',
  requirePermission('batches:submit_production'),
  batchController.startBatch,
);
router.post('/:batchId/hold', lifecycle.holdBatch);
router.post('/:batchId/resume', lifecycle.resumeBatch);
router.post('/:batchId/cancel', lifecycle.cancelBatch);
router.post('/:batchId/archive', lifecycle.archiveBatch);
router.get('/:batchId/corrections', lifecycle.listBatchCorrections);
router.post(
  '/:batchId/corrections',
  requirePermission('batch:request_correction'),
  lifecycle.createCorrection,
);
router.post('/:batchId/corrections/:correctionId/resolve', lifecycle.resolveCorrectionHandler);
router.get(
  '/:batchId/timeline',
  requirePermission('batches:view_all'),
  batchController.getBatchTimeline,
);
router.get(
  '/:batchId/audit',
  requirePermission('batches:view_all'),
  batchController.getBatchAudit,
);
router.get(
  '/:batchId/pdf',
  requirePermission('pdf:generate'),
  batchController.getBatchPdf,
);
router.get(
  '/:batchId/attachments',
  requirePermission('batches:view_all'),
  attachmentController.listBatchAttachments,
);
router.post(
  '/:batchId/attachments',
  requirePermission('batches:view_all'),
  attachmentController.upload.single('file'),
  attachmentController.uploadBatchAttachment,
);

router.use('/:batchId', stageRoutes);

export default router;
