#!/usr/bin/env bash
# ============================================================
# sync-gitee-to-github.sh
# 将 Gitee 仓的变更反向同步回 GitHub 主仓（慎用）
#
# 适用场景:
#   - 83国内服务器紧急修复后，需要合入主仓
#   - Gitee 上有本地分支需要推到 GitHub
#
# ⚠️ 警告：
#   - 默认不使用 force，遇到冲突会停止并提示手动处理
#   - 仅用于少量紧急补丁，日常仍应走 GitHub -> Gitee 方向
#   - 同步前建议先在 GitHub 确认无 concurrent push
#
# 用法: ./sync-gitee-to-github.sh [branch]
#       不传参数则同步所有分支，传分支名仅同步该分支
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${1:-}"
GITEE_REMOTE="gitee"
GITHUB_REMOTE="github"

echo "=========================================="
echo " Gitee -> GitHub 反向同步脚本"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo " 工作目录: $APP_DIR"
echo "⚠️ 此操作将 Gitee 变更推送至 GitHub 主仓"
echo "=========================================="

cd "$APP_DIR"

# 1. 拉取 Gitee 最新
if [ -n "$BRANCH" ]; then
    echo "[1/3] 拉取 Gitee 分支: $BRANCH ..."
    git fetch "$GITEE_REMOTE" "$BRANCH"
else
    echo "[1/3] 拉取 Gitee 全部分支 ..."
    git fetch "$GITEE_REMOTE" --all --tags
fi

# 2. 推送到 GitHub（非 force，有冲突会报错）
if [ -n "$BRANCH" ]; then
    echo "[2/3] 推送 $BRANCH 到 GitHub ..."
    GIT_LFS_SKIP_PUSH=1 git push "$GITHUB_REMOTE" "$GITEE_REMOTE/$BRANCH:$BRANCH"
else
    echo "[2/3] 推送全部分支+标签到 GitHub ..."
    GIT_LFS_SKIP_PUSH=1 git push "$GITHUB_REMOTE" --all
    GIT_LFS_SKIP_PUSH=1 git push "$GITHUB_REMOTE" --tags
fi

# 3. 验证一致性
echo "[3/3] 验证同步结果 ..."

if [ -n "$BRANCH" ]; then
    GE_REV="$(git rev-parse "$GITEE_REMOTE/$BRANCH" 2>/dev/null || echo "N/A")"
    GH_REV="$(git rev-parse "$GITHUB_REMOTE/$BRANCH" 2>/dev/null || echo "N/A")"
    echo "  Gitee/$BRANCH : $GE_REV"
    echo "  GitHub/$BRANCH: $GH_REV"
    if [ "$GE_REV" = "$GH_REV" ] && [ "$GE_REV" != "N/A" ]; then
        echo "  状态: 一致 ✓"
    else
        echo "  状态: 不一致 ✗"
        exit 1
    fi
fi

echo ""
echo "✅ 反向同步完成 at $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "⚠️ 提醒：同步完成后，请通知所有相关方从 GitHub 重新拉取最新代码"
