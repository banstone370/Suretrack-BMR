import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { ProcessTemplate } from '../models/ProcessTemplate.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';
import { DEFAULT_STAGES, updateProductTemplateSchema } from '../validators/index.js';

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
        docId?: string;
        bmrIssueNo?: string;
        bmrEffectiveDate?: string;
        manufacturingInstruction?: string;
        rawMaterials?: string[];
        manufacturingSteps?: string[];
        sealingModes?: {
          mode: 'paper' | 'tyvek' | 'blister';
          temperatureC: number;
          sopRef: string;
        }[];
        packingType?: 'pouch' | 'blisterTray';
        extraSections?: string[];
        optionalStages?: string[];
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
      rmQcChecks: tpl?.docId
        ? tpl.rmQcChecks ?? []
        : tpl?.rmQcChecks && tpl.rmQcChecks.length > 0
          ? tpl.rmQcChecks
          : DEFAULT_RM_QC,
      ipqcChecks: tpl?.docId
        ? tpl.ipqcChecks ?? []
        : tpl?.ipqcChecks && tpl.ipqcChecks.length > 0
          ? tpl.ipqcChecks
          : DEFAULT_IPQC,
      docId: tpl?.docId,
      bmrIssueNo: tpl?.bmrIssueNo,
      bmrEffectiveDate: tpl?.bmrEffectiveDate,
      manufacturingInstruction: tpl?.manufacturingInstruction,
      rawMaterials: tpl?.rawMaterials?.map((name) => ({ name })),
      manufacturingSteps: tpl?.manufacturingSteps?.map((step) => ({ step })),
      sealingModes: tpl?.sealingModes,
      packingType: tpl?.packingType,
      extraSections: tpl?.extraSections,
      optionalStages: tpl?.optionalStages,
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

export async function updateProductTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    if (!product.processTemplateId) {
      throw new AppError(404, 'NOT_FOUND', 'Process template not configured');
    }
    const template = await ProcessTemplate.findById(product.processTemplateId);
    if (!template) throw new AppError(404, 'NOT_FOUND', 'Process template not found');

    const body = req.body as z.infer<typeof updateProductTemplateSchema>;

    if (body.name !== undefined) template.name = body.name;
    // Set nested paths individually: assigning a plain object to a single-nested
    // path (e.g. template.sealingParams = {...}) makes Mongoose cast every
    // declared subpath, and `allowedRange` currently holds `undefined`, which
    // fails with "Cast to Object failed" on save.
    if (body.sealingTemperatureC !== undefined) {
      template.set('sealingParams.temperatureC', body.sealingTemperatureC);
    }
    if (body.sealingSopRef !== undefined) {
      template.set('sealingParams.sopRef', body.sealingSopRef);
    }
    if (body.sterilizationTemperatureC !== undefined) {
      template.set('sterilizationParams.temperatureC', body.sterilizationTemperatureC);
    }
    if (body.sterilizationDurationHours !== undefined) {
      template.set('sterilizationParams.durationHours', body.sterilizationDurationHours);
    }
    if (body.etoCartridgeGrams !== undefined) {
      template.set('sterilizationParams.etoCartridgeGrams', body.etoCartridgeGrams);
    }
    if (body.sterilizationSopRef !== undefined) {
      template.set('sterilizationParams.sopRef', body.sterilizationSopRef);
    }
    if (body.sterilitySop !== undefined) template.sterilitySop = body.sterilitySop;
    if (body.betSop !== undefined) template.betSop = body.betSop;
    if (body.storageCondition !== undefined) template.storageCondition = body.storageCondition;
    if (body.rmQcChecks !== undefined) template.rmQcChecks = body.rmQcChecks;
    if (body.ipqcChecks !== undefined) template.ipqcChecks = body.ipqcChecks;
    if (body.docId !== undefined) template.docId = body.docId;
    if (body.bmrIssueNo !== undefined) template.bmrIssueNo = body.bmrIssueNo;
    if (body.bmrEffectiveDate !== undefined) template.bmrEffectiveDate = body.bmrEffectiveDate;
    if (body.manufacturingInstruction !== undefined) {
      template.manufacturingInstruction = body.manufacturingInstruction;
    }
    if (body.rawMaterials !== undefined) {
      template.rawMaterials = body.rawMaterials.map((name) => ({ name }));
    }
    if (body.manufacturingSteps !== undefined) {
      template.manufacturingSteps = body.manufacturingSteps.map((step) => ({ step }));
    }
    if (body.sealingModes !== undefined) template.sealingModes = body.sealingModes;
    if (body.packingType !== undefined) template.packingType = body.packingType;
    if (body.extraSections !== undefined) template.extraSections = body.extraSections;
    if (body.optionalStages !== undefined) template.optionalStages = body.optionalStages;
    if (body.sections !== undefined) {
      template.sections = body.sections.map((section) => ({
        key: section.key,
        title: section.title?.trim() || undefined,
        instructions: (section.instructions ?? []).map((line) => line.trim()).filter(Boolean),
        enabled: section.enabled !== false,
      }));
      // Keep the legacy extraSections flag in sync with the ordered section list
      // so older readers (and the batch snapshot) stay accurate.
      template.extraSections = template.sections
        .filter(
          (section) =>
            section.enabled !== false &&
            (section.key === 'CONTROL_SAMPLE' || section.key === 'LABEL_OF_PRODUCT'),
        )
        .map((section) => section.key);
    }

    await template.save();

    await writeAudit({
      actor: req.user,
      action: 'UPDATE_PRODUCT_TEMPLATE',
      entityType: 'ProcessTemplate',
      entityId: template.id,
      newValue: template.toObject(),
      req,
    });

    res.json(ok(template));
  } catch (err) {
    next(err);
  }
}
