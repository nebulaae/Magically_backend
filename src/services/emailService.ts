import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

// Reusable transporter object using credentials from .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- Send Verification OTP Email ---
export const sendVerificationEmail = async (to: string, otp: string) => {
    const mailOptions = {
        from: 'Volshebny no-reply',
        to,
        subject: 'Email Verification',
        html: `
        <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px;">
                <h2 style="color: #3a3a3a; margin-bottom: 16px;">Email Verification</h2>
                <p style="color: #444; font-size: 16px; margin-bottom: 24px;">
                    Your verification code is below. It will expire in 10 minutes.
                </p>
                <div style="display: flex; align-items: center; justify-content: center; height: 4rem; background: oklch(87% 0 0); margin-bottom: 24px;">
                    <span style="font-weight: 800; letter-spacing: 2px; font-size: 20px;">${otp}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                <p style="color: #bbb; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} Volshebny bot. All rights reserved.
                </p>
            </div>
        </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent to', to);
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
};

// --- Send Password Reset Email ---
export const sendPasswordResetEmail = async (to: string, token: string) => {
    const resetUrl = `http://localhost:3000/reset-password/${token}`;

    const mailOptions = {
        from: 'Volshebny no-reply',
        to,
        subject: 'Password Reset Request',
        html: `
        <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px;">
                <h2 style="color: #3a3a3a; margin-bottom: 16px;">Password Reset Request</h2>
                <p style="color: #444; font-size: 16px; margin-bottom: 24px;">
                    We received a request to reset your password. Click the button below to set a new password. If you did not request this, you can safely ignore this email.
                </p>
                <a href="${resetUrl}" 
                   style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #6a5af9 0%, #7b8cff 100%); color: #fff; font-weight: bold; border-radius: 6px; text-decoration: none; font-size: 16px; margin-bottom: 24px;">
                    Reset Password
                </a>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">
                    If the button above does not work, copy and paste this link into your browser:<br>
                    <span style="color: #6a5af9;">${resetUrl}</span>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                <p style="color: #bbb; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} Volshebny bot. All rights reserved.
                </p>
            </div>
        </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent to', to);
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
};