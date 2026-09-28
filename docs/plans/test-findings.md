# 测试发现记录

| 项目 | 内容 |
|---|---|
| 文档版本 | v3.0 |
| 日期 | 2026-09-23 |
| 编制人 | 测试负责人（Codex 委派） |
| 关联文件 | `docs/plans/test-plan.md`, `docs/release-checklist.md` |

---

## 发现列表

| ID | 严重 | 里程碑 | 关联验收 | 路径 | 描述 | 状态 |
|---|---|---|---|---|---|---|
| F-001 | P1 | M0 | A003 | 工程骨架 | **端口不匹配**：`server/src/server.ts` 默认 3001，`client/vite.config.ts` proxy 指向 3000。 | 已修复：代理改为 3001 |
| F-002 | P3 | M6 | A102 | i18n | 仅 `zh-CN` 和 `en-US` 翻译包，M6 补齐。 | 已修复：十语言翻译包已落地 |
| F-003 | P3 | M3 | A051 | 答题 | BanksPage 已接入 API。 | 预期内 |
| F-004 | P1 | M2 | A016 | 工程骨架 | **缺失 `routes/imports.ts`**：`routes/index.ts` 导入 `./imports.js` 但文件不存在。已创建测试 stub。 | 已修复：真实导入路由已落地 |
| F-005 | P1 | M0 | A005 | seed | **seed.sql FK 顺序**：`paper_questions` 在 `paper_sections` 之前插入。测试中通过 `PRAGMA foreign_keys = OFF` 绕过。 | 已修复：`paper_sections` 先插入 |
| F-006 | P1 | M3 | A061 | B | **报告 user_answer bug**：`getQuestionResults` 中 `SELECT r.*, qv.answer_json` 列名冲突，`r.answer_json`（用户答案）被 `qv.answer_json`（正确答案）覆盖。 | 已修复：查询显式别名 `user_answer` 与 `correct_answer` |
| F-007 | P1 | M4 | A071 | A | **async 路由错误未捕获**：`attempts.ts` 的 `/assets/:assetId` 路由使用 `async` handler，但 Express 4 不自动捕获 async handler 中的 throw。导致 403/404 错误不被错误处理中间件捕获。 | 已修复：新增 `asyncHandler` 并包装音频资产路由 |
| F-010 | P0 | M1/M3 | A024/A051 | 前端 | **登录后页面空白**：后端统一返回 `{ data: ... }` 且字段为 snake_case，前端按 `{ subscriptions: ... }` 和 camelCase 解构，`BanksPage` 读取 `subscriptions.length` 时崩溃。 | 已修复：API client 统一解包 `data` 并转换 camelCase |
| F-011 | P1 | M3 | A051 | 前端/后端 | **重复进入试卷不能继续作答**：已有 in-progress attempt 时后端返回 409，前端显示服务器错误。 | 已修复：API 返回现有 attemptId，前端自动恢复 |

---

## 测试运行结果

| 日期 | 范围 | 文件数 | 通过 | 失败 | 备注 |
|---|---|---|---|---|---|
| 2026-09-23 R2 | 后端基础 | 5 | 29 | 0 | schema, seed, health, locales, error |
| 2026-09-23 R2 | 前端基础 | 4 | 27 | 0 | locales, i18n, notFoundPage, banksPage |
| 2026-09-23 R3 | 后端全量 | 13 | 187 | 0 | +schema, auth, subscription, paper, attempt, grading |
| 2026-09-23 R3 | 前端全量 | 5 | 37 | 0 | +questionRenderers |
| 2026-09-23 R4 | 后端全量 | 15 | 216 | 0 | +security, attemptApi |
| 2026-09-23 R4 | 前端全量 | 7 | 57 | 0 | +format, audioPlayer |
| 2026-09-23 R4 | typecheck | - | - | 0 | 通过 |
| 2026-09-23 R4 | build | - | - | 0 | 成功 |

---

## 第五轮新增发现 (2026-09-23 R5)

| ID | 严重 | 描述 | 状态 |
|---|---|---|---|
| F-008 | P1 | **客户端缺失 4 个管理页面**：`App.tsx` 导入 `AdminDashboardPage`、`AdminFeedbackPage`、`AdminPapersPage`、`AdminUsersPage`，但文件不存在。导致 `tsc --noEmit` 和 `vite build` 失败。 | 待创建 |
| F-009 | P1 | **FeedbackPage 缺少 useParams 导入**：`src/pages/FeedbackPage.tsx` 使用 `useParams` 但未从 `react-router-dom` 导入。 | 待修复 |

### 2026-09-24 复验更新

| ID | 状态更新 |
|---|---|
| F-008 | 已修复：4 个管理页面已存在，并新增 AdminKnowledgePage；typecheck/build 通过 |
| F-009 | 已修复：FeedbackPage 可正常编译和渲染 |
| 新增 | Dashboard 响应解包、旧库 seed 回填、Markdown 换行、反馈用户名映射、知识库计数和管理 API 均已补测试 |

### 2026-09-24 学生端专项复验

| 问题 | 状态 |
|---|---|
| 听力材料/音频组件未接入答题页 | 已修复：`MaterialPanel` 渲染共享材料，音频元数据从 `material_assets` 返回 |
| 书写题材料显示“尚未实现” | 已修复：渲染导入的原文材料 |
| 提交后报告跳转 `/attempts/undefined/report` | 已修复：使用 attempt store 中的真实 attempt id |
| 报告接口缺少 `sections`/`passing_score`/`passed` | 已修复：服务端返回分部报告与合格信息 |
| 记录详情复用报告组件但没有传 attemptId | 已修复 |
| 错题接口字段与前端契约不匹配 | 已修复：返回题号、用户答案、正确答案和解析，并映射 HSK 等级 |
| 学生首页缺少学习概览 | 已修复：显示题库数、练习次数、错题数 |
| 反馈页硬编码且缺少类型/错误态 | 已修复：使用 AntD 表单、反馈类型、状态、错误态和十语言文案 |
| 小屏答题卡体验不足 | 已修复：使用 AntD `Drawer` |
| 语言设置不持久化 | 已修复：调用 `/me/preferences` |

页面验证：学生账号可进入 HSK6 真题、播放听力、阅读书写材料、提交、查看报告、查看记录/错题、提交反馈。前端测试改为单 worker 以避免本机磁盘接近满时 jsdom 临时文件并发写入失败。

---

## 第五轮测试运行结果

| 日期 | 范围 | 文件数 | 通过 | 失败 | 跳过 | 备注 |
|---|---|---|---|---|---|---|
| 2026-09-23 R5 | 后端全量 | 18 | 235 | 0 | 24 | +adminUsersApi, importService, gapAreas (skipped) |
| 2026-09-23 R5 | 前端全量 | 8 | 60 | 0 | 0 | +adminPages |
| 2026-09-23 R5 | typecheck | - | - | 5 | - | **失败**：F-008, F-009 |
| 2026-09-23 R5 | build | - | - | - | - | **失败**：同 typecheck |
