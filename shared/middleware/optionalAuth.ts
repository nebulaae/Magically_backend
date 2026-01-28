import { verifyToken } from '../utils/jwt';
import { User } from '../../src/user/models/User';
import { Request, Response, NextFunction } from 'express';

// Optional auth middleware - doesn't fail if no token present
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

    // If no token, just continue without user
    if (!token) {
      req.user = null;
      next();
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      req.user = null;
      next();
      return;
    }

    const user = await User.findByPk(decoded.id);
    req.user = user || null;
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};
