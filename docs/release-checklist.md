# HSK 在线答题平台发布验收清单

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 日期 | 2026-09-23 |
| 关联 | `docs/plans/test-plan.md`, `docs/plans/test-findings.md` |
| 状态 | MVP 阶段验收 |

---

## 1. 测试覆盖范围

### 1.1 后端单元/集成测试 (Vitest)

| 测试文件 | 测试数 | 覆盖范围 |
|---|---:|---|
| `health.test.ts` | 1 | `/health` 端点 |
| `localesApi.test.ts` | 9 | `/api/locales` 返回格式、排序、RTL、默认语言 |
| `schema.test.ts` | 7 | 表存在、CHECK 约束、唯一索引 |
| `seed.test.ts` | 11 | 6 等级包、10 语言、用户、订阅、H61438 试卷、审计日志 |
| `errorHandler.test.ts` | 4 | 401 未认证、公开路由、health |
| `questionSchema.test.ts` | 34 | 七种题型 Zod schema、答案验证 |
| `authService.test.ts` | 11 | 登录、登出、会话、token 轮换 |
| `subscriptionService.test.ts` | 23 | 创建/暂停/恢复/撤销/续期、唯一约束、批量 |
| `subscriptionApi.test.ts` | 20 | API 级订阅权限、auth 路由、管理员操作 |
| `paperService.test.ts` | 10 | 答案隐藏、订阅校验、403/404/草稿拒绝 |
| `gradingService.test.ts` | 25 | 七种判分器、文本归一化、essay 延后 |
| `attemptService.test.ts` | 24 | 状态机、保存、提交、报告、错题、分部计时 |
| `security.test.ts` | N | 安全：无订阅访问、答案隐藏、跨用户/等级、管理员保护 |
| `attemptApi.test.ts` | N | 完整答题流程 API 集成、essay 批改流程 |

### 1.2 前端单元/组件测试 (Vitest + jsdom)

| 测试文件 | 测试数 | 覆盖范围 |
|---|---:|---|
| `i18n-keys.test.ts` | 4 | 十语言翻译 key 数量、覆盖和顶级模块对齐 |
| `locales.test.ts` | 16 | 十语言配置、RTL、helper 函数 |
| `notFoundPage.test.tsx` | 2 | 404 页面渲染、本地化消息 |
| `banksPage.test.tsx` | 5 | Skeleton 加载、订阅列表、空状态、错误状态 |
| `questionRenderers.test.tsx` | 10 | SingleChoice/TrueFalse 渲染和交互、分发 |
| `format.test.ts` | N | 日期/数字/百分比/时长/倒计时本地化格式 |
| `audioPlayer.test.tsx` | N | 播放按钮、播放次数限制、禁用状态、音频元素 |

### 1.3 E2E 测试说明

**当前状态：** 未实现 Playwright E2E 测试。

**原因：** 开发沙箱限制 TCP 端口监听（`EPERM`），Playwright 需要启动 dev server 并通过浏览器访问，无法在沙箱内运行。

**替代覆盖：** Vitest 集成测试通过进程内 Express 应用调度器（`callApp`）覆盖了 API 层的完整用户旅程，包括：
- 登录 → 查看订阅 → 选题 → 开始答题 → 自动保存 → 提交 → 报告
- 音频事件记录、分部计时更新
- 错题列表、essay 批改流程
- 安全测试：跨用户/跨等级访问、答案隐藏、管理员权限

**E2E 补充建议：** 在非沙箱环境中运行 Playwright E2E，覆盖：
- 浏览器渲染验证（RTL 布局、字体）
- 真实音频播放
- 答题卡导航
- 十语言 UI 截图对比

---

## 2. 关键路径验证结果

### 路径 A：订阅权限

| 验收项 | 状态 | 备注 |
|---|---|---|
| 无订阅用户看到空列表 | PASS | API + 服务层测试覆盖 |
| 已订阅用户看到对应等级 | PASS | |
| 跨等级访问返回 403 | PASS | |
| 暂停/到期/撤销不能开始答题 | PASS | |
| 未认证返回 401 | PASS | |
| 非管理员访问管理端返回 403 | PASS | |
| 素材访问需 attempt + 订阅 | PASS | |

### 路径 B：答案隐藏

| 验收项 | 状态 | 备注 |
|---|---|---|
| 试卷详情不含 answer_json | PASS | API + 服务层测试覆盖 |
| 进行中 attempt 不含正确答案 | PASS | |
| 提交前不能查看报告 | PASS | |
| 报告在提交后显示正确答案 | PASS | |
| 管理端可见 answer_json | N/A | 管理端尚未实现 |

### 路径 C：判分

| 验收项 | 状态 | 备注 |
|---|---|---|
| 七种题型自动判分 | PASS | GRD-01 到 GRD-17 |
| 文本归一化（空格/全角） | PASS | |
| essay 延后到 manual_pending | PASS | |
| 未答判为错误 | PASS | |
| 总分/分部得分计算 | PASS | |
| 错题自动生成 | PASS | |

### 路径 D：i18n / RTL

| 验收项 | 状态 | 备注 |
|---|---|---|
| 十语言配置 | PASS | `locales.test.ts` |
| zh-CN / en-US key 对齐 | PASS | `i18n-keys.test.ts` |
| RTL 方向标记 (ar, ur-PK) | PASS | 配置层验证 |
| 本地化格式（日期/数字/倒计时） | PASS | `format.test.ts` |
| 浏览器 RTL 布局验证 | PENDING | 需 Playwright E2E |
| 十语言翻译包补齐 | PASS | 十语言包已落地，key 对齐测试通过 |

---

## 3. 已知缺陷

| ID | 严重 | 描述 | 状态 |
|---|---|---|---|
| F-001 | P1 | 端口不匹配：server 3001 vs vite proxy 3000 | 已修复 |
| F-004 | P1 | `routes/imports.ts` 缺失，已用测试 stub 替代 | 已修复：真实实现落地 |
| F-005 | P1 | seed.sql 中 `paper_questions` 在 `paper_sections` 之前插入 | 已修复 |
| F-006 | P1 | `getAttemptReport` 中 `user_answer` 显示正确答案而非用户答案（列名冲突） | 已修复 |
| F-007 | P1 | Express 4 异步路由错误未进入错误处理器 | 已修复：`asyncHandler` 包装 |

---

## 4. 发布门禁

- [x] `npm run typecheck` 通过
- [x] `npm run build` 成功
- [x] `npm test` 全部通过
- [x] P0 缺陷：无
- [x] P1 缺陷全部修复（F-001, F-004, F-005, F-006, F-007）
- [x] 后端单元测试覆盖率达标（关键路径 100%）
- [x] 前端组件测试覆盖率达标
- [ ] E2E 全链路通过（需非沙箱环境）
- [x] 十语言翻译包 key 完整性检查通过
- [ ] 十语言浏览器 UI / RTL 手动验收通过
- [x] 安全测试无高危发现

---

## 5. 发布前手动检查项

1. [x] 修复 F-001：统一 `server.ts` 端口与 `vite.config.ts` proxy
2. [x] 修复 F-005：调整 seed.sql 中 `paper_sections` 和 `paper_questions` 的插入顺序
3. [x] 修复 F-006：`getAttemptReport` 使用 `qv.answer_json`（正确答案）而非 `r.answer_json`（用户答案）作为 `correct_answer`
4. [x] 替换 F-004：用真实 `imports.ts` 替换测试 stub
5. [ ] 在非沙箱环境中运行 Playwright E2E
6. [x] 十语言翻译包 key 完整性检查通过
7. [ ] 手动走查 H61438 样卷完整作答流程
8. [ ] 验证 `npm run dev` 前后端同时启动可用
9. [ ] 验证 `npm run build:start` 生产模式可启动
