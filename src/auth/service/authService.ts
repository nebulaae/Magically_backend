import bcrypt from "bcrypt";
import crypto from "crypto";
import * as authRepository from "../repository/authRepository";
import { generateToken } from "../../../shared/utils/jwt";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../../shared/scripts/email";
import { User } from "../../user/models/User";

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
  if (!username || username.trim().length === 0) {
    throw new Error("Username is required.");
  }

  const user = await authRepository.findVerifiedUserByEmail(email);
  if (!user) {
    throw new Error("Email not verified or user not found.");
  }

  const existingUsername = await authRepository.findUserByUsername(username);

  if (existingUsername && existingUsername.id !== user.id) {
    throw new Error("Username is already taken.");
  }

  await authRepository.updateUser(user, {
    fullname,
    username,
    password,
  });

  const token = generateToken(user.id);
  const { password: _, ...userResponse } = user.get({ plain: true });

  return { token, user: userResponse };
};

export const telegramLogin = async (telegramUser: any) => {
  let user = await User.findOne({ where: { telegramId: String(telegramUser.id) } });

  if (!user) {
    if (telegramUser.username) {
      user = await User.findOne({ where: { username: telegramUser.username } });
      if (user) {
        user.telegramId = String(telegramUser.id);
        await user.save();
        const token = generateToken(user.id);
        const { password: _, ...userResponse } = user.get({ plain: true });
        return { token, user: userResponse };
      }
    }

    let baseUsername = telegramUser.username || `tg_${telegramUser.id}`;
    baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 28);

    let finalUsername = baseUsername;
    let counter = 1;
    while (await User.findOne({ where: { username: finalUsername } })) {
      finalUsername = `${baseUsername}_${counter}`;
      counter++;
      if (counter > 100) throw new Error("Cannot generate unique username");
    }

    let fullname = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
    fullname = fullname.slice(0, 120);

    user = await User.create({
      fullname: fullname || 'Telegram User',
      username: finalUsername,
      email: `tg_${telegramUser.id}@volshebny.bot`,
      telegramId: String(telegramUser.id),
      verified: true,
      role: 'user',
      tokens: 50,
      dailyActions: { count: 0, lastReset: new Date() },
      password: null,
    });
  }

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
