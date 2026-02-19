import * as settingsRepository from '../repository/settingRepository';

export const getSettings = () => {
    return settingsRepository.getSettings();
};

export const updateSettings = (data: { imageCost?: number; videoCost?: number; systemPrompt?: string }) => {
    return settingsRepository.updateSettings(data);
};