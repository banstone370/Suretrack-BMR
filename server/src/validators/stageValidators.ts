import { z } from 'zod';

export const signatureSchema = z.object({
  password: z.string().min(1, 'Password is required for electronic signature'),
  statement: z.string().optional(),
});

export const stageSaveSchema = z.object({
  payload: z.record(z.unknown()).optional(),
}).passthrough();

export const stageSubmitSchema = z.object({
  payload: z.record(z.unknown()),
  signature: signatureSchema,
  reason: z.string().optional(),
});

export const stageApproveSchema = z.object({
  signature: signatureSchema,
  reason: z.string().optional(),
});

export const stageRejectSchema = z.object({
  signature: signatureSchema,
  reason: z.string().min(1, 'Rejection reason is required'),
  decision: z.enum(['REJECTED', 'HOLD']).optional(),
});
