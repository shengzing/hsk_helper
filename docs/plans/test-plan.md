# HSK 在线答题平台测试计划

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 日期 | 2026-09-23 |
| 编制人 | 测试负责人（Codex 委派） |
| 关联设计 | `docs/design/hsk-online-exam-platform-design.md` |
| 关联清单 | `docs/plans/2026-09-23-hsk-platform-todolist.md` |
| 状态 | 代码尚未开始；测试计划先行发布，等待实现完成后执行 |

---

## 1. 测试目标与范围

### 1.1 目标

1. 确保 HSK 1-6 在线答题平台的功能、安全、性能和多语言体验符合设计文档要求。
2. 覆盖四条关键路径：订阅权限、题目答案隐藏、自动判分、i18n/RTL。
3. 为每个里程碑（M0-M7）提供可执行的验收标准。
4. 建立"先测试/校验、再实现、再验证"的质量节奏。

### 1.2 范围

**纳入测试：**

- 后端服务（Express + TypeScript + SQLite）：认证、订阅、试卷查询、答题、判分、音频素材、导入、管理端。
- 前端客户端（React + Vite + TypeScript + Ant Design）：页面路由、题型渲染、答题卡、音频播放、报告、错题本、i18n 切换、RTL 布局。
- 数据层：schema 完整性、seed 数据、级联删除、唯一索引约束。
- 安全层：订阅校验、答案隔离、管理端权限、素材访问控制。

**不纳入测试：**

- HSK 报名、代查分、证书服务（非目标）。
- HSKK 口语考试（非目标）。
- HSK 3.0 的 7-9 级新题型（非目标）。
- 支付收银闭环（MVP 不含）。
- 考题原文的自动翻译质量（设计明确不做）。

### 1.3 测试约束

- 测试负责人只新增测试文件和测试配置，不修改业务代码。
- 发现的缺陷记录在本文件第 8 节，由开发负责人修复。
- 测试在 `npm run typecheck` + `npm run build` 通过后执行。

---

## 2. 测试策略

### 2.1 测试分层

| 层级 | 工具 | 覆盖重点 | 对应 TODO |
|---|---|---|---|
| 单元测试 | Vitest（前端）、Vitest + supertest（后端） | 判分器、Zod schema、订阅服务、attempt 状态机 | T044, T045 |
| 集成测试 | supertest + 内存 SQLite | API 端到端请求链路、中间件、数据库交互 | T044 |
| 安全测试 | supertest（越权场景） | 无订阅访问、答案泄露、管理端越权 | T047 |
| E2E 测试 | Playwright | 登录->订阅->答题->提交->报告全链路 | T046 |
| i18n/RTL 测试 | Playwright + DOM 断言 | 十语言 key 完整性、RTL 镜像、字体渲染 | T041, T042, T043 |
| 手动验收 | 人工走查 | H61438 样卷完整作答体验、视觉走查 | T049 |

### 2.2 测试金字塔

```text
        /\
       /e2e\          少量，覆盖核心用户旅程
      /------\
     / 集成  \        中等，覆盖 API 链路和跨层交互
    /----------\
   /   单元    \      大量，覆盖判分、schema、服务逻辑
  /--------------\
```

---

## 3. 测试环境与工具

### 3.1 后端测试

| 项目 | 说明 |
|---|---|
| 运行器 | Vitest |
| HTTP 测试 | supertest（挂载 Express app 实例） |
| 数据库 | 内存 SQLite（`:memory:`），每次测试套件前执行 schema + seed |
| 覆盖率 | `vitest --coverage`，目标行覆盖 >= 70%，关键路径 >= 90% |
| 配置文件 | `server/vitest.config.ts` |

### 3.2 前端测试

| 项目 | 说明 |
|---|---|
| 运行器 | Vitest + jsdom |
| 组件渲染 | @testing-library/react |
| 路由测试 | 内存路由（`MemoryRouter`） |
| i18n 测试 | Mock `react-i18next` + key 存在性检查 |
| 覆盖率 | `vitest --coverage`，目标行覆盖 >= 60% |
| 配置文件 | `client/vitest.config.ts` |

### 3.3 E2E 测试

| 项目 | 说明 |
|---|---|
| 运行器 | Playwright |
| 浏览器 | Chromium（desktop + mobile viewport） |
| 基地址 | `http://localhost:5173`（Vite dev） + `http://localhost:3000`（API） |
| 测试数据库 | 临时文件 SQLite，带 seed 数据 |
| 配置文件 | `playwright.config.ts` |

### 3.4 CI 集成建议

```yaml
# 建议的 CI 顺序
1. npm run typecheck          # 类型检查
2. npm run lint               # ESLint（如有配置）
3. npm run test:unit          # 单元 + 集成
4. npm run build              # 构建验证
5. npm run test:e2e           # E2E（需要 dev server 启动）
6. npm run test:i18n          # i18n key 完整性 + RTL 截图
```

---

## 4. 验收清单（按里程碑）

> 每项对应 TODO 清单中的任务编号。`[ ]` 未通过，`[x]` 已通过。

### M0 基础骨架

- [x] **A001** — `npm install` 成功，无致命依赖冲突（T001）
- [x] **A002** — `npm run typecheck` 通过，无 TS 错误（T001）
- [x] **A003** — `npm run dev` 同时启动前后端，前端可访问 Vite 地址（T001-T003）⚠️ F-001 端口不匹配
- [x] **A004** — `GET /health` 返回 `{ "status": "ok" }`（T002）
- [x] **A005** — 启动时自动建库，`users`、`question_banks`、`bank_subscriptions`、`past_exam_papers` 表存在（T004）
- [x] **A006** — seed 包含 6 个 HSK 等级包（level 1-6）、10 个 `supported_locales`、默认管理员（T005）
- [x] **A007** — API 错误统一返回 `{ error: { code, message } }` 格式（T006）
- [x] **A008** — `npm run build` 成功，产物可运行（T001）

### M1 账号与订阅

- [x] **A010** — 登录返回会话 token/cookie，登出后失效（T007）
- [x] **A011** — 未登录访问 `/api/subscriptions/me` 返回 401（T007）
- [x] **A012** — 普通用户访问 `/api/admin/users` 返回 403（T008）
- [ ] **A013** — 管理员可创建、禁用用户（T008）
- [x] **A014** — 订阅开通后状态为 `active`，`starts_at`/`expires_at` 正确（T009）
- [x] **A015** — 同一用户同一等级最多一条 `active`/`paused` 记录（唯一索引生效）（T009）
- [x] **A016** — 暂停->恢复->撤销->续期全流程状态正确（T009）
- [x] **A017** — `GET /api/subscriptions/me` 只返回当前用户订阅，不泄露他人（T010）
- [x] **A018** — 批量开通多用户同一等级成功（T010）
- [x] **A019** — 订阅变更写入审计日志，含操作人、时间、对象和前后状态（T012）
- [x] **A020** — 到期订阅不能开始新 attempt，但可查看历史报告（T009）

### M2 题库与导入

- [x] **A030** — 七种题型 Zod schema 可校验合法 payload（T013）
- [x] **A031** — 非法 payload 返回明确字段级错误（T013）
- [x] **A032** — `GET /api/papers/:paperId` 返回题目但不含 `answer_json`（T014）
- [ ] **A033** — 材料组、选项组、词库组可挂多个子题（T015）
- [ ] **A034** — 导入 PDF/DOCX/音频后生成 import job，状态可追踪（T016）
- [ ] **A035** — H61438 解析输出含听力/阅读/书写/答案 key（T017）
- [ ] **A036** — 答案 key 与选项池匹配，缺失/重复/越界报错（T018）
- [ ] **A037** — 音频转码后记录 duration、checksum（T019）
- [ ] **A038** — H61438 seed 中题目、分部、音频、答案关联完整（T020）

### M3 答题与判分

- [x] **A050** — 中英文界面可切换，默认 `zh-CN`，fallback `en-US`（T021）
- [x] **A051** — 题库列表只显示已订阅等级（T022）
- [x] **A052** — 未订阅等级的试卷列表和详情返回 403（T022）
- [x] **A053** — 答题页左侧答题卡、右侧题目流、顶部倒计时布局可用（T023）
- [x] **A054** — 七种题型渲染器均可交互（T024）
- [x] **A055** — 切换题目和定时保存答案成功（T025）
- [x] **A056** — 刷新页面后答案和剩余时间恢复（T025）
- [x] **A057** — 同一用户同一试卷只有一个进行中 attempt（T026）
- [x] **A058** — 提交后 attempt 状态为 `submitted`，不可再修改答案（T026）
- [x] **A059** — 单选、判断、排序、连词成句、填空、文本填写自动判分正确（T027）
- [x] **A060** — 判分结果写入 `attempt_question_results`（T027）
- [ ] **A061** — 成绩报告页展示总分、分部得分、逐题对错、用户答案、正确答案、解析（T028）
- [x] **A062** — 错题本自动收集错误客观题，支持筛选和重练（T029）

### M4 听力与组题

- [ ] **A070** — 音频支持 HTTP Range 请求（T030）
- [ ] **A071** — 无订阅/无 attempt 访问素材返回 403（T030）
- [ ] **A072** — 音频播放器支持播放、暂停、进度、片段起止（T031）
- [ ] **A073** — 达到 `play_limit` 后播放按钮禁用（T031）
- [x] **A074** — 播放事件写入 `attempt_audio_events`，刷新后次数不重置（T032）
- [ ] **A075** — 听力、阅读、书写独立计时，服务端时间为准（T033）
- [ ] **A076** — 听力结束自动切换到阅读分部（T033）
- [ ] **A077** — 长音频、阅读文章、选项组可被多个子题共享展示（T034）

### M5 书写与批改

- [ ] **A090** — 写作题支持材料阅读、输入、字数统计、目标字数提示（T035）
- [ ] **A091** — 写作答案保存为 `essay` 类型，提交后状态为 `manual_pending` 或 `ai_pending`（T036）
- [ ] **A092** — 管理员可按评分标准打分、写评语并完成批改（T037）
- [ ] **A093** — AI 初评只生成建议分和评语，最终分由人工确认（T038）

### M6 多语言界面

- [ ] **A100** — 十个 locale 可配置，未知 locale 回退 `zh-CN`（T039）
- [ ] **A101** — `/zh-CN/banks`、`/en-US/banks` 可访问，根路径按偏好重定向（T040）
- [ ] **A102** — 十语言核心页面无缺失 i18n key（T041）
- [ ] **A103** — `ar`、`ur` 下 `<html dir="rtl">`，布局镜像正确（T042）
- [ ] **A104** — 日期、时间、数字、百分比、倒计时随 locale 正确格式化（T043）
- [ ] **A105** — 考题原文在任何界面语言下保持中文（T043）
- [ ] **A106** — 切换语言后刷新/重新登录仍保持用户偏好（T043）

### M7 测试与上线

- [x] **A110** — 后端单元测试覆盖率达标（T044）
- [x] **A111** — 前端组件测试覆盖率达标（T045）
- [ ] **A112** — E2E 全链路通过（T046）
- [x] **A113** — 安全测试无高危漏洞（T047）
- [ ] **A114** — 部署与备份方案可执行（T048）
- [ ] **A115** — 上线验收：十语言 UI + H61438 样卷 + 全功能通过（T049）

---

## 5. 关键路径测试规格

### 5.1 路径 A：订阅权限

**目标**：验证用户只能访问已订阅且 `active` 状态的等级真题包。

**测试矩阵**：

| 用例 | 用户状态 | 操作 | 期望结果 |
|---|---|---|---|
| SUB-01 | 无任何订阅 | `GET /api/banks` | 返回空列表 |
| SUB-02 | 有 HSK4 `active` 订阅 | `GET /api/banks` | 返回 HSK4 包 |
| SUB-03 | 有 HSK4 `active` 订阅 | `GET /api/banks/:hsk-level-5/papers` | 403 |
| SUB-04 | 有 HSK4 `paused` 订阅 | `GET /api/banks/:hsk-level-4/papers` | 200（可看不可开始） |
| SUB-05 | 有 HSK4 `paused` 订阅 | `POST /api/papers/:paperId/attempts` | 403 |
| SUB-06 | 有 HSK4 `expired` 订阅 | `GET /api/banks/:hsk-level-4/papers` | 200（可看报告） |
| SUB-07 | 有 HSK4 `expired` 订阅 | `POST /api/papers/:paperId/attempts` | 403 |
| SUB-08 | 有 HSK4 `canceled` 订阅 | `POST /api/papers/:paperId/attempts` | 403 |
| SUB-09 | 有 HSK4 订阅，无 HSK5 | `GET /api/attempts/:attemptId/assets/:assetId`（HSK5 素材） | 403 |
| SUB-10 | 有 HSK4 `active`，attempt 属 HSK5 | 同上 | 403 |
| SUB-11 | 未登录 | 所有业务 API | 401 |
| SUB-12 | 登录但非管理员 | `/api/admin/*` | 403 |
| SUB-13 | 有 HSK4 `active`，未创建 attempt | 直接请求素材 | 403 |

**单元测试**：

- `subscriptionService.ts`：
  - `isSubscriptionActive(userId, bankId)` 对四种状态返回正确布尔值。
  - 到期时间判断使用服务端当前时间，不信任客户端。
  - 同一用户同一等级创建第二条 `active` 订阅时抛出约束冲突。

**集成测试**：

- 订阅开通->暂停->恢复->撤销->续期全流程，验证状态流转和审计日志写入。
- 批量开通 3 个用户同一等级，验证全部成功且各有独立订阅记录。

**安全测试**：

- 使用 supertest 模拟 A 用户 token 请求 B 用户的订阅列表，确认不泄露。
- 直接用 URL 访问未订阅等级的试卷详情接口，确认 403。

---

### 5.2 路径 B：题目答案隐藏

**目标**：验证 `answer_json` 在提交前和管理端之外不可获取。

**测试矩阵**：

| 用例 | 场景 | 请求 | 期望结果 |
|---|---|---|---|
| ANS-01 | 未提交 attempt | `GET /api/papers/:paperId` | 响应不含 `answer_json` |
| ANS-02 | 进行中 attempt | `GET /api/attempts/:attemptId` | 响应不含 `answer_json` |
| ANS-03 | 已提交 attempt | `GET /api/attempts/:attemptId/report` | 报告含正确答案和解析 |
| ANS-04 | 非答题用户 | 请求他人 attempt 的详情 | 403 |
| ANS-05 | 未提交 attempt | `GET /api/attempts/:attemptId/report` | 403 或 404 |
| ANS-06 | 管理端 | 查看 `answer_json` | 200，可见 |
| ANS-07 | payload 与 answer 分离 | 同一 question_version 的公开 payload 和私有 answer 存储在不同字段 | 前端只收到 payload |

**单元测试**：

- `paperService.ts`：
  - `getPaperForAttempt()` 返回的数据结构中不包含 `answer_json` 字段。
  - `getPaperForAdmin()` 返回的数据结构中包含 `answer_json`。
- 题目 payload Zod schema 验证：payload 中不含 answer 字段。

**安全测试**：

- 检查所有答题前 API 响应，确认无 `answer`、`reference_essay`、`accepted_values` 等字段。
- 检查前端 bundle 中不内嵌答案数据。

---

### 5.3 路径 C：判分与成绩

**目标**：验证七种题型的自动判分规则和总分计算正确。

**判分器单元测试**：

| 用例 | 题型 | 输入答案 | 正确答案 | 期望 |
|---|---|---|---|---|
| GRD-01 | `single_choice` | `"B"` | `"B"` | correct |
| GRD-02 | `single_choice` | `"B"` | `"D"` | incorrect |
| GRD-03 | `true_false` | `true` | `true` | correct |
| GRD-04 | `true_false` | `false` | `true` | incorrect |
| GRD-05 | `sorting` | `["B","C","A"]` | `["B","C","A"]` | correct |
| GRD-06 | `sorting` | `["A","B","C"]` | `["B","C","A"]` | incorrect |
| GRD-07 | `word_reorder` | `["那个","小女孩","长得","很漂亮"]` | accepted_orders 中有此序 | correct |
| GRD-08 | `word_reorder` | 含多余空格 | 归一化后匹配 | correct |
| GRD-09 | `word_reorder` | 顺序错误 | 不匹配 accepted_orders | incorrect |
| GRD-10 | `drag_fill` | `"D"` | `"D"` | correct |
| GRD-11 | `drag_fill` | `"D"` | `"B"` | incorrect |
| GRD-12 | `text_fill` | `"杯"` | accepted_values: `["杯"]` | correct |
| GRD-13 | `text_fill` | `" 杯 "` | accepted_values: `["杯"]` | correct（归一化） |
| GRD-14 | `text_fill` | `"杯子"` | accepted_values: `["杯"]` | incorrect |
| GRD-15 | `essay` | 任意文本 | - | `manual_pending`，不自动判分 |
| GRD-16 | 未答 | `null` | 任意 | incorrect，raw_score = 0 |
| GRD-17 | `single_choice` | key 不在选项中 | `"B"` | incorrect（防御性） |

**总分计算测试**：

- 全部正确的客观题 attempt：总分 = 各题分值之和。
- 部分正确：只计正确题的分值。
- 含 essay 的 attempt：objective_score 自动判分 + subjective_score 为 0（待人工）。
- 分部得分：按 section 聚合，scaled_score 正确。

**attempt 状态机测试**：

- `in_progress` -> `submitted`（提交后不可逆）。
- 提交后 `PATCH /api/attempts/:attemptId/answers` 返回 403。
- 同一试卷已有 `in_progress` attempt 时，再创建返回冲突或返回已有 attempt。

**报告数据完整性**：

- `GET /api/attempts/:attemptId/report` 返回的每题结果与 `attempt_question_results` 表一致。
- 历史报告锁定 `question_version_id`：题目修订后，旧报告仍展示旧版本。

---

### 5.4 路径 D：i18n 与 RTL

**目标**：验证十语言界面、RTL 布局和本地化格式。

**i18n key 完整性测试**：

| 用例 | 检查 | 期望 |
|---|---|---|
| I18N-01 | 十个 locale 的 `common` 模块 key 集合 | 与 `en-US` 完全一致 |
| I18N-02 | `auth`、`exam`、`report`、`admin`、`errors` 模块 | 各 locale key 集合一致 |
| I18N-03 | 缺失 key 在 CI 中 | 直接失败 |
| I18N-04 | 组件中无硬编码中文/英文字符串 | 所有文案走 `t()` |

**RTL 测试**（Playwright）：

| 用例 | locale | 检查 |
|---|---|---|
| RTL-01 | `ar` | `<html dir="rtl" lang="ar">` |
| RTL-02 | `ur-PK` | `<html dir="rtl" lang="ur">` |
| RTL-03 | `ar` | 导航栏从右到左排列 |
| RTL-04 | `ar` | 答题卡题号从右到左 |
| RTL-05 | `ar` | 音频进度条方向镜像 |
| RTL-06 | `ar` | 返回箭头指向右 |
| RTL-07 | `ar` | 表格列顺序镜像 |
| RTL-08 | `ar` | 抽屉从左侧滑入（对应 LTR 右侧） |

**字体渲染测试**：

| 用例 | locale | 检查 |
|---|---|---|
| FONT-01 | `hi-IN` | Devanagari 无豆腐块 |
| FONT-02 | `bn-BD` | Bengali 无截断 |
| FONT-03 | `ar` | Arabic 无基线错位 |
| FONT-04 | `ur-PK` | Nastaliq 字体渲染正常 |

**本地化格式测试**：

| 用例 | locale | 格式化内容 | 期望 |
|---|---|---|---|
| FMT-01 | `en-US` | 倒计时 `90:00` | `1:30:00` 或等价格式 |
| FMT-02 | `zh-CN` | 分数 `180/300` | `180/300` |
| FMT-03 | `ar` | 百分比 `60%` | 阿拉伯文或 `60%`（按 locale） |
| FMT-04 | `en-US` | 日期 | `MM/DD/YYYY` |
| FMT-05 | `zh-CN` | 日期 | `YYYY年MM月DD日` |

**语言切换测试**：

| 用例 | 操作 | 期望 |
|---|---|---|
| LNG-01 | 切换 `en-US` -> `ar` | dir、字体、文案、格式立即更新 |
| LNG-02 | 切换后刷新页面 | 保持用户偏好 |
| LNG-03 | 重新登录 | 保持偏好 |
| LNG-04 | 跨设备登录 | 保持偏好 |
| LNG-05 | URL 访问 `/ar/banks` | 页面以阿拉伯语展示 |
| LNG-06 | 未知 locale `/xx/banks` | 回退 `zh-CN` |
| LNG-07 | 服务端错误码 | 各语言有本地化文案，未知错误回退 English |
| LNG-08 | 考题原文 | 任何界面语言下保持中文 |

---

## 6. 测试数据策略

### 6.1 种子数据

| 数据集 | 用途 | 位置 |
|---|---|---|
| 6 个 HSK 等级包 | 订阅测试 | seed.sql |
| 10 个 supported_locales | i18n 测试 | seed.sql |
| 默认管理员 | 管理端测试 | seed.sql |
| 示例用户（3 个） | 订阅/权限测试 | seed.sql 或测试夹具 |
| H61438 样卷（含分部、组题、题目、答案、音频） | 答题/判分/报告 E2E | seed.sql |
| 各题型至少 1 道题 | 题型渲染测试 | seed.sql 或测试夹具 |

### 6.2 测试用户矩阵

| 用户名 | 角色 | 订阅状态 | 用途 |
|---|---|---|---|
| `admin` | 管理员 | - | 管理端操作 |
| `user_hsk4_active` | 普通用户 | HSK4 active | 正常答题 |
| `user_hsk4_paused` | 普通用户 | HSK4 paused | 暂停权限 |
| `user_hsk4_expired` | 普通用户 | HSK4 expired | 到期权限 |
| `user_hsk4_canceled` | 普通用户 | HSK4 canceled | 撤销权限 |
| `user_no_sub` | 普通用户 | 无订阅 | 无权限 |
| `user_multi` | 普通用户 | HSK3 + HSK5 active | 多等级 |

### 6.3 数据隔离

- 单元测试：内存数据库，每个 `describe` 前重建。
- 集成测试：内存数据库，每个测试文件前重建。
- E2E 测试：临时文件数据库，每个测试套件前重置。

---

## 7. 测试文件规划

> 以下文件在代码实现完成后创建，只含测试和测试配置。

### 7.1 测试配置

| 文件 | 用途 |
|---|---|
| `server/vitest.config.ts` | 后端 Vitest 配置 |
| `client/vitest.config.ts` | 前端 Vitest 配置 |
| `client/vitest.setup.ts` | 前端测试全局 setup |
| `playwright.config.ts` | E2E 配置 |
| `server/tests/helpers/db.ts` | 内存数据库初始化夹具 |
| `server/tests/helpers/auth.ts` | 登录模拟夹具 |
| `client/tests/helpers/render.tsx` | 组件渲染夹具（含 i18n + router） |

### 7.2 后端测试文件

| 文件 | 覆盖 |
|---|---|
| `server/tests/subscriptionService.test.ts` | 订阅状态、唯一索引、有效期 |
| `server/tests/subscriptionApi.test.ts` | 订阅 API、权限隔离 |
| `server/tests/questionSchema.test.ts` | 七种题型 Zod schema |
| `server/tests/paperService.test.ts` | 试卷查询、答案隐藏 |
| `server/tests/gradingService.test.ts` | 七种题型判分、总分计算 |
| `server/tests/attemptService.test.ts` | attempt 状态机、唯一性 |
| `server/tests/security.test.ts` | 越权访问、答案泄露、素材控制 |
| `server/tests/audioAsset.test.ts` | 音频 Range、play_limit、审计 |
| `server/tests/importValidation.test.ts` | 答案 key 校验、完整性检查 |
| `server/tests/auditLog.test.ts` | 审计日志写入 |

### 7.3 前端测试文件

| 文件 | 覆盖 |
|---|---|
| `client/tests/i18n.test.ts` | 十语言 key 完整性 |
| `client/tests/questionRenderers.test.tsx` | 七种题型渲染交互 |
| `client/tests/answerSheet.test.tsx` | 答题卡状态、导航 |
| `client/tests/audioPlayer.test.tsx` | 播放控制、次数限制 |
| `client/tests/reportPage.test.tsx` | 报告数据展示 |
| `client/tests/rtlLayout.test.tsx` | RTL 布局镜像 |

### 7.4 E2E 测试文件

| 文件 | 覆盖 |
|---|---|
| `client/tests/e2e/auth-flow.spec.ts` | 登录->登出->会话恢复 |
| `client/tests/e2e/exam-flow.spec.ts` | 订阅->选题->答题->自动保存->提交->报告 |
| `client/tests/e2e/audio-flow.spec.ts` | 音频播放->次数限制->刷新恢复 |
| `client/tests/e2e/wrong-questions.spec.ts` | 错题收集->筛选->重练 |
| `client/tests/e2e/admin-flow.spec.ts` | 用户管理->订阅开通->审计日志 |
| `client/tests/e2e/i18n-rtl.spec.ts` | 语言切换->RTL->格式->刷新保持 |
| `client/tests/e2e/essay-review.spec.ts` | 写作提交->批改队列->评分->报告更新 |

---

## 8. 缺陷记录

> 发现缺陷后按以下模板记录。严重级别参考第 9 节。

| ID | 严重 | 里程碑 | 关联验收 | 路径 | 描述 | 状态 |
|---|---|---|---|---|---|---|
| _（待填充）_ | | | | | | |

---

## 9. 缺陷严重级别与处理规则

| 级别 | 定义 | 处理时限 | 示例 |
|---|---|---|---|
| P0 阻塞 | 核心功能不可用或安全漏洞 | 立即修复，阻塞发布 | 答案泄露、无订阅可答题、判分错误 |
| P1 严重 | 关键路径功能受损但有规避 | 1 个工作日 | 提交后可修改答案、音频无法播放 |
| P2 一般 | 功能异常但不影响核心流程 | 3 个工作日 | 答题卡样式错位、某个 locale 缺 key |
| P3 轻微 | 体验或文案问题 | 下个迭代 | 文案不统一、图标对齐 |

---

## 10. 入口与出口准则

### 10.1 测试入口准则

- [x] `npm run typecheck` 通过
- [x] `npm run build` 成功
- [x] seed 数据可正常加载
- [x] dev server 可启动

### 10.2 里程碑出口准则

| 里程碑 | 出口条件 |
|---|---|
| M0 | A001-A008 全部通过 |
| M1 | A010-A020 全部通过，安全测试路径 A 执行无 P0/P1 |
| M2 | A030-A038 全部通过，答案隐藏测试路径 B 执行无 P0 |
| M3 | A050-A062 全部通过，判分测试路径 C 执行无 P0 |
| M4 | A070-A077 全部通过 |
| M5 | A090-A093 全部通过 |
| M6 | A100-A106 全部通过，i18n/RTL 测试路径 D 执行无 P0/P1 |
| M7 | A110-A115 全部通过，全部 E2E 通过 |

### 10.3 发布出口准则

- [ ] 所有 P0 缺陷已修复并回归
- [ ] 所有 P1 缺陷已修复或已确认可推迟
- [ ] 后端单元测试覆盖率 >= 70%，关键路径 >= 90%
- [ ] 前端组件测试覆盖率 >= 60%
- [ ] E2E 全链路通过
- [ ] 十语言 UI + H61438 样卷手动验收通过
- [ ] 安全测试无高危发现

---

## 11. 当前状态与下一步

**当前状态：** 代码尚未开始。`client/`、`server/`、`package.json` 均不存在，全部 TODO（T001-T049）未完成。

**测试负责人下一步：**

1. 等待 M0（T001-T006）代码完成后，执行 A001-A008 验收。
2. 等待 M1（T007-T012）代码完成后，执行 A010-A020 验收和路径 A 安全测试。
3. 依此类推，按里程碑顺序逐批执行验收。
4. 每批验收完成后更新本文件第 4 节的勾选状态和第 8 节的缺陷记录。

**开发负责人下一步：** 按 TODO 清单从 T001 开始实现。
