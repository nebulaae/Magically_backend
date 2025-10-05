import bcrypt from "bcrypt";
import crypto from "crypto";
import * as authRepository from "../repository/authRepository";
import { generateToken } from "../../../shared/utils/jwt";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../../shared/scripts/email";

export const registerStep1 = async (email: string) => {
  const existingUser = await authRepository.findUserByEmail(email);
  if (existingUser && existingUser.verified) {
    throw new Error("Email already in use.");
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const hashedOtp = await bcrypt.hash(otp, 10);

  if (existingUser) {
    await authRepository.updateUser(existingUser, {
      otp: hashedOtp,
      otpExpires,
    });
  } else {
    await authRepository.createUser({ email, otp: hashedOtp, otpExpires });
  }

  await sendVerificationEmail(email, otp);
  return { message: "OTP sent to your email." };
};

export const registerStep2 = async (email: string, otp: string) => {
  const user = await authRepository.findUserByEmail(email);
  if (!user || !user.otp || !user.otpExpires) {
    throw new Error("Invalid request. Please try again.");
  }

  if (new Date() > user.otpExpires) {
    throw new Error("OTP has expired.");
  }

  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) {
    throw new Error("Invalid OTP.");
  }

  await authRepository.updateUser(user, {
    verified: true,
    otp: undefined,
    otpExpires: undefined,
  });
  return { message: "Email verified successfully." };
};

export const registerStep3 = async (
  email: string,
  fullname: string,
  username: string,
  password: string,
) => {
  const user = await authRepository.findVerifiedUserByEmail(email);
  if (!user) {
    throw new Error("Email not verified or user not found.");
  }

  const existingUsername = await authRepository.findUserByUsername(username);
  if (existingUsername) {
    throw new Error("Username is already taken.");
  }

  await authRepository.updateUser(user, {
    fullname,
    username,
    password, // Hashed by beforeUpdate hook
  });

  const token = generateToken(user.id);
  const { password: _, ...userResponse } = user.get({ plain: true });

  return { token, user: userResponse };
};

export const login = async (usernameOrEmail: string, password) => {
  const user = await authRepository.findUserForLogin(usernameOrEmail);

  if (!user || !(await user.comparePassword(password))) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user.id);
  const { password: _, ...userResponse } = user.get({ plain: true });
  return { token, user: userResponse };
};

export const getMe = async (userId: string) => {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const { password: _, ...userResponse } = user.get({ plain: true });
  return { user: userResponse };
};

export const handleForgotPassword = async (email: string) => {
  const user = await authRepository.findVerifiedUserByEmail(email);
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await authRepository.updateUser(user, {
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: expires,
    });
    await sendPasswordResetEmail(user.email, resetToken);
  }
  return {
    message:
      "If a user with that email exists, a password reset link has been sent.",
  };
};

export const resetPassword = async (token: string, newPassword) => {
  const users = await authRepository.findUsersWithActiveResetTokens();
  let userToUpdate = null;

  for (const user of users) {
    if (
      user.passwordResetToken &&
      (await bcrypt.compare(token, user.passwordResetToken))
    ) {
      userToUpdate = user;
      break;
    }
  }

  if (!userToUpdate) {
    throw new Error("Token is invalid or has expired.");
  }

  await authRepository.updateUser(userToUpdate, {
    password: newPassword, // Will be hashed by hook
    passwordResetToken: undefined,
    passwordResetTokenExpires: undefined,
  });

  return { message: "Password has been reset successfully." };
};
