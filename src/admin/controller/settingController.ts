import { Request, Response } from 'express';
import * as settingsService from '../service/settingService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const getSettings = async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  apiResponse.success(res, settings);
};

export const updateSettings = async (req: Request, res: Response) => {
  const {
    imageCost,
    videoCost,
    systemPrompt,
    trialTokens,
    trialPeriodDays,
    aiCost1K,
    aiCost2K,
  } = req.body;
  const updated = await settingsService.updateSettings({
    imageCost,
    videoCost,
    systemPrompt,
    trialTokens,
    trialPeriodDays,
    aiCost1K,
    aiCost2K,
  });
  apiResponse.success(res, updated, 'Settings updated successfully');
};

export const getTariffSettings = async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  const data = {
    trialTokens: settings.trialTokens,
    trialPeriodDays: settings.trialPeriodDays,
    gracePeriodDays: settings.subscriptionGracePeriodDays ?? 3,
  };
  apiResponse.success(res, data);
};

export const updateTariffSettings = async (req: Request, res: Response) => {
  const { trialTokens, trialPeriodDays, gracePeriodDays } = req.body;
  const updated = await settingsService.updateSettings({
    trialTokens,
    trialPeriodDays,
    subscriptionGracePeriodDays: gracePeriodDays,
  });
  const data = {
    trialTokens: updated.trialTokens,
    trialPeriodDays: updated.trialPeriodDays,
    gracePeriodDays: updated.subscriptionGracePeriodDays,
  };
  apiResponse.success(res, data, 'Tariff settings updated successfully');
};
