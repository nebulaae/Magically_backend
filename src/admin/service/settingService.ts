import * as settingsRepository from '../repository/settingRepository';

export const getSettings = () => {
    return settingsRepository.getSettings();
};

export const updateSettings = (data: {
  imageCost?: number;
  videoCost?: number;
  systemPrompt?: string;
  trialTokens?: number;
  trialPeriodDays?: number;
}) => {
  return settingsRepository.updateSettings(data);
};