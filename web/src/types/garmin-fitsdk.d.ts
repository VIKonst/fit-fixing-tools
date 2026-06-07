declare module '@garmin/fitsdk' {
  export class Stream {
    static fromArrayBuffer(buffer: ArrayBuffer): Stream;
    static fromBuffer(buffer: Buffer): Stream;
    static fromByteArray(data: number[]): Stream;
  }

  interface DecoderOptions {
    applyScaleAndOffset?: boolean;
    expandSubFields?: boolean;
    expandComponents?: boolean;
    convertTypesToStrings?: boolean;
    convertDateTimesToDates?: boolean;
    includeUnknownData?: boolean;
    mergeHeartRates?: boolean;
  }

  interface DecoderResult {
    messages: FitMessages;
    errors: string[];
  }

  export class Decoder {
    constructor(stream: Stream);
    isFIT(): boolean;
    read(options?: DecoderOptions): DecoderResult;
  }

  export class Encoder {
    constructor(options?: { fieldDescriptions?: Record<string, unknown> | null });
    onMesg(mesgNum: number, mesg: Record<string, unknown>): this;
    close(): Uint8Array;
  }

  export interface FitMessages {
    fileIdMesgs?: Record<string, unknown>[];
    fileCreatorMesgs?: Record<string, unknown>[];
    deviceSettingsMesgs?: Record<string, unknown>[];
    userProfileMesgs?: Record<string, unknown>[];
    sportMesgs?: Record<string, unknown>[];
    zonesTargetMesgs?: Record<string, unknown>[];
    trainingSettingsMesgs?: Record<string, unknown>[];
    trainingFileMesgs?: Record<string, unknown>[];
    workoutMesgs?: Record<string, unknown>[];
    workoutStepMesgs?: Record<string, unknown>[];
    deviceInfoMesgs?: Record<string, unknown>[];
    eventMesgs?: Record<string, unknown>[];
    recordMesgs?: Record<string, unknown>[];
    lapMesgs?: Record<string, unknown>[];
    sessionMesgs?: Record<string, unknown>[];
    activityMesgs?: Record<string, unknown>[];
    [key: string]: Record<string, unknown>[] | undefined;
  }

  export const Profile: {
    MesgNum: {
      FILE_ID: number;
      FILE_CREATOR: number;
      DEVICE_SETTINGS: number;
      USER_PROFILE: number;
      SPORT: number;
      ZONES_TARGET: number;
      TRAINING_SETTINGS: number;
      TRAINING_FILE: number;
      WORKOUT: number;
      WORKOUT_STEP: number;
      DEVICE_INFO: number;
      EVENT: number;
      RECORD: number;
      LAP: number;
      SESSION: number;
      ACTIVITY: number;
      [key: string]: number;
    };
  };
}
