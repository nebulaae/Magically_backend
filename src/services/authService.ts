import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

// Configs
const JWT_EXPIRES_IN = '365d';
const JWT_SECRET = process.env.JWT_SECRET;

// Generate token
export const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// Verify token
export const verifyToken = (token: string): { id: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string };
  } catch (error) {
    return null;
  }
};