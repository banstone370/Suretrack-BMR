import { Role } from './enums.js';

export interface AuthUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
