import { Response, NextFunction } from 'express';
import { AuthRequest } from '../utils/types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

type AllowedRole = 'patient' | 'doctor' | 'department_head';

export const rbac = (...allowedRoles: AllowedRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRole = req.user.role;
    
    // department_head inherits doctor permissions
    const effectiveRoles: AllowedRole[] = [userRole];
    if (userRole === 'department_head') {
      effectiveRoles.push('doctor');
    }

    const hasAccess = allowedRoles.some((role) => effectiveRoles.includes(role));
    if (!hasAccess) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};
