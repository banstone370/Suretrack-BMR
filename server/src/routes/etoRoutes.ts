import { Router } from 'express';
import * as etoController from '../controllers/etoController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('batches:view_all'), etoController.listCartridges);
router.post(
  '/',
  requirePermission('eto_cartridge:manage'),
  etoController.createCartridge,
);

export default router;
