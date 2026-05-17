#!/bin/bash

#===============================================================================
# Git Sync Status Checker - 黑客松安全检查脚本
# 功能：检查本地与远程仓库同步状态，生成详细报告
# 约束：绝不执行 git push 或任何破坏性操作
# 用法: ./scripts/git-sync-status.sh [branch]
#===============================================================================

set -e  # 遇到错误立即退出

# ============ 配置 ============
REMOTE_NAME="github"
REPO_URL="https://github.com/sanfordzhang/blockgame"
CURRENT_BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '0g')}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_FILE="logs/git-sync-report-$(date +%Y%m%d_%H%M%S).md"
TEMP_DIR=".git/temp_sync_check"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ============ 初始化 ============
echo -e "${BOLD}${CYAN}================================================================${NC}"
echo -e "${BOLD}${CYAN}    Git 同步状态检查工具 - 黑客松安全模式${NC}"
echo -e "${BOLD}${CYAN}    时间: ${TIMESTAMP}${NC}"
echo -e "${BOLD}${CYAN}================================================================${NC}"
echo ""

# 创建日志目录
mkdir -p logs

# 初始化报告文件
cat > "$REPORT_FILE" << EOF
# Git 同步状态报告

**生成时间**: ${TIMESTAMP}
**当前分支**: ${CURRENT_BRANCH}
**远程仓库**: ${REPO_URL}
**远程名称**: ${REMOTE_NAME}

---

EOF

log_and_echo() {
    local msg="$1"
    echo -e "$msg" | sed 's/\\033\[[0-9;]*m//g' >> "$REPORT_FILE"
    echo -e "$msg"
}

safe_command() {
    local cmd="$1"
    local description="$2"
    
    log_and_echo "${BLUE}[执行] ${description}: ${cmd}${NC}"
    
    # 安全检查：禁止的危险命令
    if echo "$cmd" | grep -qiE '(git\s+push|git\s+reset\s+--hard|git\s+clean\s+-f|rm\s+-rf)'; then
        log_and_echo "${RED}[危险] 命令被阻止: ${cmd}${NC}"
        log_and_echo "${RED}[原因] 此脚本禁止可能影响服务器状态的破坏性操作${NC}"
        return 1
    fi
    
    eval "$cmd" 2>&1 | tee -a "$REPORT_FILE"
}

# ============ 步骤 1: 检查 Git 环境 ============
log_and_echo "${BOLD}${YELLOW}步骤 1: 检查 Git 环境${NC}"
log_and_echo "------------------------------------------------------------"

# 检查是否在 Git 仓库中
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    log_and_echo "${RED}[错误] 当前目录不是 Git 仓库${NC}"
    exit 1
fi

# 显示当前状态概要
log_and_echo "${GREEN}✓ 当前目录: $(pwd)${NC}"
log_and_echo "${GREEN}✓ 当前分支: ${CURRENT_BRANCH}${NC}"

# 检查 remote 配置
log_and_echo ""
log_and_echo "${CYAN}Remote 配置:${NC}"
git remote -v 2>&1 | tee -a "$REPORT_FILE"

# 检查 github remote 是否存在
if ! git remote get-url "$REMOTE_NAME" &>/dev/null; then
    log_and_echo "${YELLOW}[警告] Remote '${REMOTE_NAME}' 不存在，尝试添加...${NC}"
    git remote add "$REMOTE_NAME" "$REPO_URL" 2>&1 | tee -a "$REPORT_FILE"
    log_and_echo "${GREEN}✓ 已添加 remote: ${REMOTE_NAME} -> ${REPO_URL}${NC}"
else
    CURRENT_URL=$(git remote get-url "$REMOTE_NAME")
    log_and_echo "${GREEN}✓ Remote URL: ${CURRENT_URL}${NC}"
fi

echo "" >> "$REPORT_FILE"

# ============ 步骤 2: Fetch 远程数据 ============
log_and_echo ""
log_and_echo "${BOLD}${YELLOW}步骤 2: 获取远程最新数据 (git fetch)${NC}"
log_and_echo "------------------------------------------------------------"

if safe_command "git fetch ${REMOTE_NAME}" "获取远程仓库数据"; then
    log_and_echo "${GREEN}✓ Fetch 成功${NC}"
else
    log_and_echo "${RED}✗ Fetch 失败，请检查网络连接或权限${NC}"
    exit 1
fi

echo "" >> "$REPORT_FILE"

# ============ 步骤 3: 分支对比分析 ============
log_and_echo ""
log_and_echo "${BOLD}${YELLOW}步骤 3: 本地与远程分支对比${NC}"
log_and_echo "------------------------------------------------------------"

# 获取本地和远程的 commit hash
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "${REMOTE_NAME}/${CURRENT_BRANCH}" 2>/dev/null || echo "N/A")
LOCAL_AHEAD=0
LOCAL_BEHIND=0

if [ "$REMOTE_COMMIT" != "N/A" ]; then
    # 计算领先/落后数量
    LOCAL_AHEAD=$(git rev-list --count "${REMOTE_NAME}/${CURRENT_BRANCH}..HEAD" 2>/dev/null || echo 0)
    LOCAL_BEHIND=$(git rev-list --count "HEAD..${REMOTE_NAME}/${CURRENT_BRANCH}" 2>/dev/null || echo 0)
    
    log_and_echo "${CYAN}本地分支: ${CURRENT_BRANCH}${NC}"
    log_and_echo "  本地 Commit:  ${LOCAL_COMMIT}"
    log_and_echo "  远程 Commit:  ${REMOTE_COMMIT}"
    log_and_echo "  本地领先:    ${LOCAL_AHEAD} 个提交 (待推送)"
    log_and_echo "  本地落后:    ${LOCAL_BEHIND} 个提交 (待拉取)"
else
    log_and_echo "${YELLOW}[警告] 远程分支 ${REMOTE_NAME}/${CURRENT_BRANCH} 不存在${NC}"
fi

# 判断同步状态
if [ "$LOCAL_AHEAD" -eq 0 ] && [ "$LOCAL_BEHIND" -eq 0 ]; then
    SYNC_STATUS="${GREEN}✓ 完全同步${NC}"
elif [ "$LOCAL_BEHIND" -gt 0 ] && [ "$LOCAL_AHEAD" -eq 0 ]; then
    SYNC_STATUS="${YELLOW}⚠ 本地落后于远程${NC}"
elif [ "$LOCAL_AHEAD" -gt 0 ] && [ "$LOCAL_BEHIND" -eq 0 ]; then
    SYNC_STATUS="${CYAN}→ 本地领先于远程 (有待推送的更改)${NC}"
else
    SYNC_STATUS="${RED}✗ 本地与远程有分歧 (分叉状态)${NC}"
fi

log_and_echo ""
log_and_echo "${BOLD}同步状态: ${SYNC_STATUS}${NC}"

# 详细差异列表
if [ "$LOCAL_BEHIND" -gt 0 ]; then
    log_and_echo ""
    log_and_echo "${YELLOW}远程新增的提交 (本地缺失):${NC}"
    git log --oneline HEAD..${REMOTE_NAME}/${CURRENT_BRANCH} 2>/dev/null | tee -a "$REPORT_FILE" | while read line; do
        log_and_echo "  - ${line}"
    done
fi

if [ "$LOCAL_AHEAD" -gt 0 ]; then
    log_and_echo ""
    log_and_echo "${CYAN}本地待推送的提交 (远程缺失):${NC}"
    git log --oneline ${REMOTE_NAME}/${CURRENT_BRANCH}..HEAD 2>/dev/null | tee -a "$REPORT_FILE" | while read line; do
        log_and_echo "  + ${line}"
    done
fi

echo "" >> "$REPORT_FILE"

# ============ 步骤 4: 未提交更改检查 =============
log_and_echo ""
log_and_echo "${BOLD}${YELLOW}步骤 4: 检查本地未提交更改${NC}"
log_and_echo "------------------------------------------------------------"

# 使用 git status 获取详细信息
UNTRACKED_COUNT=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
MODIFIED_COUNT=$(git diff --name-only | wc -l | tr -d ' ')
STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
DELETED_COUNT=$(git diff --name-only --diff-filter=D | wc -l | tr -d ' ')

log_and_echo "${CYAN}更改统计:${NC}"
log_and_echo "  新增文件 (Untracked): ${UNTRACKED_COUNT}"
log_and_echo "  已修改 (Modified):     ${MODIFIED_COUNT}"
log_and_echo "  已暂存 (Staged):       ${STAGED_COUNT}"
log_and_echo "  已删除 (Deleted):      ${DELETED_COUNT}"

TOTAL_CHANGES=$((UNTRACKED_COUNT + MODIFIED_COUNT + STAGED_COUNT + DELETED_COUNT))

if [ "$TOTAL_CHANGES" -gt 0 ]; then
    log_and_echo ""
    log_and_echo "${YELLOW}${BOLD}详细变更列表:${NC}"
    
    # 未跟踪的新文件
    if [ "$UNTRACKED_COUNT" -gt 0 ]; then
        log_and_echo ""
        log_and_echo "${CYAN}[新增文件] (${UNTRACKED_COUNT}个):${NC}"
        git ls-files --others --exclude-standard 2>/dev/null | tee -a "$REPORT_FILE" | while read file; do
            log_and_echo "  ? ${file}"
            # 显示文件大小
            if [ -f "$file" ]; then
                SIZE=$(du -h "$file" | cut -f1)
                log_and_echo "    大小: ${SIZE}"
            fi
        done
    fi
    
    # 已修改但未暂存的文件
    if [ "$MODIFIED_COUNT" -gt 0 ]; then
        log_and_echo ""
        log_and_echo "${YELLOW}[已修改未暂存] (${MODIFIED_COUNT}个):${NC}"
        git diff --name-only 2>/dev/null | tee -a "$REPORT_FILE" | while read file; do
            log_and_echo "  M ${file}"
            # 显示变更行数统计
            ADDED=$(git diff --numstat -- "$file" 2>/dev/null | awk '{print $1}')
            DELETED=$(git diff --numstat -- "$file" 2>/dev/null | awk '{print $2}')
            log_and_echo "    +${ADDED:-0} / -${DELETED:-0} 行"
        done
    fi
    
    # 已暂存的文件
    if [ "$STAGED_COUNT" -gt 0 ]; then
        log_and_echo ""
        log_and_echo "${GREEN}[已暂存待提交] (${STAGED_COUNT}个):${NC}"
        git diff --cached --name-only 2>/dev/null | tee -a "$REPORT_FILE" | while read file; do
            log_and_echo "  S ${file}"
        done
    fi
    
    # 已删除的文件
    if [ "$DELETED_COUNT" -gt 0 ]; then
        log_and_echo ""
        log_and_echo "${RED}[已删除] (${DELETED_COUNT}个):${NC}"
        git diff --name-only --diff-filter=D 2>/dev/null | tee -a "$REPORT_FILE" | while read file; do
            log_and_echo "  D ${file}"
        done
    fi
    
    # 生成差异补丁（用于备份）
    log_and_echo ""
    log_and_echo "${BLUE}[*] 生成差异备份...${NC}"
    PATCH_FILE="logs/uncommitted-changes-$(date +%Y%m%d_%H%M%S).patch"
    git diff > "$PATCH_FILE" 2>/dev/null
    git diff --cached >> "$PATCH_FILE" 2>/dev/null
    log_and_echo "${GREEN}✓ 差异已保存至: ${PATCH_FILE}${NC}"
    
else
    log_and_echo "${GREEN}✓ 工作区干净，无未提交更改${NC}"
fi

echo "" >> "$REPORT_FILE"

# ============ 步骤 5: 安全拉取建议 ============
log_and_echo ""
log_and_echo "${BOLD}${YELLOW}步骤 5: 安全操作建议${NC}"
log_and_echo "------------------------------------------------------------"

if [ "$LOCAL_BEHIND" -gt 0 ]; then
    log_and_echo "${YELLOW}[建议] 本地落后 ${LOCAL_BEHIND} 个提交${NC}"
    log_and_echo ""
    log_and_echo "${BOLD}推荐操作 (使用 rebase 避免合并提交):${NC}"
    log_and_echo ""
    log_and_echo "  # 方式 1: 自动 rebase（推荐）"
    log_and_echo "  git pull --rebase ${REMOTE_NAME} ${CURRENT_BRANCH}"
    log_and_echo ""
    log_and_echo "  # 方式 2: 手动控制（更安全）"
    log_and_echo "  # 先查看远程新提交内容"
    log_and_echo "  git log HEAD..${REMOTE_NAME}/${CURRENT_BRANCH} --oneline"
    log_and_echo "  # 确认无误后 rebase"
    log_and_echo "  git rebase ${REMOTE_NAME}/${CURRENT_BRANCH}"
    log_and_echo ""
    log_and_echo "${RED}⚠ 注意: 在黑客松期间，执行前请确认：${NC}"
    log_and_echo "   1. 所有未提交的更改已备份或暂存 (git stash)"
    log_and_echo "   2. 服务器正在运行且稳定"
    log_and_echo "   3. 有其他团队成员知情"
    log_and_echo ""
    
    # 提供交互选项
    if [ "$TOTAL_CHANGES" -gt 0 ]; then
        log_and_echo "${RED}[重要] 你有未提交的更改，直接 pull 可能导致冲突！${NC}"
        log_and_echo "${YELLOW}建议先执行: git stash${NC}"
    fi
else
    log_and_echo "${GREEN}✓ 无需拉取，本地已是最新${NC}"
fi

echo "" >> "$REPORT_FILE"

# ============ 步骤 6: 待推送检查 ============
log_and_echo ""
log_and_echo "${BOLD}${YELLOW}步骤 6: 待推送状态${NC}"
log_and_echo "------------------------------------------------------------"

if [ "$LOCAL_AHEAD" -gt 0 ]; then
    log_and_echo "${CYAN}本地有 ${LOCAL_AHEAD} 个提交待推送到 ${REMOTE_NAME}/${CURRENT_BRANCH}${NC}"
    log_and_echo ""
    log_and_echo "${YELLOW}待推送的提交详情:${NC}"
    git log --pretty=format:"%h %ad | %s (%an)" --date=format:"%Y-%m-%d %H:%M" ${REMOTE_NAME}/${CURRENT_BRANCH}..HEAD 2>/dev/null | tee -a "$REPORT_FILE" | while read line; do
        log_and_echo "  → ${line}"
    done
    log_and_echo ""
    log_and_echo "${RED}⚠ 推送命令 (仅在你准备好的时候手动执行):${NC}"
    log_and_echo "  git push ${REMOTE_NAME} ${CURRENT_BRANCH}"
    log_and_echo ""
    log_and_echo "${BOLD}${RED}[安全提醒] 此脚本不会自动执行 push 操作！${NC}"
else
    log_and_echo "${GREEN}✓ 没有待推送的提交${NC}"
fi

echo "" >> "$REPORT_FILE"

# ============ 最终报告 ============
log_and_echo ""
log_and_echo "${BOLD}${CYAN}================================================================${NC}"
log_and_echo "${BOLD}${CYAN}                    状态总结${NC}"
log_and_echo "${BOLD}${CYAN}================================================================${NC}"
log_and_echo ""
log_and_echo "${BOLD}仓库:     ${REPO_URL}${NC}"
log_and_echo "${BOLD}分支:     ${CURRENT_BRANCH}${NC}"
log_and_echo "${BOLD}同步状态: ${SYNC_STATUS}${NC}"
log_and_echo ""
if [ "$LOCAL_BEHIND" -gt 0 ]; then
    log_and_echo "${YELLOW}落后: ${LOCAL_BEHIND} 个提交 (需拉取)${NC}"
fi
if [ "$LOCAL_AHEAD" -gt 0 ]; then
    log_and_echo "${CYAN}领先: ${LOCAL_AHEAD} 个提交 (待推送)${NC}"
fi
if [ "$TOTAL_CHANGES" -gt 0 ]; then
    log_and_echo "${YELLOW}工作区: ${TOTAL_CHANGES} 个文件有更改${NC}"
else
    log_and_echo "${GREEN}工作区: 干净${NC}"
fi
log_and_echo ""
log_and_echo "${BOLD}报告文件: ${REPORT_FILE}${NC}"
log_and_echo ""

# 安全操作建议汇总
log_and_echo "${BOLD}${GREEN}=== 推荐的安全操作 ===${NC}"
log_and_echo ""

if [ "$LOCAL_BEHIND" -gt 0 ] && [ "$TOTAL_CHANGES" -eq 0 ]; then
    log_and_echo "  ✓ 可以安全执行: git pull --rebase ${REMOTE_NAME} ${CURRENT_BRANCH}"
elif [ "$LOCAL_BEHIND" -gt 0 ] && [ "$TOTAL_CHANGES" -gt 0 ]; then
    log_and_echo "  ⚠ 先暂存更改: git stash"
    log_and_echo "  再拉取更新: git pull --rebase ${REMOTE_NAME} ${CURRENT_BRANCH}"
    log_and_echo "  恢复更改:   git stash pop"
elif [ "$LOCAL_BEHIND" -eq 0 ] && [ "$TOTAL_CHANGES" -gt 0 ]; then
    log_and_echo "  → 提交更改: git add . && git commit -m 'your message'"
fi

if [ "$LOCAL_AHEAD" -gt 0 ]; then
    log_and_echo ""
    log_and_echo "  📤 准备好后可推送: git push ${REMOTE_NAME} ${CURRENT_BRANCH}"
fi

log_and_echo ""
log_and_echo "${RED}${BOLD}=== 绝对禁止的操作 ===${NC}"
log_and_echo "  ✗ git push (在未经确认的情况下)"
log_and_echo "  ✗ git reset --hard"
log_and_echo "  ✗ git clean -fd"
log_and_echo "  ✗ 任何可能中断服务器的操作"
log_and_echo ""
log_and_echo "${CYAN}================================================================${NC}"
log_and_echo "${GREEN}✓ 检查完成 - 报告已保存至: ${REPORT_FILE}${NC}"
log_and_echo "${CYAN}================================================================${NC}"

# 清理临时文件
rm -rf "$TEMP_DIR" 2>/dev/null

exit 0
