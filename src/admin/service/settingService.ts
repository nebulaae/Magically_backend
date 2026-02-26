import * as settingsRepository from '../repository/settingRepository';

export const getSettings = () => {
  return settingsRepository.getSettings();
};

export const updateSettings = (data: {
  imageCost?: number;
  videoCost?: number;
  aiCost1K?: number;
  aiCost2K?: number;
  systemPrompt?: string;
  trialTokens?: number;
  trialPeriodDays?: number;
  subscriptionGracePeriodDays?: number;
}) => {
  return settingsRepository.updateSettings(data);
};
