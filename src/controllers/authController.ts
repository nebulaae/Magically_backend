import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { Op } from 'sequelize';
import { User } from '../models/User';
import { Request, Response } from 'express';
import { generateToken } from '../services/authService';
import { sendVerificationEmail } from '../services/emailService';
import { handleForgotPassword } from '../services/passwordService';

// --- Step 1: Register Email and Send OTP ---
export const registerStep1 = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser && existingUser.verified) {
            return res.status(400).json({ message: 'Email already in use.' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const hashedOtp = await bcrypt.hash(otp, 10);

        if (existingUser) {
            existingUser.otp = hashedOtp;
            existingUser.otpExpires = otpExpires;
            await existingUser.save();
        } else {
            await User.create({ email, otp: hashedOtp, otpExpires });
        }

        await sendVerificationEmail(email, otp);
        return res.status(200).json({ message: 'OTP sent to your email.' });

    } catch (error) {
        console.error('Register Step 1 Error:', error);
        return res.status(500).json({ message: 'Server error during registration step 1.' });
    }
};

// --- Step 2: Verify OTP ---
export const registerStep2 = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required.' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user || !user.otp || !user.otpExpires) {
            return res.status(400).json({ message: 'Invalid request. Please try again.' });
        }

        if (new Date() > user.otpExpires) {
            return res.status(400).json({ message: 'OTP has expired.' });
        }

        const isMatch = await bcrypt.compare(otp, user.otp);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        user.verified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        return res.status(200).json({ message: 'Email verified successfully.' });

    } catch (error) {
        console.error('Register Step 2 Error:', error);
        return res.status(500).json({ message: 'Server error during OTP verification.' });
    }
};

// --- Step 3: Complete Registration ---
export const registerStep3 = async (req: Request, res: Response) => {
    try {
        const { email, fullname, username, password } = req.body;
        if (!email || !fullname || !username || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const user = await User.findOne({ where: { email, verified: true } });
        if (!user) {
            return res.status(400).json({ message: 'Email not verified or user not found.' });
        }

        const existingUsername = await User.findOne({ where: { username } });
        if (existingUsername) {
            return res.status(400).json({ message: 'Username is already taken.' });
        }

        user.fullname = fullname;
        user.username = username;
        user.password = password; // Hashed by beforeUpdate hook
        await user.save();

        const token = generateToken(user.id);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });

        const { password: _, ...userResponse } = user.get({ plain: true });
        return res.status(201).json({ token, user: userResponse });

    } catch (error) {
        console.error('Register Step 3 Error:', error);
        return res.status(500).json({ message: 'Server error during final registration step.' });
    }
};

// --- Login User ---
export const login = async (req: Request, res: Response) => {
    try {
        const { usernameOrEmail, password } = req.body;

        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username: usernameOrEmail },
                    { email: usernameOrEmail },
                ],
            },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken(user.id);

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 365 * 24 * 60 * 60 * 1000 // 365 days
        });

        // Exclude password from the response
        const { password: _, ...userResponse } = user.get({ plain: true });

        return res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login' });
    }
};

// --- Logout User ---
export const logout = (req: Request, res: Response) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
};

// --- Get Current User ---
export const getMe = async (req: Request, res: Response) => {
    try {
        // req.user is attached by the auth middleware
        const user = req.user;

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Exclude password from the response
        const { password, ...userResponse } = user.get({ plain: true });

        return res.json({
            user: userResponse
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// --- Forgot Password Controller ---
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }
        await handleForgotPassword(email);
        return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return res.status(500).json({ message: 'Server error during forgot password process.' });
    }
};

// --- Reset Password Controller ---
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: "Password is required." });
        }

        const users = await User.findAll({
            where: {
                passwordResetTokenExpires: { [Op.gt]: new Date() }
            }
        });

        let userToUpdate: User | null = null;
        for (const user of users) {
            if (user.passwordResetToken && await bcrypt.compare(token, user.passwordResetToken)) {
                userToUpdate = user;
                break;
            }
        }

        if (!userToUpdate) {
            return res.status(400).json({ message: 'Token is invalid or has expired.' });
        }

        userToUpdate.password = password; // Will be hashed by hook
        userToUpdate.passwordResetToken = undefined;
        userToUpdate.passwordResetTokenExpires = undefined;
        await userToUpdate.save();

        return res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return res.status(500).json({ message: 'Server error during password reset.' });
    }
};