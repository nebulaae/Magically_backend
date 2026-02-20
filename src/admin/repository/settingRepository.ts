import { Setting } from '../models/Setting';

export const getSettings = async () => {
  const [settings] = await Setting.findOrCreate({
    where: { id: 1 },
    defaults: { imageCost: 15, videoCost: 40, systemPrompt: 'Photorealistic...' }
  });
  return settings;
};

export const updateSettings = async (data: Partial<Setting>) => {
  const settings = await getSettings();
  return settings.update(data);
};