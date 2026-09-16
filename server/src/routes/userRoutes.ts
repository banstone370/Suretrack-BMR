import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createUserSchema } from '../validators/index.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('users:manage'));

router.get('/', authController.listUsers);
router.post('/', validateBody(createUserSchema), authController.createUser);
router.patch('/:id', authController.updateUser);
router.post('/:id/deactivate', authController.deactivateUser);

export default router;
