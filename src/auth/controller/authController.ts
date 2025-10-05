import logger from "../../../shared/utils/logger";
import * as authService from "../service/authService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import { Request, Response } from "express";

export const registerStep1 = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return apiResponse.badRequest(res, "Email is required.");
    }
    const result = await authService.registerStep1(email);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Register step 1 error: ${error.message}`);
    apiResponse.badRequest(res, error.message);
  }
};

export const registerStep2 = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return apiResponse.badRequest(res, "Email and OTP are required.");
    }
    const result = await authService.registerStep2(email, otp);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Register step 2 error: ${error.message}`);
    apiResponse.badRequest(res, error.message);
  }
};

export const registerStep3 = async (req: Request, res: Response) => {
  try {
    const { email, fullname, username, password } = req.body;
    if (!email || !fullname || !username || !password) {
      return apiResponse.badRequest(res, "All fields are required.");
    }
    const result = await authService.registerStep3(
      email,
      fullname,
      username,
      password,
    );
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    apiResponse.success(res, result, "Registration successful.", 201);
  } catch (error) {
    logger.error(`Register step 3 error: ${error.message}`);
    apiResponse.badRequest(res, error.message);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const result = await authService.login(usernameOrEmail, password);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    apiResponse.success(res, result, "Login successful.");
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    apiResponse.unauthorized(res, error.message);
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("token");
  apiResponse.success(res, null, "Successfully logged out.");
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const result = await authService.getMe(req.user.id);
    apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`);
    apiResponse.notFound(res, error.message);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return apiResponse.badRequest(res, "Email is required.");
    }
    const result = await authService.handleForgotPassword(email);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Forgot Password Error: ${error.message}`);
    apiResponse.internalError(
      res,
      "Server error during password forgot process.",
    );
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) {
      return apiResponse.badRequest(res, "Password is required.");
    }
    const result = await authService.resetPassword(token, password);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Reset Password Error: ${error.message}`);
    apiResponse.badRequest(res, error.message);
  }
};
