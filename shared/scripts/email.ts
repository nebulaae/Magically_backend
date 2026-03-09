import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { EmailLog } from '../../src/notification/models/EmailLog';

dotenv.config();

type EmailTemplateParams = Record<string, string | number>;

const toInt = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderTemplate = (template: string, params: EmailTemplateParams) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const raw = params[key];
    if (raw === undefined || raw === null) return '';
    return escapeHtml(String(raw));
  });

const templateCache = new Map<string, string>();

const getTemplatesRoot = () => {
  if (process.env.EMAIL_TEMPLATES_ROOT) {
    return process.env.EMAIL_TEMPLATES_ROOT;
  }

  return path.join(process.cwd(), 'shared', 'templates', 'emails');
};

const loadTemplateFromFile = (fileName: string) => {
  const cached = templateCache.get(fileName);
  if (cached) return cached;

  const root = getTemplatesRoot();
  const fullPath = path.join(root, fileName);

  const content = fs.readFileSync(fullPath, 'utf-8');
  templateCache.set(fileName, content);
  return content;
};

export const isTelegramEmail = (email: string) =>
  email.toLowerCase().endsWith('@telegram.local');

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_HOST;
  const port = toInt(process.env.EMAIL_PORT, 465);
  const secure = port === 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error('Email SMTP config is missing');
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return cachedTransporter;
};

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId?: string;
  type?: string;
  meta?: Record<string, unknown>;
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  userId,
  type,
  meta,
}: SendEmailArgs) => {
  if (isTelegramEmail(to)) {
    logger.info(`Email skipped for telegram user: ${to}`);
    return;
  }

  const from =
    process.env.EMAIL_FROM ??
    (process.env.EMAIL_USER ? `Volshebny <${process.env.EMAIL_USER}>` : 'Volshebny');

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    if (type) {
      await EmailLog.create({
        userId: userId ?? null,
        email: to,
        type,
        meta: meta ?? null,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending email to ${to}: ${message}`);
    throw error;
  }
};

export const sendVerificationEmail = async (to: string, otp: string) => {
  try {
    const template = loadTemplateFromFile('verification-code.html');
    const html = renderTemplate(template, {
      otp,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Верификация почты',
      html,
      text: `Код верификации: ${otp}`,
      type: 'otp',
      meta: { otp },
    });

    logger.info(`Verification email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending verification email: ${message}`);
  }
};

export const sendPasswordResetEmail = async (to: string, token: string) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is missing');
    }

    const resetUrl = `${frontendUrl}/reset-password/${encodeURIComponent(
      token
    )}`;

    const template = loadTemplateFromFile('reset-password.html');
    const html = renderTemplate(template, {
      resetUrl,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Запрос на восстановление пароля',
      html,
      text: `Ссылка для восстановления пароля: ${resetUrl}`,
      type: 'reset_password',
      meta: { resetUrl },
    });

    logger.info(`Password reset email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending password reset email: ${message}`);
  }
};

type WelcomeEmailParams = {
  name: string;
  trialTokens: number;
  trialDays: number;
  cabinetUrl: string;
};

export const sendWelcomeEmail = async (
  to: string,
  params: WelcomeEmailParams & { userId?: string }
) => {
  try {
    const template = loadTemplateFromFile('welcome.html');
    const html = renderTemplate(template, {
      name: params.name,
      trialTokens: params.trialTokens,
      trialDays: params.trialDays,
      cabinetUrl: params.cabinetUrl,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Добро пожаловать в Volshebny',
      html,
      userId: params.userId,
      type: 'welcome',
      meta: {
        trialTokens: params.trialTokens,
        trialDays: params.trialDays,
      },
    });

    logger.info(`Welcome email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending welcome email: ${message}`);
  }
};

type PlanActivatedParams = {
  planName: string;
  tokens: number;
  periodDays: number;
  amount: number;
  currency: string;
  endDate: string;
  cabinetUrl: string;
};

export const sendPlanActivatedEmail = async (
  to: string,
  params: PlanActivatedParams & { userId?: string }
) => {
  try {
    const template = loadTemplateFromFile('activate-tarif.html');
    const html = renderTemplate(template, {
      planName: params.planName,
      tokens: params.tokens,
      periodDays: params.periodDays,
      amount: params.amount.toFixed(2),
      currency: params.currency,
      endDate: params.endDate,
      cabinetUrl: params.cabinetUrl,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Ваш тариф активирован',
      html,
      userId: params.userId,
      type: 'plan_activated',
      meta: {
        planName: params.planName,
        tokens: params.tokens,
        amount: params.amount,
        currency: params.currency,
      },
    });

    logger.info(`Plan activation email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending plan activation email: ${message}`);
  }
};

type TopupEmailParams = {
  topupTokens: number;
  totalBalance: number;
  amount: number;
  currency: string;
  burnDate: string;
  cabinetUrl: string;
};

export const sendTopupEmail = async (to: string, params: TopupEmailParams) => {
  try {
    const template = loadTemplateFromFile('payment-success.html');
    const html = renderTemplate(template, {
      topupTokens: params.topupTokens,
      totalBalance: params.totalBalance,
      amount: params.amount.toFixed(2),
      currency: params.currency,
      burnDate: params.burnDate,
      cabinetUrl: params.cabinetUrl,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Токены успешно пополнены',
      html,
      type: 'topup_success',
      meta: {
        topupTokens: params.topupTokens,
        totalBalance: params.totalBalance,
        amount: params.amount,
        currency: params.currency,
      },
    });

    logger.info(`Top-up email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending top-up email: ${message}`);
  }
};

type ReactivationEmailParams = {
  tariffsUrl: string;
};

export const sendReactivationEmail = async (
  to: string,
  params: ReactivationEmailParams & { userId: string }
) => {
  try {
    const template = loadTemplateFromFile('reactivate-user.html');
    const html = renderTemplate(template, {
      tariffsUrl: params.tariffsUrl,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Вернитесь в Volshebny',
      html,
      userId: params.userId,
      type: 'reactivation',
      meta: { tariffsUrl: params.tariffsUrl },
    });

    logger.info(`Reactivation email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending reactivation email: ${message}`);
  }
};

type TopupErrorEmailParams = {
  amount: number;
  currency: string;
  tryAgainUrl: string;
  support: string;
};

export const sendTopupErrorEmail = async (
  to: string,
  params: TopupErrorEmailParams & { userId?: string }
) => {
  try {
    const template = loadTemplateFromFile('payment-error.html');
    const html = renderTemplate(template, {
      amount: params.amount.toFixed(2),
      currency: params.currency,
      tryAgainUrl: params.tryAgainUrl,
      support: params.support,
      year: new Date().getFullYear(),
    });

    await sendEmail({
      to,
      subject: 'Ошибка пополнения токенов',
      html,
      userId: params.userId,
      type: 'topup_error',
      meta: {
        amount: params.amount,
        currency: params.currency,
      },
    });

    logger.info(`Top-up error email sent to: ${to}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending top-up error email: ${message}`);
  }
};
