# 说说播放器

B站第三方音乐播放器，可以让粉丝给UP主定制的音乐播放器

## 开发指南(Chrome插件版本)

本地环境要求：`nodejs >= 20`，最好安装一下`yarn`

### 1. 克隆目录
```shell
git clone git@github.com:LanceLRQ/shuoshuo-player.git
cd shuoshuo-player
git submodule update --init
```

### 2. 安装依赖
```shell
cd react-music-player
yarn
rm -r node_modules/react node_modules/react-dom  # 删除子项目里边的react，防止冲突
yarn link     # 注册播放器组件项目
yarn build    # 构建代码

cd ../shuoshuo-player
yarn
yarn link react-jinke-music-player    # 链接播放器组件
```
### 3.启动开发环境
```shell
cd shuoshuo-player
yarn build      # 第一次执行的时候要，因为要把manifest.json、background.js复制到chrome插件目录下。以后只要是改播放器，用start命令即可。
yarn start
```
踩坑：
```shell
# 播放器组件那边改完，需要在shuoshuo-player下边执行一下这个，不然每次都不更新
rm -r node_module/.cache 
```

## 技术支持

- [react-music-player](https://github.com/lijinke666/react-music-player) ：因播放列表管理方式不同，故对其进行了一些适当的[修改](https://github.com/LanceLRQ/react-music-player)
- [Chrome Extension](https://developer.chrome.com/docs/extensions/) + [React](https://github.com/facebook/react) + [MUI](https://mui.com/zh/)
- [react-chrome-extension-MV3](https://github.com/Sirage-t/react-chrome-extension-MV3)
- 参考：[Azusa-Player](https://github.com/lovegaoshi/NoxPlayer)

## 项目协议

本项目基于 [MIT License](https://github.com/LanceLRQ/shuoshuo-player/blob/master/LICENSE) 许可证发行，以下协议是对于 MIT License 的补充，如有冲突，以以下协议为准。

词语约定：本协议中的“本项目”指 `shuoshuo-player` 项目；“使用者”指签署本协议的使用者；“官方音乐平台”指对本项目内置的包括 QQ 音乐，哔哩哔哩动画等音源，歌词来源的官方平台统称；“版权数据”指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

本项目的数据来源原理是从各官方音乐平台的公开服务器中拉取数据，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的准确性负责。

使用本项目的过程中可能会产生版权数据，对于这些版权数据，本项目不拥有它们的所有权，为了避免造成侵权，使用者务必在24 小时内清除使用本项目的过程中所产生的版权数据。

本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意，如果官方音乐平台觉得不妥，可联系本项目更改或移除。

本项目内使用的部分包括但不限于字体、图片等资源来源于互联网，如果出现侵权可联系本项目移除。

由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流，本项目不对项目内的技术可能存在违反当地法律法规的行为作保证，禁止在违反当地法律法规的情况下使用本项目，对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

若你使用了本项目，将代表你接受以上协议。

音乐视频平台不易，请尊重版权，支持正版。