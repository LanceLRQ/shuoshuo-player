import { buildBilibiliApiCall } from '../client';
import type { BilibiliUserInfo, BilibiliSpaceInfo } from '../../types';

interface UserVideoListResponse {
  list: { vlist: Array<{ bvid: string; created: number; [k: string]: unknown }> };
  page: { count: number; num: number; size: number };
}

interface SpaceStatResponse {
  follower: number;
  following: number;
}

interface SpaceUpStatResponse {
  archive: { view: number };
  likes: number;
}

interface FavFolderListResponse {
  count: number;
  list: Array<{ id: number; title: string; media_count: number }>;
}

interface FavFolderVideosResponse {
  info: { title: string; cover: string; intro: string; media_count: number };
  medias: Array<{ bvid: string; created: number; [k: string]: unknown }>;
}

export const UserApi = {
  /** 当前登录用户信息（/x/web-interface/nav） */
  getUserInfo: buildBilibiliApiCall<BilibiliUserInfo>({
    url: 'https://api.bilibili.com/x/web-interface/nav',
  }),

  /** UP 主视频列表（WBI） */
  getUserVideoList: buildBilibiliApiCall<UserVideoListResponse>({
    url: 'https://api.bilibili.com/x/space/wbi/arc/search',
    useWbi: true,
  }),

  /** UP 主空间信息（WBI） */
  getUserSpaceInfo: buildBilibiliApiCall<BilibiliSpaceInfo>({
    url: 'https://api.bilibili.com/x/space/wbi/acc/info',
    useWbi: true,
  }),

  /** UP 主粉丝/关注（WBI） */
  getUserSpaceStat: buildBilibiliApiCall<SpaceStatResponse>({
    url: 'https://api.bilibili.com/x/relation/stat',
    useWbi: true,
  }),

  /** UP 主播放/获赞 */
  getUserSpaceUpStat: buildBilibiliApiCall<SpaceUpStatResponse>({
    url: 'https://api.bilibili.com/x/space/upstat',
  }),

  /** 我的收藏夹列表 */
  getMyFavoriteFolder: buildBilibiliApiCall<FavFolderListResponse>({
    url: 'https://api.bilibili.com/x/v3/fav/folder/created/list-all',
  }),

  /** 收藏夹内视频列表 */
  getMyFavoriteFolderVideos: buildBilibiliApiCall<FavFolderVideosResponse>({
    url: 'https://api.bilibili.com/x/v3/fav/resource/list',
  }),
};
