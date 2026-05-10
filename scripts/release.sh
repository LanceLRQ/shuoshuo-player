#!/usr/bin/env bash
# 说说播放器发版自动化脚本
#
# 流程：
#   1. 显示当前版本号
#   2. 检查分支（建议 main；非 main 时确认）
#   3. 检查工作树是否干净（有未提交改动则确认）
#   4. 拉远端最新
#   5. 交互式输入新版本号 + 校验合法性 + 校验严格大于当前
#   6. 写入根 package.json + 跑 pnpm version:sync 同步 7 处文件
#   7. 提交 + 打 tag（确认）
#   8. 推送 commit + tag（确认） → 触发 CI release.yml
#   9. 输出"接下来要做的事"清单
#
# 用法：
#   pnpm release
#   或：bash scripts/release.sh
#   或赋予执行权限后：./scripts/release.sh
#
# 注：脚本名为 release.sh 而非 deploy.sh，因为 pnpm 内置 `pnpm deploy`
# 子命令会拦截 npm script 同名，导致 `pnpm deploy` 报 ERR_PNPM_NOTHING_TO_DEPLOY

set -euo pipefail

# ────────── 工具函数 ──────────

log()  { printf '[INFO]  %s\n' "$*"; }
warn() { printf '[WARN]  %s\n' "$*" >&2; }
fail() { printf '[FAIL]  %s\n' "$*" >&2; exit 1; }
step() { printf '\n========== %s ==========\n' "$*"; }

# 询问 y/N，默认 N；返回 0=确认，1=否定
confirm() {
    local prompt="$1"
    local reply
    printf '%s (y/N) ' "$prompt"
    read -r reply || true
    [[ "${reply:-}" =~ ^[yY] ]]
}

# 校验版本号：1-4 段纯数字（与 sync-version.mjs / Chrome MV3 manifest 约束一致）
is_valid_version() {
    [[ "$1" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]]
}

# 比较版本号：返回 0=$1 严格大于 $2
version_gt() {
    [ "$1" != "$2" ] && [ "$(printf '%s\n%s' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

# 切到仓库根目录，确保命令路径相对正确
cd "$(dirname "$0")/.."

# 必备命令检查
command -v node >/dev/null  || fail "需要 node"
command -v pnpm >/dev/null  || fail "需要 pnpm"
command -v git  >/dev/null  || fail "需要 git"

# ────────── 1. 显示当前版本 ──────────

step "1. 当前版本"
CURRENT=$(node -p "require('./package.json').version")
log "当前版本：v${CURRENT}"

# ────────── 2. 分支检查 ──────────

step "2. 分支检查"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "当前分支：${BRANCH}"

if [ "${BRANCH}" != "main" ]; then
    warn "当前不在 main 分支。常规发版建议在 main 上打 tag。"
    if ! confirm "是否在 ${BRANCH} 分支继续发版？"; then
        log "退出。可执行：git checkout main && git pull --ff-only"
        exit 0
    fi
fi

# ────────── 3. 工作树检查 ──────────

step "3. 工作树检查"
if [ -n "$(git status --porcelain)" ]; then
    warn "工作树有未提交改动："
    git status --short
    if ! confirm "是否继续？（未提交改动会被 stash 保留，但版本号变更会与之共存）"; then
        log "退出。请先 git stash / commit 后重试。"
        exit 0
    fi
else
    log "工作树干净"
fi

# ────────── 4. 拉远端 ──────────

step "4. 拉取远端最新"
if git remote get-url origin >/dev/null 2>&1; then
    if git pull --ff-only origin "${BRANCH}"; then
        log "已拉取 origin/${BRANCH}"
    else
        warn "git pull --ff-only 失败（可能本地有领先 commit 或分支已分叉）"
        if ! confirm "是否仍继续？"; then
            exit 1
        fi
    fi
else
    warn "未配置 origin remote，跳过 pull"
fi

# ────────── 5. 输入新版本号 ──────────

step "5. 设置新版本号"
log "格式：1-4 段纯数字（如 1.9.1 / 1.9.0.1 / 2.0.0），不带 v 前缀"
log "Chrome MV3 manifest 不接受预发布段（-rc.1 / -beta 等），项目统一用纯数字"
echo ""
printf "请输入新版本号 [当前 %s]：" "${CURRENT}"
read -r NEW_VERSION

if [ -z "${NEW_VERSION:-}" ]; then
    fail "新版本号不能为空"
fi

if ! is_valid_version "${NEW_VERSION}"; then
    fail "非法版本号 \"${NEW_VERSION}\"：必须是 1-4 段纯数字"
fi

if ! version_gt "${NEW_VERSION}" "${CURRENT}"; then
    fail "新版本 ${NEW_VERSION} 必须严格大于当前 ${CURRENT}"
fi

TAG="v${NEW_VERSION}"
log "新版本：${NEW_VERSION}"
log "tag：${TAG}"

# 检查 tag 是否已存在
if git rev-parse "${TAG}" >/dev/null 2>&1; then
    fail "tag ${TAG} 已存在（本地）"
fi

if git ls-remote --tags origin "${TAG}" 2>/dev/null | grep -q "${TAG}"; then
    fail "tag ${TAG} 已存在（远端 origin）"
fi

# ────────── 6. 写入版本号 + 同步 ──────────

step "6. 同步版本号到 7 处文件"
log "改写根 package.json..."
node -e "
const fs = require('fs');
const path = './package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

log "运行 pnpm version:sync..."
pnpm version:sync

log "校验一致性..."
pnpm version:check

# ────────── 7. 提交 + 打 tag ──────────

step "7. 提交 + 打 tag"
log "即将提交的改动："
git status --short
echo ""

if ! confirm "确认提交 [chore(release): bump version to ${NEW_VERSION}] 并打 tag ${TAG}？"; then
    log "已停在 sync 后，未提交。可手动："
    log "  git add -A && git commit -m \"chore(release): bump version to ${NEW_VERSION}\""
    log "  git tag ${TAG}"
    exit 0
fi

# git add 与 git commit 分两步（避开 husky 与 index.lock 风险，对齐项目规范）
git add package.json \
        packages/shared/package.json \
        packages/web/package.json \
        packages/desktop/package.json \
        packages/web/public/manifest.json \
        packages/desktop/src-tauri/tauri.conf.json \
        packages/desktop/src-tauri/Cargo.toml \
        packages/desktop/src-tauri/Cargo.lock

git commit -m "chore(release): bump version to ${NEW_VERSION}"
git tag "${TAG}"

log "已创建 commit 与 tag"
git log --oneline -1
git tag -l "${TAG}"

# ────────── 8. 推送 ──────────

step "8. 推送到远端"
if ! confirm "推送 commit 与 tag ${TAG} 到 origin？（push tag 即触发 CI release.yml）"; then
    log "未推送。可手动："
    log "  git push origin ${BRANCH}"
    log "  git push origin ${TAG}"
    exit 0
fi

git push origin "${BRANCH}"
git push origin "${TAG}"

# ────────── 9. 后续指引 ──────────

step "9. 完成 — 接下来要做的事"

cat <<EOF

  发版已触发。CI 跑完前你不需要做任何事，但完成后建议按顺序：

  ──────────────────────────────────────────────────────────
  [1] 监控 CI（约 20 分钟）
       https://github.com/LanceLRQ/shuoshuo-player/actions

       quality / extension / desktop matrix(mac+win) / publish-release
       任一失败请进入对应 job 看 log，常见问题：
       - typecheck 失败 → 本地 pnpm typecheck 没跑
       - desktop matrix 失败 → 通常是 macOS 资源签名 / Windows 编译环境
       - artifact 上传失败 → 可重跑 job

  ──────────────────────────────────────────────────────────
  [2] 编辑 GitHub Release 草稿（CI 完成后）
       https://github.com/LanceLRQ/shuoshuo-player/releases

       - 找到 ${TAG} 草稿（标 "Draft"）
       - 编辑 Release notes：在 "<!-- TODO --->" 处填本版本变更摘要
       - 取消勾选 "Set as a draft"
       - 1.x 保留 "Set as a pre-release"；2.0+ 取消该勾选
       - Update release

  ──────────────────────────────────────────────────────────
  [3] 验证镜像（可选；publish 后 5 分钟内自动同步）
       curl -sI https://download.hutao.wiki/shuoshuo-player/releases/download/${TAG}/version.json

       期望：HTTP/2 200 + content-length 接近 400 bytes

  ──────────────────────────────────────────────────────────
  [4] Chrome 扩展上架（独立流程，按需）
       - 从 Release 下载 shuoshuo-player-extension-${TAG}.zip
       - 登录 Chrome Web Store 开发者后台
       - 上传新版 zip → 提交审核（通常 1-3 天）
       - 通过后用户的 Chrome 5 小时内自动收到更新

  ──────────────────────────────────────────────────────────
  [5] 桌面端用户表现
       - publish 后老用户启动应用 → 5 秒后 update-checker fetch
       - 版本号严格大于本地时弹 toast「发现新版本 ${TAG}，建议升级」
       - 用户点击跳转 Release 页 → 手动下载新版

EOF

log "完成。"
