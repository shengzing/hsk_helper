# Gap 补齐顺序与责任分配

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 日期 | 2026-09-23 |
| 依据 | `docs/plans/kid-progreming-gap-analysis.md` |
| 参考 | `kid_progreming` 参考项目源码 |
| 任务源 | `docs/plans/2026-09-23-hsk-platform-todolist.md`（唯一业务任务源） |

---

## 1. 依赖关系复核

### 1.1 依赖图

```
G-001 (login + AuthContext) ──┬──> G-002 (credentials: include + 挂载 auth 路由)
                              │
                              ├──> G-003 (records) ──────────────> G-013 (local state)
                              │        ↑ 需后端 records API
                              │
                              ├──> G-005 (knowledge) ───────────> G-007 (admin dashboard)
                              │        ↑ 依赖 G-011 (Markdown)      ↑ 还需 G-008, G-009
                              │
                              ├──> G-006 (feedback)
                              │
                              ├──> G-008 (user mgmt) ────────────> G-007
                              │
                              └──> G-009 (paper mgmt) ───────────> G-015 (audit flow)
                                       ↑ 依赖 G-004

G-004 (PDF import) ──┬──> G-009 (paper mgmt 需要试卷数据)
                     ├──> G-012 (question images 从 PDF 提取)
                     └──> G-010 (anti-scraping 需要真实内容保护)
                              ↑ 还需 G-011 (Markdown), G-012 (images), G-002 (session key)

G-011 (Markdown) ──┬──> G-005 (knowledge 内容渲染)
                   └──> G-010 (ProtectedText Canvas 渲染)

G-012 (images) ───────> G-010 (加密图片加载)

G-007 (dashboard) ──> G-014 (dashboard 统计)
```

### 1.2 确认要点

**1) G-001 + G-002 必须最先做**

确认。原因：

- 后端 `auth.ts` 路由已存在（login / logout / me 三个端点），但 `routes/index.ts` 中**未挂载** `createAuthRouter`，导致认证链路断裂。
- 前端 `api/index.ts` 的 `fetch` 调用未设置 `credentials: "include"`，即使后端挂载了路由，浏览器也不会携带 session cookie。
- 没有 G-001（LoginPage + AuthContext + ProtectedRoute），所有页面都无法识别用户身份，订阅校验、答题、报告全部不可用。
- G-002 必须与 G-001 同步完成：AuthContext 需要调用 `/api/auth/me` 恢复会话，API client 需要 `credentials: "include"` 才能携带 cookie。

**2) G-003 records 依赖后端 API**

确认。当前状态：

- `attempts` 表已存在，含完整的 attempt 数据（分数、时间、状态）。
- 但后端没有 records 查询路由——`routes/index.ts` 中无 records 相关 router。
- 前端 `RecordsPage.tsx` 是空实现（仅显示 `not_implemented`）。
- 需要新增：后端 `GET /api/records`（按 user_id 分页查 attempts）+ `GET /api/records/:id`（详情含逐题结果）+ 前端列表页和详情页。
- G-003 不能只靠前端实现，必须前后端同步。

**3) G-004 PDF 导入依赖真实文件解析**

确认。当前状态：

- `server/scripts/parse-past-papers.ts` 仅 61 行，只做 JSON 校验（接受手工转录的 JSON 输入，用 Zod schema 验证后输出）。
- H61438 真题文件已存在于 `docs/61438/`：`Test.pdf`、`Listening.mp3`、`Answers.pdf`、`H61438听力 阅读.pdf`、`H61438书写.pdf`、`H61438答案.doc`。
- 需要引入 PDF 解析库（如 `pdf-parse` 或 `pdfjs-dist`），实现文本提取、双栏排版识别、图片提取、答案 key 解析。
- 这是 15 个 gap 中技术风险最高的一项（双栏 + 图文混排 + 听力原文与题干混合）。
- 建议先做文本层清晰的 PDF，扫描版走人工录入队列。

**4) G-010 防抓取应在 G-004 后做**

确认，且更精确地说应在 G-004 + G-011 + G-012 之后。原因：

- G-010 的防抓取体系包含：会话密钥交换（ECDH）、AES-GCM 加密响应、Canvas 文本渲染、加密图片加载。
- 如果没有 G-004（真实 PDF 导入），题库只有 5 题样例，没有需要保护的真实内容。
- 如果没有 G-011（Markdown 渲染），ProtectedText 没有 Markdown 解析后的文本可画到 Canvas。
- 如果没有 G-012（题目图片），QuestionImages 组件没有图片可解密加载。
- G-010 还依赖 G-002（`credentials: "include"`），因为会话密钥交换需要已认证的 session。
- 建议：G-010 放在 G-004 + G-011 + G-012 全部完成后，作为独立阶段实施。

### 1.3 与 gap 分析文档的差异修正

复核参考项目源码后发现 gap 分析文档有以下表述需修正：

| gap 分析描述 | 实际状态 | 修正 |
|---|---|---|
| G-005 "无表" | `knowledge_categories` 和 `knowledge_documents` 表已存在于 `schema.sql` | 缺的是 API 路由、repository、service 和前端页面实现，表结构已有 |
| G-006 "完全缺失" | `feedback` 表已存在于 `schema.sql`，含状态索引 | 缺的是 API 路由、repository、service 和前端页面，表结构已有 |
| G-001 未提及后端 | `auth.ts` 路由已实现 login/logout/me，但未在 `routes/index.ts` 中挂载 | 后端只需挂载路由，不需重写 |
| G-002 "未设置 credentials" | `api/index.ts` 中 `fetch` 确实未设置 | 同时缺少参考项目的 session 加解密逻辑（G-010 依赖） |

---

## 2. 补齐顺序与责任分配

### Phase 1: 认证打通（P0 阻塞）

| 顺序 | Gap | 角色 | 工作内容 | 文件范围 | 依赖 |
|---|---|---|---|---|---|
| 1.1 | G-001 | 前端 | 新增 LoginPage、AuthContext、ProtectedRoute、MainLayout 认证守卫 | `client/src/pages/LoginPage.tsx`, `client/src/auth/AuthContext.tsx`, `client/src/layouts/MainLayout.tsx`, `client/src/App.tsx` | 后端 auth 路由（已存在） |
| 1.2 | G-002 | 后端 + 前端 | 后端：在 `routes/index.ts` 挂载 `createAuthRouter`。前端：`api/index.ts` 的 `fetch` 加 `credentials: "include"` | `server/src/routes/index.ts`, `client/src/api/index.ts` | G-001 |

**验收：** 浏览器可登录、登出、刷新后自动恢复会话；所有 API 请求携带 cookie。

### Phase 2: 核心功能补齐（P0）

| 顺序 | Gap | 角色 | 工作内容 | 文件范围 | 依赖 |
|---|---|---|---|---|---|
| 2.1 | G-003 | 后端 | 新增 records 路由 + repository（按 user_id 查 attempts 列表和详情） | `server/src/routes/records.ts`, `server/src/repositories/recordRepository.ts`, `server/src/routes/index.ts` | G-001, G-002 |
| 2.2 | G-003 | 前端 | 实现 RecordsPage 列表 + RecordDetailPage 详情 + records 工具函数 | `client/src/pages/RecordsPage.tsx`, `client/src/pages/RecordDetailPage.tsx`, `client/src/utils/records.ts` | 2.1 |
| 2.3 | G-004 | 后端 | 重写 `parse-past-papers.ts`，引入 PDF 解析库，实现文本/图片/答案提取 | `server/scripts/parse-past-papers.ts`, `server/package.json`（新增 pdf 依赖） | G-001, G-002（验证导入结果需要登录） |

**验收：** 用户可查看历史练习列表和详情；H61438 可从 PDF 全量导入，题量与官方一致（101 题）。

### Phase 3: 功能模块补齐（P1）

| 顺序 | Gap | 角色 | 工作内容 | 文件范围 | 依赖 |
|---|---|---|---|---|---|
| 3.1 | G-011 | 前端 | 新增 Markdown 渲染组件（参考 `kid_progreming` 的 `Markdown.tsx`） | `client/src/components/Markdown.tsx`, `client/src/utils/questionMarkdown.ts` | 无 |
| 3.2 | G-005 | 后端 | 新增 knowledge 路由 + repository + service（表已存在） | `server/src/routes/knowledge.ts`, `server/src/repositories/knowledgeRepository.ts`, `server/src/services/knowledgeService.ts` | G-001, G-002 |
| 3.3 | G-005 | 前端 | 实现 KnowledgePage + 管理端知识库管理 | `client/src/pages/KnowledgePage.tsx` | 3.1, 3.2 |
| 3.4 | G-006 | 后端 | 新增 feedback 路由 + repository + service（表已存在） | `server/src/routes/feedback.ts`, `server/src/repositories/feedbackRepository.ts`, `server/src/services/feedbackService.ts` | G-001, G-002 |
| 3.5 | G-006 | 前端 | 实现 FeedbackPage + AdminFeedbackPage | `client/src/pages/FeedbackPage.tsx`, `client/src/pages/admin/FeedbackPage.tsx` | 3.4 |
| 3.6 | G-008 | 前端 | 实现 AdminHomePage 的用户管理分支（后端 API 已存在） | `client/src/pages/admin/AdminHomePage.tsx` | G-001, G-002 |
| 3.7 | G-009 | 前端 + 后端 | 前端实现试卷管理页；后端补充试卷 CRUD 端点（如缺失） | `client/src/pages/admin/AdminHomePage.tsx`（papers 分支）, `server/src/routes/adminPapers.ts` | G-004 |

**验收：** 知识库可检索并展示 Markdown；用户可提交反馈，管理员可回复；管理端有用户和试卷管理。

### Phase 4: 内容保护（P1）

| 顺序 | Gap | 角色 | 工作内容 | 文件范围 | 依赖 |
|---|---|---|---|---|---|
| 4.1 | G-012 | 后端 + 前端 | 后端：PDF 导入脚本提取图片并存入 assets。前端：QuestionImages 组件（含空白检测） | `server/scripts/parse-past-papers.ts`, `client/src/components/QuestionImages.tsx` | G-004 |
| 4.2 | G-010 | 后端 | 新增 `sessionCipher.ts`（ECDH + AES-GCM 加密），在 paper/attempt API 中加密敏感响应 | `server/src/utils/sessionCipher.ts`, `server/src/services/paperService.ts`, `server/src/services/attemptService.ts` | G-002, G-004, G-011, 4.1 |
| 4.3 | G-010 | 前端 | 新增 sessionCrypto、sessionKeyStore、ProtectedText，改造 API client 支持解密 | `client/src/utils/sessionCrypto.ts`, `client/src/utils/sessionKeyStore.ts`, `client/src/components/ProtectedText.tsx`, `client/src/api/index.ts`, `client/src/auth/AuthContext.tsx` | 4.2 |

**验收：** 题干、选项、解析经加密传输并在 Canvas 渲染；图片经加密加载；DevTools 中不可直接复制题干文本。

### Phase 5: 运营与体验（P2）

| 顺序 | Gap | 角色 | 工作内容 | 文件范围 | 依赖 |
|---|---|---|---|---|---|
| 5.1 | G-007 | 前端 | 实现 AdminHomePage dashboard（汇总用户、试卷、知识库、反馈统计） | `client/src/pages/admin/AdminHomePage.tsx` | G-005, G-008, G-009 |
| 5.2 | G-014 | 后端 + 前端 | 后端新增 stats API；前端 dashboard 统计组件 | `server/src/routes/adminStats.ts`, `client/src/pages/admin/AdminHomePage.tsx` | 5.1 |
| 5.3 | G-013 | 前端 | 新增 localState 工具，实现本地缓存与服务端恢复合并策略 | `client/src/utils/localState.ts`, `client/src/stores/attemptStore.tsx` | G-003 |
| 5.4 | G-015 | 后端 + 前端 | 后端新增审核队列和版本记录；前端审核/发布/下线 UI | `server/src/routes/adminAudit.ts`, `client/src/pages/admin/AuditPage.tsx` | G-004, G-009 |

**验收：** 管理端有 dashboard 和统计；刷新后当前题号、答案和剩余时间可恢复；导入后有完整审核/发布流程。

---

## 3. 并行策略

### 窗口 A：Phase 1 完成后 → Phase 2 完成前

| 后端 | 前端 |
|---|---|
| G-003 records API + G-004 PDF 解析 | G-003 records 页面（等后端 API）+ G-011 Markdown 组件 |

G-011（Markdown）无后端依赖，前端可在窗口 A 内独立完成。

### 窗口 B：Phase 2 完成后 → Phase 4 完成前

| 后端 | 前端 |
|---|---|
| G-005 knowledge API + G-006 feedback API | G-005 knowledge 页面 + G-006 feedback 页面 + G-008 用户管理 + G-009 试卷管理 |

后端和前端可按 gap 分头推进，前端等后端 API 就绪后联调。

### 窗口 C：Phase 4 完成后

| 后端 | 前端 |
|---|---|
| G-014 stats API + G-015 审核队列 | G-007 dashboard + G-013 local state + G-014 统计组件 + G-015 审核 UI |

---

## 4. 风险标注

| # | 风险 | Gap | 缓解措施 |
|---|---|---|---|
| R1 | **PDF 解析精度**：H61438 双栏排版 + 图文混排，文本提取顺序易错乱 | G-004 | 先验证 PDF 是否有文本层；扫描版走人工录入；提取后必须经 `validate-past-papers.ts` 校验题量和答案 key |
| R2 | **防抓取体系复杂度**：ECDH 密钥交换 + AES-GCM + Canvas 渲染 + IndexedDB 密钥存储，参考实现量大 | G-010 | 逐组件迁移：先 sessionKeyStore → sessionCrypto → sessionCipher → ProtectedText → QuestionImages → API client 改造 |
| R3 | **records API 性能**：attempt 关联 paper/section/result 多表 JOIN，列表分页需优化 | G-003 | repository 用预计算字段或物化视图；列表只返回摘要，详情按需加载 |
| R4 | **auth 路由未挂载**：`createAuthRouter` 已实现但 `routes/index.ts` 未引用 | G-002 | 后端在 Phase 1.2 中一行挂载即可，但需验证 cookie 的 `sameSite`/`secure` 配置在开发环境下生效 |
| R5 | **API client 改造冲突**：G-002 加 `credentials` 和 G-010 加解密逻辑都要改 `api/index.ts` | G-002, G-010 | Phase 1 只加 `credentials`；Phase 4 再加解密层。两次改动不同时进行 |

---

## 5. 管理约定

1. 本文件不创建新任务 ID，所有 gap 以 G-0XX 编号引用 `kid-progreming-gap-analysis.md`。
2. 业务代码任务仍以 `2026-09-23-hsk-platform-todolist.md` 的 T-IDs 为准。
3. 各 Phase 完成后将 gap 分析文档 §7 验收清单中对应 `[ ]` 改为 `[x]`。
4. 如 gap 分析文档的缺口状态有变（如表已存在等），以本文件 §1.3 的修正为准。
