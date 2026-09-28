# HSK 在线答题平台团队任务分配

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 日期 | 2026-09-23 |
| 依据 | `docs/design/hsk-online-exam-platform-design.md` v1.2 |
| 任务源 | `docs/plans/2026-09-23-hsk-platform-todolist.md`（唯一任务源，本文件不复制任务定义） |

---

## 1. 架构复核结论

### 1.1 总体评价

设计文档 v1.2 在以下方面确认无需修改，各团队照此执行：

- 数据层用 better-sqlite3 + WAL，不开 ORM
- Zod 做运行时校验，不做编译时校验替代
- 答案与判分全部在服务端，前端不做判分逻辑
- 客观题立即判分，essay 走 `manual_pending` / `ai_pending` 队列
- locale 前缀路由 + i18next 懒加载 + ICU MessageFormat
- 复用 `kid_progreming` 的 monorepo workspace + Express + Vite + TypeScript 结构，初始化风险低

### 1.2 发现的缺口（需在设计或任务中补全）

| # | 缺口 | 位置 | 影响 | 建议处理 |
|---|---|---|---|---|
| G1 | **`wrong_questions` 表缺 DDL**：设计 §5.1 ER 图引用了 `attempt_question_result 0..1 wrong_question`，§8.2 判分流程提到"进入 wrong_questions"，但 §5.2/§5.4 的 DDL 中没有建表语句 | T027 判分写入、T029 错题本查询 | 后端在 T004 schema 中补充 `wrong_questions` 表 DDL（字段：`id, attempt_question_result_id, user_id, bank_id, question_version_id, added_at, reviewed_at`） |
| G2 | **T029 缺后端文件**：TODO 中 T029 只分配了 `client/src/pages/WrongPage.tsx`，但设计 §7.1 有 `GET /api/wrong-questions` | 后端无人实现错题 API | 在 T029 中补充后端文件 `server/src/routes/wrongQuestions.ts` + `server/src/repositories/wrongQuestionRepository.ts`，归属后端 |
| G3 | **`attempt_section_states` 表无任务提及**：设计 §5.4 有该表 DDL，是 T033 分部计时的基础，但 TODO 中 T004 未显式点名此表 | T033 实现时才发现表未建 | 在 T004 验收标准中补充 `attempt_section_states` 表可见；在 T026 验收中补充 section 状态写入逻辑 |
| G4 | **`question_bank_i18n` / 内容翻译表未设计**：设计 §3.4.3 提到解析与知识点可增加人工翻译版本，应使用独立 `*_i18n` 表，但 schema 中无定义 | M6 多语言阶段缺少内容翻译数据结构 | 不阻塞 MVP；在 M6 开始前（T039 之前）补设计 `question_bank_i18n` / `explanation_i18n` 表 |
| G5 | **H61438 seed 手写风险**：T020 要求 H61438 完整入库（101 题 + 音频 + 答案），手动编写 SQL 极易出错 | 样卷数据质量 | T020 必须依赖 T017 解析脚本生成的结构化 JSON 转换为 seed，不接受手写 |

---

## 2. 团队分工与文件范围

### 2.1 后端（Backend）

**文件范围：**

| 目录 | 说明 |
|---|---|
| `server/src/db/` | schema.sql, seed.sql, connection.ts |
| `server/src/routes/` | 全部路由文件 |
| `server/src/services/` | 全部服务文件 |
| `server/src/repositories/` | 全部仓储文件 |
| `server/src/middlewares/` | auth, errorHandler |
| `server/src/utils/` | httpError, password, session |
| `server/src/schemas/` | question.ts（Zod schema） |
| `server/src/types.ts`, `server/src/app.ts`, `server/src/server.ts` | 入口 |
| `server/scripts/` | parse-past-papers.ts, validate-past-papers.ts, convert-media.ts |
| `server/package.json`, `server/tsconfig.json` | 后端工程配置 |
| 根 `package.json`, `ecosystem.config.cjs` | monorepo 根配置 |

**负责任务（25 项）：**

| 优先级 | 任务 | 说明 |
|---|---|---|
| P0 | T001(lead) | monorepo 初始化 |
| P0 | T002 | Express 服务骨架 |
| P0 | T004 | SQLite schema（含 G1 补充 wrong_questions、G3 补充 attempt_section_states） |
| P0 | T005 | 初始 seed（6 等级包 + 10 locales + 管理员） |
| P0 | T006 | 错误与响应规范 |
| P1 | T007 | 用户认证 |
| P1 | T009 | 等级包订阅服务 |
| P1 | T010 | 订阅 API |
| P1 | T013 | 题目 Zod schema（7 题型 + 3 组类型） |
| P1 | T014 | 试卷查询服务（不返回 answer_json） |
| P1 | T026 | attempt 创建与提交（含 section 状态写入 G3） |
| P1 | T027 | 客观题判分服务 |
| P2 | T008 | 管理员权限 |
| P2 | T012 | 审计日志 |
| P2 | T015 | 题目组模型 |
| P2 | T016 | 导入任务模型 |
| P2 | T017 | H61438 真题解析（高风险，见 R1） |
| P2 | T018 | 答案 key 校验 |
| P2 | T019 | 音频素材转换 |
| P2 | T020(lead) | H61438 样例 seed（依赖 T017 输出，见 G5） |
| P2 | T030 | 音频资产服务（HTTP Range + 权限校验） |
| P2 | T032 | 音频播放审计 |
| P2 | T033 | 分部计时（高风险，见 R3） |
| P2 | T036 | 写作题提交 |
| P3 | T038 | AI 初评（可选） |

**补充任务（因 G2 需新增后端文件）：**

| 任务 | 文件 | 依赖 |
|---|---|---|
| T029-后端 | `server/src/routes/wrongQuestions.ts`, `server/src/repositories/wrongQuestionRepository.ts` | T027 |

### 2.2 前端（Frontend）

**文件范围：**

| 目录 | 说明 |
|---|---|
| `client/src/pages/` | 全部页面组件 |
| `client/src/components/` | exam/ 下的 AudioPlayer, AnswerSheet, MaterialPanel, QuestionRenderer；questions/ 下 7 个题型渲染器 |
| `client/src/stores/` | attemptStore 等 |
| `client/src/api/` | API 客户端 |
| `client/src/i18n/` | I18nProvider, locales/, locales.ts |
| `client/src/styles/` | global.css |
| `client/src/types.ts`, `client/src/App.tsx`, `client/src/main.tsx` | 入口 |
| `client/src/utils/` | format.ts 等 |
| `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/index.html` | 客户端工程配置 |

**负责任务（17 项）：**

| 优先级 | 任务 | 说明 |
|---|---|---|
| P0 | T003 | React 客户端骨架 |
| P0 | T021 | i18n 基础（中英文可切换） |
| P1 | T022 | 题库与试卷列表页 |
| P1 | T023 | 答题页布局 |
| P1 | T024 | 题型渲染器（7 种） |
| P1 | T025 | 答题状态与自动保存 |
| P1 | T028 | 成绩报告页 |
| P2 | T011 | 管理端订阅页面 |
| P2 | T029 | 错题本（前端页面部分） |
| P2 | T031 | 音频播放器 |
| P2 | T034 | 共享材料面板 |
| P2 | T035 | 写作题渲染 |
| P2 | T037 | 人工批改队列页面 |
| P3 | T040 | locale 路由 |
| P3 | T041 | 十语言翻译包 |
| P3 | T042 | RTL 布局 |
| P3 | T043 | 字体与本地化格式 |

### 2.3 测试（Testing）

**文件范围：**

| 目录 | 说明 |
|---|---|
| `server/tests/` | 后端单元测试 + 安全测试 |
| `client/tests/` | 前端组件测试 |
| `client/tests/e2e/` | 端到端测试 |
| `scripts/backup.sh` | 备份脚本 |
| `docs/release-checklist.md` | 上线验收清单 |

**负责任务（6 项）：**

| 优先级 | 任务 | 说明 |
|---|---|---|
| P1 | T044 | 后端单元测试（订阅权限、schema、判分、attempt 状态） |
| P1 | T045 | 前端组件测试（渲染器、答题状态、语言切换、RTL） |
| P2 | T046 | 端到端测试（登录 -> 答题 -> 提交 -> 报告 -> 错题 -> 音频全链路） |
| P2 | T047 | 安全测试（无订阅不可访问、答案提交前不可获取） |
| P3 | T048 | 部署与备份方案 |
| P3 | T049 | 上线验收 |

### 2.4 跨团队协作任务

| 任务 | Lead | Assist | 协作说明 |
|---|---|---|---|
| T001 | 后端 | 前端 | 后端初始化 monorepo workspace，前端确认 client 目录和依赖 |
| T020 | 后端 | 前端 | 后端生成 H61438 seed，前端确认管理端可见草稿 |
| T039 | 后端 | 前端 | 后端 seed `supported_locales` 数据，前端调用 `GET /api/locales` |

---

## 3. 实施顺序与关键路径

### 3.1 关键路径

以下任务链是全局最长路径，任何一环延迟都会影响最终交付：

```
T001 -> T004 -> T013 -> T017 -> T020 -> T026 -> T027 -> T046
```

| 节点 | 角色 | 为何关键 |
|---|---|---|
| T004 schema | 后端 | 数据库表结构是整个后端的地基 |
| T013 Zod schema | 后端 | 题目数据契约，前后端共用，T014/T016/T017/T024/T027 全部依赖 |
| T017 H61438 解析 | 后端 | 产生真实测试数据，没有样卷数据前端和测试无法真正推进 |
| T026 attempt service | 后端 | 后端最复杂的服务，T025/T028/T027/T030/T033 全部依赖 |
| T027 判分 | 后端 | 客观题闭环的最后一步，T028/T029/T046 依赖 |
| T046 E2E | 测试 | 全链路验收 |

### 3.2 并行窗口

以下时间段内三团队可完全并行工作：

**窗口 1：T006 完成后 -> T020 完成前**

| 后端 | 前端 | 测试 |
|---|---|---|
| T007 -> T009 -> T010 -> T012 | T003 -> T021 | 编写 T044/T045 测试骨架（mock 数据） |

**窗口 2：T020 完成后 -> T027 完成前**

| 后端 | 前端 | 测试 |
|---|---|---|
| T026 -> T027 -> T030 -> T032 -> T033 | T022 -> T023 -> T024 -> T025 -> T028 | T044（后端单元测试）与开发同步推进 |

**窗口 3：T027 完成后（M5/M6 阶段）**

| 后端 | 前端 | 测试 |
|---|---|---|
| T036 -> T038 -> T039 | T035 -> T037 -> T040 -> T041 -> T042 -> T043 | T045 -> T046 -> T047 -> T048 -> T049 |

### 3.3 建议执行批次

| 批次 | 里程碑 | 后端 | 前端 | 测试 |
|---|---|---|---|---|
| B1 | M0 | T001-T006 | T003, T021 | 测试骨架准备 |
| B2 | M1 | T007-T012 | T011 | -- |
| B3 | M2 | T013-T020 | T022（依赖 T010 + T014） | T044（部分） |
| B4 | M3 | T026-T027 | T023-T029 | T044, T045 |
| B5 | M4 | T030-T034 | T031, T034 | T045（部分） |
| B6 | M5 | T036, T038 | T035, T037 | -- |
| B7 | M6 | T039 | T040-T043 | RTL 截图验证 |
| B8 | M7 | T048 | -- | T046-T049 |

---

## 4. 实施风险与依赖断点

### 4.1 高风险

| # | 风险 | 影响任务 | 缓解措施 |
|---|---|---|---|
| R1 | **PDF 解析精度**：H61438 是双栏排版 + 图文混排 + 听力原文与题干混合的复杂 PDF，自动化解析极易出错 | T017, T018, T020, T046 | 解析脚本只处理文本层清晰的 PDF；扫描版直接走人工录入队列；解析输出必须经 T018 校验通过后才能入 seed（见 G5） |
| R2 | **WMA 音频片段切分**：需要精确的 start_ms/end_ms 对齐到每题，手动标注耗时 | T019, T030, T031, T032, T033 | MVP 先用整卷音频（`paper_assets`），片段音频（`material_assets`）推迟到 M4 后期；片段时间戳由导入脚本从 PDF cue marker 提取 |
| R3 | **分部计时状态机**：服务端计时 + 前端同步 + 听力结束自动切换 + 超时自动提交，边界条件多 | T026, T033, T046 | 在 T004 中一并建 `attempt_section_states` 表（见 G3）；在 T026 中实现 section 状态转换逻辑；T044 单元测试覆盖边界（超时、跨分部、刷新恢复） |
| R4 | **Zod schema 复杂度**：7 种题型 x 3 种组类型，schema 定义量大且前后端共用 | T013, T014-T020, T024, T027 | 先从 `single_choice` + `true_false` 两种题型起步；其余题型增量添加；schema 文件与设计文档 §6 的 JSON 示例一一对应 |

### 4.2 中风险

| # | 风险 | 影响任务 | 缓解措施 |
|---|---|---|---|
| R5 | **RTL 布局**：ar/ur 的 Nastaliq 字体渲染在浏览器中不可预测，答题卡镜像方向需逐组件验证 | T042, T043 | 先做 `ar` 一个 RTL 语言验证通过；`ur` 复用 ar 的 RTL 逻辑只换字体；用 Playwright 截图自动化验证 |
| R6 | **中文文本归一化**：全角/半角空格、标点差异、异体字可能导致误判 | T027 | 归一化规则写入题目配置（`scoring_policy`），不做全局规则；T027 单元测试覆盖全角/半角场景 |
| R7 | **play_limit 跨刷新**：用户刷新页面后播放次数不能重置 | T031, T032 | `attempt_audio_events` 表在 T004 建表时一并创建；播放次数查询在每次 play 请求前查 DB |
| R8 | **订阅校验穿透**：素材接口可能被绕过直接拉取音频 | T030, T047 | 素材接口校验 attempt 归属 -> paper -> bank -> subscription -> user 四层关系；T047 专项安全测试 |

### 4.3 依赖断点

以下任务完成前，下游团队无法启动：

| 断点 | 完成方 | 阻塞谁 | 等什么 |
|---|---|---|---|
| T004 schema 完成 | 后端 | 后端全部、前端 T022+ | 数据库表结构稳定 |
| T013 Zod schema 完成 | 后端 | 后端 T014/T016/T017/T027、前端 T024 | 题目数据契约 |
| T017 H61438 解析完成 | 后端 | T018 校验、T020 seed、T046 E2E | 真实测试数据 |
| T026 attempt service 完成 | 后端 | 前端 T025/T028、后端 T027/T030/T033 | 答题核心服务 |
| T021 i18n 基础完成 | 前端 | 前端全部页面 | 本地化基础设施 |

---

## 5. TODO 清单管理约定

1. `docs/plans/2026-09-23-hsk-platform-todolist.md` 是唯一任务源。本文件只做分配、排序与风险标注，不复制任务定义。
2. 各团队完成任务后将 TODO 清单中 `[ ]` 改为 `[x]`。
3. 如需新增任务（如 G2 的后端错题 API），在 TODO 清单中添加对应条目，在本文件中补充归属。
4. 跨团队依赖通过 TODO 清单的 `依赖` 字段追踪，本文件的 §3 批次表和 §4 断点表做总体协调。
5. 设计文档如有修订，本文件同步更新对应缺口状态（G1-G5）。
