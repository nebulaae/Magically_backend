import { Request, Response, NextFunction } from "express";

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Admin access required." });
  }
};
