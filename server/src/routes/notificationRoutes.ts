import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', settingsController.listNotifications);
router.get('/pending', settingsController.pendingInbox);
router.post('/read-all', settingsController.readAllNotifications);
router.patch('/:id/read', settingsController.readNotification);

export default router;
