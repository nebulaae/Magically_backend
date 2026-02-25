import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { Admin } from '../../src/admin/models/Admin';

export const adminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies.admin_token ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'Admin authentication required' });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ message: 'Invalid admin token' });
      return;
    }

    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      res.status(403).json({ message: 'Forbidden: Admin access required.' });
      return;
    }

    req.user = admin; // Сохраняем админа в req.user
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};
