import { ISetting } from './setting.interface';
import { Setting } from './setting.model';

const updateSetting = async (payload: Partial<ISetting>) => {
  let setting = await Setting.findOne();
  if (!setting) {
    setting = await Setting.create(payload);
  } else {
    setting = await Setting.findOneAndUpdate({}, payload, { new: true, runValidators: true });
  }
  return setting;
};

const getSetting = async () => {
  let setting = await Setting.findOne();
  if (!setting) {
    setting = await Setting.create({ isSubscribeActive: false });
  }
  return setting;
};

export const SettingService = {
  updateSetting,
  getSetting,
};
