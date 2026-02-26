import { Setting } from '../models/Setting';

export const getSettings = async () => {
  const [settings] = await Setting.findOrCreate({
    where: { id: 1 },
    defaults: {
      imageCost: 15,
      videoCost: 40,
      aiCost1K: 15,
      aiCost2K: 20,
      systemPrompt: 'Photorealistic...',
      trialTokens: 50,
      trialPeriodDays: 7,
      subscriptionGracePeriodDays: 3,
    },
  });
  return settings;
};

export const updateSettings = async (data: Partial<Setting>) => {
  const settings = await getSettings();
  return settings.update(data);
};
