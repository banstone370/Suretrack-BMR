import { Router } from 'express';
import * as attachmentController from '../controllers/attachmentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/:id/download', attachmentController.downloadAttachment);

export default router;
