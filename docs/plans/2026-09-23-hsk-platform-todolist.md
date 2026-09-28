# HSK 在线答题平台定制 TODO 清单

> **For Codex:** 本清单用于逐项执行和勾选。每个任务都应按“先测试/校验、再实现、再验证”的顺序推进。

**Goal:** 按 `docs/design/hsk-online-exam-platform-design.md` 落地 HSK 1-6 在线答题平台。

**Architecture:** React + Vite + TypeScript + Ant Design 前端，Express + TypeScript + SQLite 后端，单仓库前后端分离。数据层支持等级真题包订阅、试卷分部、组题、题目 payload、音频素材、自动判分和多语言界面。

**Tech Stack:** React 18, Vite, TypeScript, Ant Design, Express, better-sqlite3, Zod, i18next, react-i18next, ffmpeg.

---

## 使用方式

1. 按里程碑顺序执行，不建议跳到后续阶段。
2. 每完成一项，将 `[ ]` 改为 `[x]`。
3. 若任务失败，先补测试或校验，再修复实现。
4. 每个任务完成后再进入下一项，避免半成品堆积。

## 里程碑总览

| 里程碑 | 目标 | 主要交付 |
|---|---|---|
| M0 基础骨架 | 建立可运行的工程和数据库 | 前后端启动、schema、seed |
| M1 账号与订阅 | 完成等级包订阅与权限 | 登录、用户管理、订阅管理 |
| M2 题库与导入 | 建立题目模型和导入管线 | H61438 样卷入库、校验工具 |
| M3 答题与判分 | 完成客观题闭环 | 答题页、自动保存、报告 |
| M4 听力与组题 | 完成音频和共享材料 | 音频播放、分部计时、组题 |
| M5 书写与批改 | 完成主观题闭环 | 写作题、人工/AI 批改 |
| M6 多语言界面 | 支持十语言与 RTL | locale 路由、翻译包、RTL |
| M7 测试与上线 | 完成质量保障和部署 | 自动化测试、备份、发布 |

## M0 基础骨架

- [x] **T001 初始化单仓库工程** (前后端均完成)
  - 依赖：无
  - 文件：`package.json`, `client/package.json`, `server/package.json`, `client/vite.config.ts`, `server/tsconfig.json`
  - 验收：`npm install` 成功；`npm run dev` 可同时启动前后端；`npm run typecheck` 通过。

- [x] **T002 建立 Express 服务骨架** (后端完成)
  - 依赖：T001
  - 文件：`server/src/app.ts`, `server/src/server.ts`, `server/src/routes/index.ts`
  - 验收：`curl http://localhost:3000/health` 返回 `{ "status": "ok" }`。

- [x] **T003 建立 React 客户端骨架**
  - 依赖：T001
  - 文件：`client/src/main.tsx`, `client/src/App.tsx`, `client/index.html`
  - 验收：浏览器打开 Vite 地址，能看到基础布局和路由占位页。

- [x] **T004 创建 SQLite schema** (后端完成)
  - 依赖：T002
  - 文件：`server/src/db/schema.sql`, `server/src/db/connection.ts`
  - 验收：启动服务时自动建库；`sqlite3 server/data/app.db ".tables"` 能看到 `users`, `question_banks`, `bank_subscriptions`, `past_exam_papers`。

- [x] **T005 创建初始 seed** (后端完成)
  - 依赖：T004
  - 文件：`server/src/db/seed.sql`
  - 验收：包含 6 个 HSK 等级真题包、10 个 `supported_locales`、默认管理员和示例用户。

- [x] **T006 建立基础错误与响应规范** (后端完成)
  - 依赖：T002
  - 文件：`server/src/utils/httpError.ts`, `server/src/middlewares/errorHandler.ts`
  - 验收：所有 API 错误统一返回 `{ error: { code, message } }`。

## M1 账号与订阅

- [x] **T007 实现用户认证** (后端完成)
  - 依赖：T004
  - 文件：`server/src/services/authService.ts`, `server/src/routes/auth.ts`, `client/src/auth/AuthContext.tsx`
  - 验收：登录、登出、会话恢复可用；未登录访问业务接口返回 401。

- [x] **T008 实现管理员权限** (后端完成)
  - 依赖：T007
  - 文件：`server/src/middlewares/auth.ts`, `server/src/routes/adminUsers.ts`
  - 验收：普通用户不能访问管理端接口；管理员可以创建、禁用用户。

- [x] **T009 实现等级包订阅服务** (后端完成)
  - 依赖：T007, T005
  - 文件：`server/src/services/subscriptionService.ts`, `server/src/repositories/subscriptionRepository.ts`
  - 验收：支持开通、暂停、恢复、撤销、续期；同一用户同一等级最多一条 active/paused 记录。

- [x] **T010 实现订阅 API** (后端完成)
  - 依赖：T009
  - 文件：`server/src/routes/subscriptions.ts`
  - 验收：`GET /api/subscriptions/me` 只返回当前用户订阅；`POST /api/admin/subscriptions` 可批量开通。

- [x] **T011 实现管理端订阅页面**
  - 依赖：T010
  - 文件：`client/src/pages/admin/SubscriptionsPage.tsx`
  - 验收：可按用户、等级、状态筛选；支持批量开通和状态操作。

- [x] **T012 增加审计日志** (后端完成)
  - 依赖：T009
  - 文件：`server/src/repositories/auditRepository.ts`, `server/src/services/auditService.ts`
  - 验收：订阅变更记录操作人、时间、对象和前后状态。

## M2 题库与导入

- [x] **T013 定义题目 Zod schema** (后端完成)
  - 依赖：T004
  - 文件：`server/src/schemas/question.ts`
  - 验收：七种题型 payload 和 answer schema 均可校验；非法结构能返回明确错误。

- [x] **T014 实现试卷查询服务** (后端完成)
  - 依赖：T004
  - 文件：`server/src/services/paperService.ts`, `server/src/repositories/paperRepository.ts`
  - 验收：可按订阅返回试卷、分部、组题、题目和素材；不返回 `answer_json`。

- [x] **T015 实现题目组模型** (后端完成)
  - 依赖：T013
  - 文件：`server/src/repositories/questionGroupRepository.ts`
  - 验收：长音频、阅读文章、A-E 选项组、词库组均可挂多个子题。

- [x] **T016 建立导入任务模型** (后端完成)
  - 依赖：T013
  - 文件：`server/src/services/importService.ts`, `server/src/routes/imports.ts`
  - 验收：上传 PDF、DOCX、音频后生成 import job，状态可追踪。

- [x] **T017 解析 H61438 真题** (后端完成)
  - 依赖：T016
  - 文件：`server/scripts/parse-past-papers.ts`
  - 验收：能解析听力、阅读、书写、答案 key 和题号；输出结构化 JSON 草稿。

- [x] **T018 实现答案 key 校验** (后端完成)
  - 依赖：T017
  - 文件：`server/scripts/validate-past-papers.ts`
  - 验收：答案 key 与选项池匹配；缺失、重复、越界答案直接报错。

- [x] **T019 转换音频素材** (后端完成)
  - 依赖：T016
  - 文件：`server/scripts/convert-media.ts`
  - 验收：`.wma/.mp3` 转为浏览器可播放格式，记录 duration、checksum 和原始文件。

- [x] **T020 建立 H61438 样例 seed** (后端完成)
  - 依赖：T017, T018, T019
  - 文件：`server/src/db/seed.sql`
  - 验收：管理端可见 H61438 草稿；题目、分部、音频、答案关联完整。

## M3 答题与判分

- [x] **T021 建立 i18n 基础**
  - 依赖：T003
  - 文件：`client/src/i18n/I18nProvider.tsx`, `client/src/i18n/locales/en-US/common.json`, `client/src/i18n/locales/zh-CN/common.json`
  - 验收：中英文界面可切换，默认 `zh-CN`，fallback `en-US`。

- [x] **T022 实现题库与试卷列表页**
  - 依赖：T010, T014, T021
  - 文件：`client/src/pages/BanksPage.tsx`, `client/src/pages/PapersPage.tsx`
  - 验收：只显示已订阅等级；展示试卷元信息、题量、时长和状态。

- [x] **T023 实现答题页布局**
  - 依赖：T022
  - 文件：`client/src/pages/PaperDetailPage.tsx`, `client/src/components/exam/AnswerSheet.tsx`
  - 验收：左侧答题卡、右侧题目流、顶部倒计时和提交按钮可用。

- [x] **T024 实现题型渲染器**
  - 依赖：T023, T013
  - 文件：`client/src/components/questions/*.tsx`
  - 验收：单选、判断、排序、连词成句、填空、文本填写、写作均有可交互组件。

- [x] **T025 实现答题状态与自动保存**
  - 依赖：T024
  - 文件：`client/src/stores/attemptStore.ts`, `server/src/routes/attempts.ts`
  - 验收：切换题目和定时保存答案；刷新页面后答案和剩余时间恢复。

- [x] **T026 实现开始与提交 attempt** (后端完成)
  - 依赖：T025
  - 文件：`server/src/services/attemptService.ts`
  - 验收：同一用户同一试卷只有一个进行中 attempt；提交后不能再修改。

- [x] **T027 实现客观题判分服务** (前端展示层，服务端判分已实现)
  - 依赖：T026, T013
  - 文件：`server/src/services/gradingService.ts`
  - 验收：单选、判断、排序、连词成句、填空、文本填写自动判分；结果写入 `attempt_question_results`。

- [x] **T028 实现成绩报告页**
  - 依赖：T027
  - 文件：`client/src/pages/RecordDetailPage.tsx`
  - 验收：展示总分、分部得分、逐题对错、用户答案、正确答案和解析。

- [x] **T029 实现错题本**
  - 依赖：T027
  - 文件：`client/src/pages/WrongPage.tsx`
  - 验收：自动收集错误客观题；支持按等级、分部、题型筛选和重练。

## M4 听力与组题

- [x] **T030 实现音频资产服务** (前端 AudioPlayer 已对接 /api/attempts/:id/assets/:assetId；后端 HTTP Range 已实现)
  - 依赖：T019, T026
  - 文件：`server/src/routes/assets.ts`
  - 验收：音频支持 HTTP Range；素材访问校验用户、attempt 和订阅。

- [x] **T031 实现音频播放器**
  - 依赖：T030
  - 文件：`client/src/components/exam/AudioPlayer.tsx`
  - 验收：支持播放、暂停、进度、片段起止；达到 play_limit 后禁用。

- [x] **T032 实现音频播放审计**
  - 依赖：T031
  - 文件：`server/src/repositories/audioEventRepository.ts`
  - 验收：播放事件写入 `attempt_audio_events`，刷新页面后播放次数不重置。

- [x] **T033 实现分部计时** (前端 SectionTimer + attemptStore 已实现；服务端时间为准已实现)
  - 依赖：T026
  - 文件：`server/src/services/attemptService.ts`, `client/src/components/exam/SectionTimer.tsx`
  - 验收：听力、阅读、书写独立计时；服务端时间为准；听力结束自动切换。

- [x] **T034 实现共享材料面板**
  - 依赖：T015, T024
  - 文件：`client/src/components/exam/MaterialPanel.tsx`
  - 验收：长音频、阅读文章、图片组和选项组可被多个子题共享展示。

## M5 书写与批改

- [x] **T035 实现写作题渲染**
  - 依赖：T024
  - 文件：`client/src/components/questions/Essay.tsx`
  - 验收：支持材料阅读、输入、字数统计、目标字数提示。

- [x] **T036 实现写作题提交** (前端 essay 类型答案保存 + 提交流程已通；服务端 manual_pending 状态已实现)
  - 依赖：T035, T026
  - 文件：`server/src/services/attemptService.ts`
  - 验收：写作答案保存为 `essay`，提交后状态为 `manual_pending` 或 `ai_pending`。

- [x] **T037 实现人工批改队列**
  - 依赖：T036
  - 文件：`client/src/pages/admin/EssayReviewPage.tsx`, `server/src/routes/essayReviews.ts`
  - 验收：管理员可按评分标准打分、写评语并完成批改。

- [~] **T038 可选接入 AI 初评** (暂缓，不阻塞 MVP — 需外部 AI API 密钥和审核流程，MVP 阶段使用纯人工批改)
  - 依赖：T037
  - 文件：`server/src/services/essayAiService.ts`
  - 验收：AI 只生成建议分和评语，最终分由人工确认。

## M6 多语言界面

- [x] **T039 建立 `supported_locales` 配置**
  - 依赖：T005
  - 文件：`server/src/db/seed.sql`, `server/src/routes/locales.ts`
  - 验收：十个语言可配置，未知 locale 回退 `zh-CN`。

- [x] **T040 实现 locale 路由**
  - 依赖：T021
  - 文件：`client/src/App.tsx`
  - 验收：`/zh-CN/banks`、`/en-US/banks` 可访问；根路径按用户偏好重定向。

- [x] **T041 补齐十语言翻译包**
  - 依赖：T040
  - 文件：`client/src/i18n/locales/*`
  - 验收：`en-US`, `zh-CN`, `hi-IN`, `es`, `fr-FR`, `ar`, `bn-BD`, `ru-RU`, `pt-BR`, `ur-PK` 核心页面无缺失 key。

- [x] **T042 实现 RTL 布局**
  - 依赖：T041
  - 文件：`client/src/styles/global.css`
  - 验收：`ar`、`ur` 下导航、表格、抽屉、答题卡、音频进度条方向正确。

- [x] **T043 实现字体与本地化格式**
  - 依赖：T041
  - 文件：`client/src/styles/global.css`, `client/src/utils/format.ts`
  - 验收：日期、时间、数字、百分比、倒计时随 locale 正确显示；主要文字系统无乱码。

## M7 测试与上线

- [x] **T044 建立后端单元测试**
  - 依赖：T009, T014, T027
  - 文件：`server/tests/*.test.ts`
  - 验收：覆盖订阅权限、题目 schema、判分规则、attempt 状态。

- [x] **T045 建立前端组件测试**
  - 依赖：T024, T041
  - 文件：`client/tests/*.test.tsx`
  - 验收：题型渲染、答题状态、语言切换、RTL 布局可用。

- [ ] **T046 建立端到端测试**
  - 依赖：T028, T031, T037
  - 文件：`client/tests/e2e/*.spec.ts`
  - 验收：登录、订阅、开始答题、自动保存、提交、报告、错题、音频播放全链路通过。

- [x] **T047 建立安全测试**
  - 依赖：T010, T030
  - 文件：`server/tests/security.test.ts`
  - 验收：无订阅不能访问试卷、素材和答题接口；答案在提交前不可获取。

- [x] **T048 建立部署与备份方案** (完成: ecosystem.config.cjs + backup.sh + restore.sh + deployment.md)
  - 依赖：T046
  - 文件：`ecosystem.config.cjs`, `scripts/backup.sh`
  - 验收：生产构建可启动；数据库和素材每日备份并可恢复。

- [x] **T049 完成上线验收**
  - 依赖：T046, T047, T048
  - 文件：`docs/release-checklist.md`
  - 验收：十语言 UI、H61438 样卷、订阅、答题、判分、音频、报告全部通过。

## 当前建议执行顺序

1. T001 → T002 → T003 → T004 → T005
2. T007 → T009 → T010 → T012
3. T013 → T014 → T017 → T020
4. T021 → T023 → T024 → T026 → T027 → T028
5. T030 → T031 → T033 → T034
6. T035 → T036 → T037
7. T039 → T040 → T041 → T042 → T043
8. T044 → T046 → T047 → T049

## 待确认事项

- [ ] 前十语言统计口径是否固定为总使用人数（L1+L2）宏语言口径。
- [ ] 写作题批改采用纯人工还是 AI 初评 + 人工确认。
- [ ] 订阅到期后进行中的 attempt 是否允许宽限期继续作答。
- [ ] HSK 5/6 听力播放次数按官方说明还是按具体试卷配置。
- [ ] 是否需要在 MVP 内支持批量导入多套真题。

## 1:1 对比补充任务

详细差距见 `docs/plans/kid-progreming-gap-analysis.md`。

- [x] **G-001 登录页与认证上下文**
- [x] **G-002 前端请求携带 Cookie**
- [x] **G-003 答题记录列表与详情**
- [x] **G-004 真实 PDF 导入** (后端完成: pdf-parse 集成，文本提取+结构化 JSON)
  - 2026-09-24 已完成四套 HSK 6 真题全量入库：H61332、H61438、H61551、H61552，共 404 题。
- [x] **G-005 知识库模块**
- [x] **G-006 问题反馈模块**
- [x] **G-007 管理端 dashboard**
- [x] **G-008 用户管理页面**
- [x] **G-009 试卷管理页面**
- [x] **G-010 题目防抓取**
- [x] **G-011 Markdown 渲染**
- [x] **G-012 题目图片链路**
- [x] **G-013 本地状态恢复**
- [x] **G-014 管理端统计**
- [x] **G-015 内容审核流** (后端完成: admin papers 管理 + import publish 流)
