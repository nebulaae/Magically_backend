import dotenv from "dotenv";
import nodemailer from "nodemailer";
import logger from "../utils/logger";

dotenv.config();

// Reusable transporter object using credentials from .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- Send Verification OTP Email ---
export const sendVerificationEmail = async (to: string, otp: string) => {
  const mailOptions = {
    from: "Volshebny no-reply",
    to,
    subject: "Верификация почты",
    html: `
        <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px;">
                <h2 style="color: #3a3a3a; margin-bottom: 16px;">Верификация почты</h2>
                <p style="color: #444; font-size: 16px; margin-bottom: 24px;">
                    Ваш код верификации. Он будет активным в течении 10 минут после получения.
                </p>
                <div style="display: flex; align-items: center; justify-content: center; height: 4rem; background: oklch(87% 0 0); margin-bottom: 24px;">
                    <span style="font-weight: 800; letter-spacing: 2px; font-size: 20px;">${otp}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                <p style="color: #bbb; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} Volshebny bot. Все права сохранены.
                </p>
            </div>
        </div>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to: ${to}`);
  } catch (error) {
    logger.error(`Error sending verification email: ${error.message}`);
  }
};

// --- Send Password Reset Email ---
export const sendPasswordResetEmail = async (to: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: "Volshebny no-reply",
    to,
    subject: "Запрос на восстановление пароля",
    html: `
        <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px;">
                <h2 style="color: #3a3a3a; margin-bottom: 16px;">Запрос на восстановление пароля</h2>
                <p style="color: #444; font-size: 16px; margin-bottom: 24px;">
                    Мы получили запрос на восстановление пароля. Нажмите на кнопку и создайте пароль. Если вы не запрашивали, вы можете игнорировать данное сообщение.
                </p>
                <a href="${resetUrl}" 
                   style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #6a5af9 0%, #7b8cff 100%); color: #fff; font-weight: bold; border-radius: 6px; text-decoration: none; font-size: 16px; margin-bottom: 24px;">
                    Восстановление пароля
                </a>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">
                    Если кнопка не работает. Скопируйте и вставьте эту ссылку в ваш браузер:<br>
                    <span style="color: #6a5af9;">${resetUrl}</span>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                <p style="color: #bbb; font-size: 12px; text-align: center;">
                    &copy; ${new Date().getFullYear()} Volshebny bot. Все права сохранены.
                </p>
            </div>
        </div>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to: ${to}`);
  } catch (error) {
    logger.error(`Error sending password reset email: ${error.message}`);
  }
};

const createTransporter = async () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER, // ваш gmail
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
};

export const sendSystemAlert = async (to: string, subject: string, text: string) => {
  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `Volshebny Bot <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    logger.info(`Alert sent to ${to}`);
  } catch (error) {
    logger.error(`Email error: ${error.message}`);
  }
};