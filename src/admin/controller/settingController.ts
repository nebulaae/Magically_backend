import { Request, Response } from 'express';
import * as settingsService from '../service/settingService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const getSettings = async (_req: Request, res: Response) => {
    const settings = await settingsService.getSettings();
    apiResponse.success(res, settings);
};

export const updateSettings = async (req: Request, res: Response) => {
    const { imageCost, videoCost, systemPrompt } = req.body;
    const updated = await settingsService.updateSettings({ imageCost, videoCost, systemPrompt });
    apiResponse.success(res, updated, 'Settings updated successfully');
};