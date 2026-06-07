import { Profile } from '@garmin/fitsdk';

export const MESG_ORDER_BEFORE_TIMESTAMPED = [
  { key: 'fileIdMesgs', mesgNum: Profile.MesgNum.FILE_ID },
  { key: 'fileCreatorMesgs', mesgNum: Profile.MesgNum.FILE_CREATOR },
  { key: 'deviceSettingsMesgs', mesgNum: Profile.MesgNum.DEVICE_SETTINGS },
  { key: 'userProfileMesgs', mesgNum: Profile.MesgNum.USER_PROFILE },
  { key: 'sportMesgs', mesgNum: Profile.MesgNum.SPORT },
  { key: 'zonesTargetMesgs', mesgNum: Profile.MesgNum.ZONES_TARGET },
  { key: 'trainingSettingsMesgs', mesgNum: Profile.MesgNum.TRAINING_SETTINGS },
  { key: 'trainingFileMesgs', mesgNum: Profile.MesgNum.TRAINING_FILE },
  { key: 'workoutMesgs', mesgNum: Profile.MesgNum.WORKOUT },
  { key: 'workoutStepMesgs', mesgNum: Profile.MesgNum.WORKOUT_STEP },
  { key: 'deviceInfoMesgs', mesgNum: Profile.MesgNum.DEVICE_INFO },
] as const;

export const MESG_ORDER_AFTER_TIMESTAMPED = [
  { key: 'lapMesgs', mesgNum: Profile.MesgNum.LAP },
  { key: 'sessionMesgs', mesgNum: Profile.MesgNum.SESSION },
  { key: 'activityMesgs', mesgNum: Profile.MesgNum.ACTIVITY },
] as const;
