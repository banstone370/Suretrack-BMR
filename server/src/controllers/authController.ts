import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  toAuthUser,
  verifyPassword,
  verifyRefreshToken,
} from '../utils/authTokens.js';
import { permissionsForRole } from '../workflow/permissions.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const authUser = {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);

    await writeAudit({
      actor: authUser,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      req,
    });

    res.json(
      ok({
        accessToken,
        refreshToken,
        user: {
          ...authUser,
          permissions: permissionsForRole(user.role),
        },
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new AppError(400, 'VALIDATION_ERROR', 'refreshToken is required');
    }
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');
    }
    const authUser = toAuthUser({
      sub: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.json(
      ok({
        accessToken: signAccessToken(authUser),
        refreshToken: signRefreshToken(authUser),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    res.json(
      ok({
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        permissions: permissionsForRole(user.role),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(ok(users));
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      employeeId: string;
      name: string;
      email: string;
      password: string;
      role: string;
      department?: string;
    };
    const exists = await User.findOne({
      $or: [{ email: body.email.toLowerCase() }, { employeeId: body.employeeId }],
    });
    if (exists) {
      throw new AppError(409, 'CONFLICT', 'Email or employee ID already exists');
    }
    const user = await User.create({
      employeeId: body.employeeId,
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role: body.role,
      department: body.department,
    });

    await writeAudit({
      actor: req.user,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
      req,
    });

    res.status(201).json(
      ok({
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const body = req.body as {
      name?: string;
      email?: string;
      role?: string;
      department?: string;
      password?: string;
      isActive?: boolean;
    };

    const old = {
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
    };

    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) user.email = body.email.toLowerCase();
    if (body.role !== undefined) user.role = body.role as typeof user.role;
    if (body.department !== undefined) user.department = body.department;
    if (body.isActive !== undefined) user.isActive = body.isActive;
    if (body.password) user.passwordHash = await hashPassword(body.password);

    await user.save();

    await writeAudit({
      actor: req.user,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: user.id,
      oldValue: old,
      newValue: {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      },
      req,
    });

    res.json(
      ok({
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    user.isActive = false;
    await user.save();
    await writeAudit({
      actor: req.user,
      action: 'DEACTIVATE_USER',
      entityType: 'User',
      entityId: user.id,
      req,
    });
    res.json(ok({ id: user.id, isActive: false }));
  } catch (err) {
    next(err);
  }
}
