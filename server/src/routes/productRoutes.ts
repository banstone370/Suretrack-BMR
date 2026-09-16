import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createProductSchema } from '../validators/index.js';

const router = Router();

router.use(requireAuth);

router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);
router.get('/:id/template', productController.getProductTemplate);
router.post(
  '/',
  requirePermission('products:manage'),
  validateBody(createProductSchema),
  productController.createProduct,
);

export default router;
