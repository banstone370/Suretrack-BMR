import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { toAuthUser, verifyAccessToken } from '../utils/authTokens.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = toAuthUser(payload);
    return next();
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
