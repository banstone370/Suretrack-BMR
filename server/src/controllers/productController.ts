import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product.js';
import { ProcessTemplate } from '../models/ProcessTemplate.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';
import { DEFAULT_STAGES } from '../validators/index.js';

const DEFAULT_RM_QC = [
  'Hub checking',
  'Bevel checking',
  'Guide wire passing',
  'Visual inspection for dust, burrs and foreign particles',
];

const DEFAULT_IPQC = ['Dust free', 'Burr free', 'Foreign particle free'];

export async function listProducts(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await Product.find({ isActive: true })
      .populate('processTemplateId')
      .sort({ name: 1 });
    res.json(ok(products));
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await Product.findById(req.params.id).populate('processTemplateId');
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    res.json(ok(product));
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      name: string;
      catalogueNo: string;
      description?: string;
      defaultBatchSize?: number;
      shelfLifeMonths: number;
      processTemplate?: {
        name?: string;
        sealingTemperatureC: number;
        sealingSopRef: string;
        sterilizationTemperatureC: number;
        sterilizationDurationHours: number;
        etoCartridgeGrams: number;
        sterilizationSopRef: string;
        sterilitySop: string;
        betSop: string;
        storageCondition: string;
        rmQcChecks?: string[];
        ipqcChecks?: string[];
      };
    };

    const existing = await Product.findOne({
      catalogueNo: body.catalogueNo.trim().toUpperCase(),
    });
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Catalogue number already exists');
    }

    const tpl = body.processTemplate;
    const template = await ProcessTemplate.create({
      name: tpl?.name?.trim() || `${body.name.trim()} BMR Template`,
      version: 1,
      stages: DEFAULT_STAGES,
      sealingParams: {
        temperatureC: tpl?.sealingTemperatureC ?? 200,
        sopRef: tpl?.sealingSopRef ?? 'SOP/MF/011',
      },
      sterilizationParams: {
        temperatureC: tpl?.sterilizationTemperatureC ?? 55,
        durationHours: tpl?.sterilizationDurationHours ?? 4,
        etoCartridgeGrams: tpl?.etoCartridgeGrams ?? 40,
        sopRef: tpl?.sterilizationSopRef ?? 'SOP/MF/008',
      },
      sterilitySop: tpl?.sterilitySop ?? 'SOP/QC/004',
      betSop: tpl?.betSop ?? 'SOP/QC/005',
      storageCondition: tpl?.storageCondition ?? 'Store at Room Temperature',
      rmQcChecks:
        tpl?.rmQcChecks && tpl.rmQcChecks.length > 0 ? tpl.rmQcChecks : DEFAULT_RM_QC,
      ipqcChecks:
        tpl?.ipqcChecks && tpl.ipqcChecks.length > 0 ? tpl.ipqcChecks : DEFAULT_IPQC,
      isActive: true,
    });

    const product = await Product.create({
      name: body.name.trim(),
      catalogueNo: body.catalogueNo.trim().toUpperCase(),
      description: body.description?.trim(),
      defaultBatchSize: body.defaultBatchSize,
      shelfLifeMonths: body.shelfLifeMonths,
      processTemplateId: template._id,
      isActive: true,
    });

    template.productId = product._id;
    await template.save();

    await writeAudit({
      actor: req.user,
      action: 'CREATE_PRODUCT',
      entityType: 'Product',
      entityId: product.id,
      newValue: {
        ...product.toObject(),
        processTemplateId: template.id,
      },
      req,
    });

    const populated = await Product.findById(product.id).populate('processTemplateId');
    res.status(201).json(ok(populated));
  } catch (err) {
    next(err);
  }
}

export async function getProductTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    if (!product.processTemplateId) {
      throw new AppError(404, 'NOT_FOUND', 'Process template not configured');
    }
    const template = await ProcessTemplate.findById(product.processTemplateId);
    if (!template) throw new AppError(404, 'NOT_FOUND', 'Process template not found');
    res.json(ok(template));
  } catch (err) {
    next(err);
  }
}
