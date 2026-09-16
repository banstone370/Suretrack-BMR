import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Role } from '../types/enums.js';
import { AuthUser } from '../types/express.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  sub: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
}

export function signAccessToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpires as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}

export function toAuthUser(payload: TokenPayload): AuthUser {
  return {
    id: payload.sub,
    employeeId: payload.employeeId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  };
}
