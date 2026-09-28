# HSK Helper

HSK 1-6 在线答题与模拟考平台。项目复用 `kid_progreming` 的前后端分离结构，面向 HSK 真题训练场景，支持等级包订阅、限时整卷作答、听力播放、自动判分、写作批改、错题本和十语言界面。

## 技术栈

- 前端：React 18、Vite 5、TypeScript、Ant Design 5、React Router 6、i18next
- 后端：Node.js 22+、Express 4、TypeScript、Zod
- 数据库：SQLite + better-sqlite3
- 数据导入：PDF 文本抽取、Tesseract 中文 OCR、DOC/DOCX 答案解析
- 部署：PM2、SQLite 备份/恢复脚本

## 功能概览

- HSK 1-6 等级真题包订阅
- 真题与模拟卷列表
- 听力、阅读、书写三部分计时作答
- 单选、判断、排序、连词成句、填空、文本填写、写作七类题型
- 答案自动保存与刷新恢复
- 客观题自动判分，写作题人工批改
- 听力音频、播放次数记录和分部计时
- 练习记录、成绩报告、错题本
- 知识库和问题反馈
- 管理端订阅、用户、试卷、作文批改、反馈和统计
- 十语言界面：中文、英语、印地语、西班牙语、法语、阿拉伯语、孟加拉语、俄语、葡萄牙语、乌尔都语

## 目录结构

```text
hsk_helper/
├── client/                 # React 前端
├── server/                 # Express 后端
│   ├── scripts/            # 数据提取与导入脚本
│   └── src/                # API、数据库、服务、测试
├── docs/
│   ├── 61332/              # HSK6 真题样例
│   ├── 61438/
│   ├── 61551/
│   ├── 61552/
│   ├── design/             # 产品与技术设计
│   └── plans/              # TODO、测试、导入、部署文档
├── data/
│   ├── app.db              # SQLite 数据库
│   ├── answers/            # 答案文本
│   ├── extracted/          # 试卷文本
│   ├── imported/           # 设计格式 JSON
│   └── ocr/                # OCR 中间结果
├── scripts/                # 备份与恢复
└── ecosystem.config.cjs    # PM2 配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

> 如果从 Node 22 切换到 Node 24，或出现 `ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION` 不匹配，请先执行：
>
> ```bash
> npm rebuild better-sqlite3
> ```

启动后：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>
- 健康检查：<http://localhost:3001/health>

如果 5173 被占用，Vite 会自动切换端口。前端代理已指向 `http://localhost:3001`。

### 3. 默认账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| `admin` | `Admin2026` | 管理员 |
| `student` | `Study2026` | 学生 |

生产环境部署后请立即修改默认管理员密码。

## 数据导入

项目内置四套 HSK 6 真题数据：

| 试卷 | 年份 | 听力 | 阅读 | 书写 | 总题数 |
|---|---:|---:|---:|---:|---:|
| H61332 | 2017 | 50 | 50 | 1 | 101 |
| H61438 | 2013 | 50 | 50 | 1 | 101 |
| H61551 | 2017 | 50 | 50 | 1 | 101 |
| H61552 | 2017 | 50 | 50 | 1 | 101 |

合计 404 题。

### 从 `docs/` 重新提取

```bash
npm run extract:docs --workspace server
```

输出：

- `data/extracted/`
- `data/answers/`
- `data/imported/`

### 从 `data/` 提取 HSK1/2 真题包

```bash
npm run extract:data
```

输出会写入 `data/extracted/`、`data/answers/`、`data/imported/`，并在
`docs/plans/data-dir-extraction-report.md` 记录完整卷、缺口卷和音频/答案覆盖情况。

### 提取 HSK1 图片题答案

```bash
npm run extract:image-answers
```

输出会写入 `data/image-answers/`，并把单题图片保存到 `data/assets/images/<paper>/individual/`。

### 导入 HSK1/2 真题到 SQLite

```bash
npm run import:data
```

导入前建议先备份 `data/app.db`。WMA 听力音频已统一转成 MP3，输出在 `data/media/`。

### 导入 SQLite

```bash
npm run import:docs --workspace server
```

导入内容：

- 试卷、分部、材料、题组、题目、题目版本
- 题干、选项、答案、分值
- 听力音频、原始 PDF、答案文件
- 导入任务记录

导入前请先备份：

```bash
cp data/app.db data/app.db.backup
```

## 常用命令

```bash
# 类型检查
npm run typecheck

# 全部测试
npm test

# 后端测试
npm run test:server

# 前端测试
npm run test:client

# 生产构建
npm run build

# 生产启动
npm run start
```

## 环境变量

复制示例配置：

```bash
cp server/.env.example .env
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | 后端端口 |
| `DB_PATH` | `./data/app.db` | SQLite 数据库路径 |
| `CORS_ORIGIN` | `http://localhost:5173` | 前端地址 |
| `INITIAL_ADMIN_USERNAME` | `admin` | 初始管理员用户名 |
| `INITIAL_ADMIN_PASSWORD` | `Admin2026` | 初始管理员密码 |
| `ASSET_ROOT` | `./data/assets` | 素材目录 |

## 测试

当前测试覆盖：

- 认证与会话
- 订阅权限
- 试卷访问
- 答案隐藏
- attempt 状态机
- 七类题型判分
- 报告与错题
- 音频事件
- 知识库与反馈
- 管理端接口
- 十语言 key 与 locale 配置

运行结果：

```bash
npm test
```

## 生产部署

详细步骤见 [docs/deployment.md](docs/deployment.md)。

简要流程：

```bash
npm install
npm run build
cp server/.env.example .env
set -a; source .env; set +a
pm2 start ecosystem.config.cjs --only hsk-helper
```

健康检查：

```bash
curl http://localhost:3001/health
```

## 备份与恢复

```bash
# 手动备份
./scripts/backup.sh

# 恢复
./scripts/restore.sh backups/<backup-file>.tar.gz --confirm
```

备份保留最近 30 份。建议配置 cron 每日备份。

## 文档索引

- [产品与技术设计](docs/design/hsk-online-exam-platform-design.md)
- [TODO 清单](docs/plans/2026-09-23-hsk-platform-todolist.md)
- [差距分析](docs/plans/kid-progreming-gap-analysis.md)
- [测试计划](docs/plans/test-plan.md)
- [数据导入报告](docs/plans/data-import-report.md)
- [部署指南](docs/deployment.md)
- [发布验收清单](docs/release-checklist.md)

## 已知边界

- AI 作文初评暂未接入，MVP 使用人工批改。
- 浏览器级 Playwright E2E 尚未在沙箱环境执行，当前由 Vitest 集成测试覆盖 API 关键路径。
- 扫描版真题使用 OCR，题干文本可能存在少量识别误差，建议上线前人工抽查。
# hsk_helper
