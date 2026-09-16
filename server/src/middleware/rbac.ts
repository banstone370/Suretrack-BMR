import { NextFunction, Request, Response } from 'express';
import { Permission } from '../types/enums.js';
import { AppError } from '../utils/errors.js';
import { hasPermission } from '../workflow/permissions.js';

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    const allowed = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!allowed) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }
    return next();
  };
}
