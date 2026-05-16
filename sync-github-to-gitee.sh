#!/usr/bin/env bash
# ============================================================
# sync-github-to-gitee.sh
# 将 GitHub 主仓代码同步到 Gitee 国内镜像仓
# 用法: ./sync-github-to-gitee.sh [branch]
#       不传参数则同步所有分支，传分支名仅同步该分支
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${1:-}"
GITEE_REMOTE="gitee"
GITHUB_REMOTE="github"

echo "=========================================="
echo " GitHub -> Gitee 同步脚本"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo " 工作目录: $APP_DIR"
echo "=========================================="

cd "$APP_DIR"

# 1. 拉取 GitHub 最新
if [ -n "$BRANCH" ]; then
    echo "[1/3] 拉取 GitHub 分支: $BRANCH ..."
    git fetch "$GITHUB_REMOTE" "$BRANCH"
else
    echo "[1/3] 拉取 GitHub 全部分支 ..."
    git fetch "$GITHUB_REMOTE" --tags
fi

# 2. 推送到 Gitee（镜像模式，强制覆盖以 GitHub 为准；跳过 LFS）
if [ -n "$BRANCH" ]; then
    echo "[2/3] 推送 $BRANCH 到 Gitee (force) ..."
    GIT_LFS_SKIP_PUSH=1 git push "$GITEE_REMOTE" "$GITHUB_REMOTE/$BRANCH:$BRANCH" --force
else
    echo "[2/3] 推送全部分支+标签到 Gitee (force) ..."
    GIT_LFS_SKIP_PUSH=1 git push "$GITEE_REMOTE" --all --force
    GIT_LFS_SKIP_PUSH=1 git push "$GITEE_REMOTE" --tags --force
fi

# 3. 验证
echo "[3/3] 验证同步结果 ..."
git fetch "$GITEE_REMOTE" "${BRANCH:---all}" > /dev/null 2>&1 || true

if [ -n "$BRANCH" ]; then
    GH_REV="$(git rev-parse "$GITHUB_REMOTE/$BRANCH" 2>/dev/null || echo "N/A")"
    GE_REV="$(git rev-parse "$GITEE_REMOTE/$BRANCH" 2>/dev/null || echo "N/A")"
    echo "  GitHub/$BRANCH: $GH_REV"
    echo "  Gitee/$BRANCH : $GE_REV"
    if [ "$GH_REV" = "$GE_REV" ] && [ "$GH_REV" != "N/A" ]; then
        echo "  状态: 一致 ✓"
    else
        echo "  状态: 不一致 ✗"
        exit 1
    fi
fi

echo ""
echo "✅ 同步完成 at $(date '+%Y-%m-%d %H:%M:%S')"
