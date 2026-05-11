// 持久化Key
export const persistKeys = ['bili_user_videos', 'bili_videos', 'playing_list', 'fav_list', 'ui_profile', 'lyrics', 'cloud_service']
export const exportKeys = ['bili_user_videos', 'bili_videos', 'playing_list', 'fav_list', 'ui_profile', 'lyrics']

// 设置主要用户
export const MasterUpInfo = {
    uname: '说说Crystal',
    nickname: '说说',
    mid: 283886865,    // B站UID
}

export const NoticeTypes = {
    INFO: 0,
    WARN: 1,
    ERROR: 2,
    SUCCESS: 3,
}
export const FavListType = {
    CUSTOM: 0,    // 自定义收藏夹（空）
    UPLOADER: 1, // B站用户视频列表
    BILI_FAV: 2, // bilibili收藏夹
}

export const StartupLoadingTip = [
    '喝海带汤',
    '打破游戏',
    '录歌',
    '学羊叫',
    '植物大战僵尸',
    '玩俄罗斯方块',
    '不听话',
    '蜀道山'
]

export const CloudServiceUserRole = {
    WebMaster: 1024,
    Admin: 512,
    User: 0
}
export const CloudServiceUserRoleNameMap = {
    [CloudServiceUserRole.WebMaster]: '站长',
    [CloudServiceUserRole.Admin]: '管理员',
    [CloudServiceUserRole.User]: '水晶蟹'
}

export const CommonPageLimitSize = 20;
export const CommonPagerObject = {
    page: 1,
    page_size: CommonPageLimitSize,
    total: 0,
}
export const CommonPagerParams = {
    page: 1,
    limit: CommonPageLimitSize,
}