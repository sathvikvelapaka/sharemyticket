import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin' | 'system';
  fullName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    
    // Check if user is still active in database
    const user = db.prepare(`
      SELECT id, full_name, email, role, account_status
      FROM users
      WHERE id = ?
    `).get(payload.userId) as { id: string; full_name: string; email: string; role: string; account_status: string } | undefined;

    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    if (user.account_status === 'suspended') {
      res.status(403).json({ error: 'This account has been suspended by administration due to fraud or security review.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as any,
      fullName: user.full_name,
    };
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(allowedRoles: Array<'buyer' | 'seller' | 'admin' | 'system'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access forbidden: Requires role [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}
