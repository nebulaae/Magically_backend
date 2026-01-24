import express from "express";
import passport from "passport";
import * as authController from "./controller/authController";

import { auth } from "../../shared/middleware/auth";
import { generateToken } from "../../shared/utils/jwt";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

// Multistep registration routes
router.post("/register-step-1", asyncHandler(authController.registerStep1));
router.post("/register-step-2", asyncHandler(authController.registerStep2));
router.post("/register-step-3", asyncHandler(authController.registerStep3));

// Telegram auth
router.post(
  "/telegram/webapp",
  asyncHandler(authController.telegramWebAppAuth)
);

router.post(
  "/telegram/widget",
  asyncHandler(authController.telegramWidgetAuth)
);

// Login user
router.post("/login", asyncHandler(authController.login));

// Logout user
router.post("/logout", asyncHandler(authController.logout));

// Get current authenticated user
router.get("/me", auth, asyncHandler(authController.getMe));

// Password Management
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post(
  "/reset-password/:token",
  asyncHandler(authController.resetPassword),
);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken(user.id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    res.redirect(process.env.FRONTEND_URL!);
  }
);

export default router;
