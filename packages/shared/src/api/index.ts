export { UserApi } from './bilibili/user';
export { VideoApi } from './bilibili/video';
export { encWbi, extractWbiKey } from './bilibili/wbi';
export { LyricApi } from './cloud/lyric';
export { AccountApi } from './cloud/account';
export { LiveSlicerApi } from './cloud/live-slicer';

export type { LyricListParams, LyricSavePayload } from './cloud/lyric';
export type {
  LoginPayload,
  UpdateSelfPayload,
  CheckLoginResponse,
  CreateAccountPayload,
  UpdateAccountPayload,
  AccountListParams,
} from './cloud/account';
export type { LiveSlicerListParams, LiveSlicerSavePayload } from './cloud/live-slicer';
export type { VideoViewInfo, VideoPlayUrlResponse, VideoSearchResponse } from './bilibili/video';

export {
  bilibiliService,
  cloudService,
  bilibiliPure,
  cloudPure,
  setWbiInfo,
  getWbiInfo,
  setCloudServiceToken,
  setCloudApiBaseUrl,
  getCloudApiBaseUrl,
  setSessionExpiredHandler,
  buildBilibiliApiCall,
  buildCloudApiCall,
  CLOUD_API_BASE_URL_STORAGE_KEY,
} from './client';
export type { RuntimeRequestConfig } from './client';
