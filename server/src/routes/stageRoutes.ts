import { Router } from 'express';
import * as stageController from '../controllers/stageController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import {
  stageApproveSchema,
  stageRejectSchema,
  stageSubmitSchema,
} from '../validators/stageValidators.js';

const STAGE_SLUGS =
  'raw-material-qc|raw-material-consumption|manufacturing|in-process-qc|visual-inspection|packing|sealing|sterilization|labelling|sterility|bet|qa|finished-goods';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get(
  `/:stage(${STAGE_SLUGS})`,
  requirePermission('batches:view_all'),
  stageController.getStage,
);

router.put(
  `/:stage(${STAGE_SLUGS})`,
  requirePermission('batches:view_all'),
  stageController.saveStage,
);

router.post(
  `/:stage(${STAGE_SLUGS})/submit`,
  requirePermission('batches:view_all'),
  validateBody(stageSubmitSchema),
  stageController.submitStage,
);

router.post(
  `/:stage(${STAGE_SLUGS})/approve`,
  requirePermission('batches:view_all'),
  validateBody(stageApproveSchema),
  stageController.approveStage,
);

router.post(
  `/:stage(${STAGE_SLUGS})/reject`,
  requirePermission('batches:view_all'),
  validateBody(stageRejectSchema),
  stageController.rejectStage,
);

export default router;
