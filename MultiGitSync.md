代码同步方法
本机开发 -> GitHub 0g
                |
                v
          同步到 Gitee 0g
                |
                v
  83 国内服务器从 Gitee 拉代码

  43 海外服务器从 GitHub 拉代码

  核心原则
  GitHub 是主仓: https://github.com/sanfordzhang/blockgame
  Gitee 是国内镜像仓: https://gitee.com/jackzhang118/blockgame

  国外服务器：http://43.163.114.175:3001/
  国内服务器：http://82.156.118.131:3001/

  不要双向同步，不要在 83 服务器往 Gitee 反向提交，避免分叉冲突。

  推荐流程

  1. 本机只 push GitHub：

     git push github 0g

  2. 43 海外服务器部署：

     git fetch github 0g
     git reset --hard github/0g
     npm ci
     npm run build
     pm2 reload testnet-server --update-env

  3. 同步 GitHub 到 Gitee：
     可以在本机、43 服务器、或 GitHub Actions 做。推荐先用 43 定时同步，稳定且可控。

     43 上配置两个 remote：

     git remote add gitee git@gitee.com:你的账号/game-core.git
     git fetch github 0g
     git push gitee github/0g:0g

  4. 83 国内服务器部署：

     git fetch gitee 0g
     git reset --hard gitee/0g
     npm ci
     npm run build
     pm2 reload testnet-server --update-env

  43 定期同步 GitHub -> Gitee 脚本
  例如 /home/ubuntu/scripts/sync-github-to-gitee.sh：

  #!/usr/bin/env bash
  set -euo pipefail

  APP_DIR="/home/ubuntu/game-core"
  BRANCH="0g"

  cd "$APP_DIR"

  git fetch github "$BRANCH"
  git push gitee "github/$BRANCH:$BRANCH"

  echo "synced github/$BRANCH to gitee/$BRANCH at $(date)"

  cron 每分钟或每 5 分钟执行：

  */2 * * * * /home/ubuntu/scripts/sync-github-to-gitee.sh >> /home/ubuntu/sync-gitee.log 2>&1

  83 部署脚本
  例如 /home/ubuntu/scripts/deploy-from-gitee.sh：

  #!/usr/bin/env bash
  set -euo pipefail

  APP_DIR="/home/ubuntu/game-core"
  BRANCH="0g"

  cd "$APP_DIR"

  git fetch gitee "$BRANCH"
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse gitee/$BRANCH)"

  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "already up to date: $LOCAL"
    exit 0
  fi

  git reset --hard "gitee/$BRANCH"
  npm ci
  npm run build
  pm2 reload testnet-server --update-env

  echo "deployed $REMOTE at $(date)"

  83 也可以定时跑：

  */2 * * * * /home/ubuntu/scripts/deploy-from-gitee.sh >> /home/ubuntu/deploy.log 2>&1

  注意点

  - GitHub 是唯一写入源，Gitee 只做镜像。
  - 43 只从 GitHub 拉，83 只从 Gitee 拉。
  - .env、私钥、数据库、上传文件不要进 Git。
  - 服务器部署用 git reset --hard remote/0g，不要在服务器手工改源码。
  - 如果服务器上必须临时改代码，先同步回本机或开临时分支，不要直接覆盖主分支。