# HSK Helper 部署指南

## 前提条件

- Node.js 22+
- SQLite 3.35+
- PM2 (`npm install -g pm2`)
- (可选) ffmpeg — 用于音频转码脚本

## 生产构建

```bash
# 安装依赖
npm install --workspace server

# 编译 TypeScript 并复制 SQL 到 dist/
npm run build --workspace server

# 验证编译结果
npm run typecheck --workspace server
npm run test --workspace server
```

## 配置

复制 `.env.example` 为 `.env` 并按需修改:

```bash
cp server/.env.example .env
```

关键变量:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 服务端口 |
| `DB_PATH` | `./data/app.db` | SQLite 数据库路径 |
| `CORS_ORIGIN` | (空=允许全部) | 前端地址 |
| `INITIAL_ADMIN_USERNAME` | `admin` | 初始管理员用户名 |
| `INITIAL_ADMIN_PASSWORD` | `Admin2026` | 初始管理员密码 (上线后务必修改) |
| `ASSET_ROOT` | `./data/assets` | 音频/图片素材目录 |

## 使用 PM2 启动

```bash
# 加载环境变量
set -a; source .env; set +a

# 启动
pm2 start ecosystem.config.cjs --only hsk-helper

# 查看日志
pm2 logs hsk-helper

# 重启
pm2 restart hsk-helper

# 停止
pm2 stop hsk-helper
```

## 使用 Node 直接启动

```bash
set -a; source .env; set +a
npm run start --workspace server
```

## 备份

```bash
# 手动备份
./scripts/backup.sh

# 指定备份目录
./scripts/backup.sh /mnt/backup/hsk_$(date +%Y%m%d)
```

备份内容:
- SQLite 数据库 (通过 `.backup` API 一致快照)
- 素材文件目录 (rsync 增量复制)
- 自动压缩为 `.tar.gz`
- 自动保留最近 30 份备份

Cron 定时备份 (每日 02:00):

```cron
0 2 * * * cd /path/to/hsk_helper && ./scripts/backup.sh >> backups/cron.log 2>&1
```

## 恢复

```bash
# 查看备份列表
ls -t backups/*.tar.gz | head

# 恢复 (需确认)
./scripts/restore.sh backups/2026-09-23_020000.tar.gz --confirm
```

恢复过程:
- 停止 PM2 进程
- 当前数据库保存为 `.pre-restore`
- 用备份数据覆盖
- 恢复素材文件
- 重启 PM2 进程

## 首次部署检查清单

1. `npm run build --workspace server` 编译成功
2. `npm run typecheck --workspace server` 无类型错误
3. `npm run test --workspace server` 测试通过
4. `pm2 start ecosystem.config.cjs` 服务启动
5. `curl http://localhost:3001/health` 返回 `{"status":"ok"}`
6. 用默认管理员登录后立即修改密码
7. 创建用户、开通订阅、确认数据正常
8. 配置 cron 备份并验证一次恢复
