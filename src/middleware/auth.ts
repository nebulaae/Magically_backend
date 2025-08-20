import { User } from '../models/User';
import { verifyToken } from '../services/authService';
import { Request, Response, NextFunction } from 'express';

// Extending Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        } 
    }
}

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }

        const user = await User.findByPk(decoded.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ message: 'Authentication failed' });
    }
};