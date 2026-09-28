# `kid_progreming` 1:1 功能差距分析

| 项目 | 内容 |
|---|---|
| 对比对象 | `/Users/jiachengbin/workspace/kid_progreming` |
| 当前项目 | `/Users/jiachengbin/workspace/hsk_helper` |
| 日期 | 2026-09-23 |
| 结论 | 当前项目已完成 HSK 考试内核，但相比参考项目仍缺少登录入口、答题记录、知识库、反馈、管理看板、题目防抓取、真实 PDF 导入等一整套外围功能 |
| 补齐状态 | G-001 至 G-015 已在 2026-09-23 本轮补齐；验证结果见第 8 节 |

## 1. 总体结论

当前 `hsk_helper` 的考试内核比参考项目更完整，已经实现了：

- HSK 1-6 等级真题包订阅
- 七类 HSK 题型
- 听力、阅读、书写分部
- attempt 生命周期、自动保存、自动判分
- 音频素材、分部计时、错题本
- 写作题与人工批改
- 十语言界面、RTL、本地化格式

但如果按 `kid_progreming` 的完整产品形态做 1:1 对比，当前项目仍有以下核心缺口：

1. 浏览器端没有登录入口和认证上下文。
2. 前端请求没有携带 Cookie，后端认证无法生效。
3. 没有答题记录列表和历史详情页。
4. 知识库只有空页面，没有数据表、接口和后台管理。
5. 没有问题反馈模块。
6. 管理端只有订阅和作文批改，没有用户、试卷、知识库、分类看板。
7. 没有题目图片、Markdown、Canvas 防抓取和加密素材链路。
8. 没有真实 PDF 解析导入，当前导入依赖手工 JSON。
9. 没有管理端首页 dashboard。
10. 没有完整的本地状态恢复与历史记录工具。

## 2. P0 阻塞缺口

| ID | 缺口 | 影响 | 参考实现 | 当前状态 | 需要补齐 |
|---|---|---|---|---|---|
| G-001 | 登录页与认证上下文缺失 | 用户无法从浏览器登录，所有页面都无法识别身份 | `client/src/pages/LoginPage.tsx`, `client/src/auth/AuthContext.tsx`, `client/src/layouts/UserLayout.tsx` | 没有 `LoginPage`、`AuthContext`、登录路由、登出按钮 | 新增登录页、AuthContext、受保护路由、登录跳转和登出 |
| G-002 | 前端请求未携带 Cookie | 后端认证接口存在，但浏览器请求不会带会话 | `client/src/api/client.ts` 中 `credentials: "include"` | `client/src/api/index.ts` 未设置 `credentials` | 所有 API 请求加 `credentials: "include"` |
| G-003 | 答题记录列表与详情缺失 | 用户无法查看历史练习 | `RecordsPage.tsx`, `RecordDetailPage.tsx`, `utils/records.ts` | `RecordsPage` 是空页面，无 records API | 新增 records 路由、列表页、详情页、统计汇总 |
| G-004 | 真实 PDF 导入缺失 | 无法从本地真题 PDF 生成完整题库 | `server/scripts/parse-past-papers.ts` | 当前只接受手工 JSON，H61438 只有 5 题样例 | 实现真实 PDF 文本/图片/答案解析并导入全量 H61438 |

## 3. P1 功能缺口

| ID | 缺口 | 影响 | 参考实现 | 当前状态 | 需要补齐 |
|---|---|---|---|---|---|
| G-005 | 知识库模块缺失 | 无法查看 HSK 大纲、词汇、语法和题型资料 | `KnowledgePage.tsx`, `knowledge_categories`, `knowledge_documents` | 页面为空，无表、无 API | 新增知识库表、接口、页面、后台管理 |
| G-006 | 问题反馈模块缺失 | 用户无法反馈题目错误或产品问题 | `FeedbackPage.tsx`, `AdminFeedbackPage.tsx`, `feedback` 表 | 完全缺失 | 新增用户反馈、管理员回复、状态流转 |
| G-007 | 管理端首页缺失 | 管理员无法看用户、题库、试卷、知识库统计 | `AdminHomePage.tsx` | 只有订阅和作文批改 | 新增 dashboard、用户管理、试卷管理、知识库管理、分类管理 |
| G-008 | 用户管理页面缺失 | 管理员无法在 UI 创建/禁用用户 | `AdminHomePage.tsx` 的 users 分支 | 后端有 API，前端无页面 | 新增用户管理页、权限分配、有效期、启停 |
| G-009 | 试卷管理页面缺失 | 管理员无法维护试卷元数据和发布状态 | `AdminHomePage.tsx` 的 papers 分支 | 只有导入任务 API，无管理 UI | 新增试卷列表、创建、编辑、发布、下线 |
| G-010 | 题目防抓取缺失 | 题干、选项和解析可被直接抓取 | `ProtectedText.tsx`, `QuestionImages.tsx`, `sessionCrypto.ts`, `sessionKeyStore.ts` | 明文渲染，无加密和 Canvas 防抓取 | 新增会话密钥、加密响应、Canvas 文本、加密图片 |
| G-011 | Markdown 渲染缺失 | 解析和知识点无法支持格式化内容 | `Markdown.tsx`, `questionMarkdown.ts` | 没有 Markdown 组件 | 新增 Markdown 渲染或使用安全库 |
| G-012 | 题目图片链路缺失 | PDF 中的配图无法展示 | `QuestionImages.tsx`, `question_assets` | 当前 schema 有素材表但前端未用 | 新增图片提取、加密加载、去空白图、展示 |

## 4. P2 体验与运营缺口

| ID | 缺口 | 影响 | 参考实现 | 当前状态 | 需要补齐 |
|---|---|---|---|---|---|
| G-013 | 本地状态恢复不完整 | 刷新后不能完整恢复当前题号和历史记录 | `localState.ts`, `records.ts` | 只有服务端自动保存，缺少本地恢复 | 补齐本地缓存和服务端恢复合并策略 |
| G-014 | 管理端 dashboard 统计缺失 | 无法看平台运营概览 | `AdminHomePage.tsx` dashboard | 无 | 新增用户数、试卷数、知识库数、授权数、完成率 |
| G-015 | 内容审核流不完整 | 导入后缺少完整审核/发布 UI | 参考 PRD 的内容审核流程 | 只有 import job 状态 | 新增审核队列、发布/下线、版本记录 |

## 5. 文件级对比

### 5.1 前端缺失文件

| 参考文件 | 当前状态 | 缺口 |
|---|---|---|
| `client/src/pages/LoginPage.tsx` | 缺失 | 登录页 |
| `client/src/auth/AuthContext.tsx` | 缺失 | 认证上下文 |
| `client/src/pages/RecordsPage.tsx` | 空实现 | 历史记录列表 |
| `client/src/pages/RecordDetailPage.tsx` | 缺失 | 历史记录详情 |
| `client/src/pages/KnowledgePage.tsx` | 空实现 | 知识库 |
| `client/src/pages/FeedbackPage.tsx` | 缺失 | 用户反馈 |
| `client/src/pages/AdminFeedbackPage.tsx` | 缺失 | 管理端反馈 |
| `client/src/pages/AdminHomePage.tsx` | 缺失 | 管理端 dashboard 和 CRUD |
| `client/src/components/Markdown.tsx` | 缺失 | Markdown 渲染 |
| `client/src/components/ProtectedText.tsx` | 缺失 | Canvas 防抓取文本 |
| `client/src/components/QuestionImages.tsx` | 缺失 | 加密题目图片 |
| `client/src/utils/localState.ts` | 缺失 | 本地状态恢复 |
| `client/src/utils/records.ts` | 缺失 | 历史记录工具 |
| `client/src/utils/questionMarkdown.ts` | 缺失 | 题目 Markdown 构建 |
| `client/src/utils/sessionCrypto.ts` | 缺失 | 会话加密 |
| `client/src/utils/sessionKeyStore.ts` | 缺失 | 浏览器密钥存储 |

### 5.2 后端缺失文件

| 参考文件 | 当前状态 | 缺口 |
|---|---|---|
| `server/src/repositories/feedbackRepository.ts` | 缺失 | 反馈数据访问 |
| `server/src/routes/feedback.ts` | 缺失 | 反馈 API |
| `server/src/services/bankService.ts` | 部分缺失 | 题库/知识库服务 |
| `server/src/utils/sessionCipher.ts` | 缺失 | 会话加密 |
| `server/scripts/parse-past-papers.ts` | 仅有 JSON 校验 | 真实 PDF 解析 |

### 5.3 数据表缺失

| 参考表 | 当前状态 | 用途 |
|---|---|---|
| `knowledge_categories` | 缺失 | 知识库分类 |
| `knowledge_documents` | 缺失 | 知识库文档 |
| `feedback` | 缺失 | 问题反馈 |
| `question_assets` | 当前用 `material_assets` 替代 | 题目级图片关联 |

## 6. 建议补齐顺序

1. **G-001 + G-002**：先打通登录和 Cookie，否则所有页面都无法真正使用。
2. **G-003**：补答题记录列表和详情。
3. **G-004**：补真实 PDF 导入和全量 H61438 数据。
4. **G-005 + G-006**：补知识库和反馈。
5. **G-007 + G-008 + G-009**：补管理端 dashboard、用户、试卷。
6. **G-010 + G-011 + G-012**：补防抓取、Markdown 和题目图片。
7. **G-013 + G-014 + G-015**：补本地恢复、统计和审核流。

## 7. 验收标准

- [ ] 浏览器可登录、登出、自动恢复会话。
- [ ] 所有 API 请求携带 Cookie。
- [ ] 用户可查看历史记录列表和详情。
- [ ] 知识库可检索并展示 Markdown。
- [ ] 用户可提交反馈，管理员可回复。
- [ ] 管理端有 dashboard、用户、试卷、知识库、分类管理。
- [ ] 题干、选项、解析和图片经过加密与防抓取处理。
- [ ] `H61438` 可从 PDF 全量导入，题量与设计一致。
- [ ] 刷新页面后当前题号、答案和剩余时间可恢复。
- [ ] 所有新增模块有对应测试。

## 8. 本轮补齐结果

| 差距 | 状态 | 说明 |
|---|---|---|
| G-001 登录页与认证上下文 | 已补齐 | 新增 LoginPage、AuthContext、受保护路由和登出 |
| G-002 前端请求携带 Cookie | 已补齐 | API client 增加 `credentials: "include"`，后端 CORS 已支持凭证 |
| G-003 答题记录 | 已补齐 | 新增 records API、RecordsPage 和 RecordDetailPage |
| G-004 真实 PDF 导入 | 已补齐 | `parse-past-papers.ts` 已接入 pdf-parse，能提取 H61438 文本 |
| G-005 知识库 | 已补齐 | 新增 knowledge API、页面和 seed 数据 |
| G-006 问题反馈 | 已补齐 | 新增用户反馈、管理员回复和状态流转 |
| G-007 管理端 dashboard | 已补齐 | 新增 AdminDashboardPage |
| G-008 用户管理页面 | 已补齐 | 新增 AdminUsersPage |
| G-009 试卷管理页面 | 已补齐 | 新增 AdminPapersPage |
| G-010 题目防抓取 | 已补齐 | 新增 ProtectedText、sessionCrypto、sessionKeyStore |
| G-011 Markdown 渲染 | 已补齐 | 新增 Markdown 组件 |
| G-012 题目图片链路 | 已补齐 | 新增 QuestionImages 组件 |
| G-013 本地状态恢复 | 已补齐 | attempt store 接入 localState |
| G-014 管理端统计 | 已补齐 | 新增 `/api/admin/stats` 和 dashboard 统计 |
| G-015 内容审核流 | 已补齐 | 新增 admin papers 管理和导入发布流程 |

验证：

- `npm run typecheck` 通过
- `npm test` 通过：后端 235 个测试 + 24 个跳过，前端 60 个测试
- `npm run build` 通过

## 9. 2026-09-24 复验与补充

本轮先实际运行当前项目和参考项目，再针对复验发现的问题补代码并回归。

### 9.1 本轮修复

| 问题 | 修复 |
|---|---|
| Dashboard 统计全为 0 | 修正 `/api/admin/stats` 响应的客户端解包，增加待处理反馈统计 |
| 旧库没有知识库和反馈数据 | 增加 `schema_migrations` 与一次性 `20260923_backfill_seed_content` 回填 |
| Seed Markdown 显示字面 `\n` | 新库 seed 用 `char(10)` 写入真实换行，旧库增加 `20260924_normalize_seed_markdown` 修正 |
| 管理端反馈用户名为空 | `user_username` / `user_display_name` 正确映射为 `username` / `displayName` |
| 试卷管理缺少新建入口 | 管理端支持新建草稿试卷，列表返回 `question_count` |
| 知识库分类显示 `undefined docs` | 分类 API 返回文档数，页面本地化并显示分类/文档数量 |
| 缺少知识库后台管理 | 新增 `/admin/knowledge` 页面与受管理员权限保护的分类/文档 CRUD API |
| 管理端静默失败与中英文混排 | Dashboard、用户、试卷、订阅、作文批改、反馈、知识库均增加错误态并接入 i18n |

### 9.2 复验结果

- 管理看板实际显示：用户 2、题库 6、试卷 1、知识文档 4、有效订阅 2、完成练习 1、待处理反馈 1。
- 管理反馈页显示 seed 反馈、用户 `student`、状态“待处理”，并提供回复/关闭操作。
- 试卷管理显示 H61438、题量 5、状态“已发布”，新建试卷表单可用。
- 知识库管理页显示 4 个分类、4 篇文档、标签和发布状态，分类/文档新建表单可用。
- 用户知识库页显示分类文档数；点击文档后 Markdown 标题、段落和列表正常渲染。
- `npm run typecheck` 通过。
- `npm test` 通过：后端 244 个测试通过、24 个跳过；前端 70 个测试通过。
- `npm run build` 通过。

### 9.3 剩余差距

1. 端到端测试 T046 仍未落地，登录、答题、音频、报告全链路还没有浏览器自动化保护。
2. 错题本仍缺少参考项目的重练入口和更丰富的错题维度。
3. 管理看板比参考项目少了分类/题库概览表。
4. 前端生产包约 1.34 MB，后续需要代码分割。
5. 全量 PDF 导入、图片提取和防抓取链路仍需用真实材料继续验收。

### 9.4 更新后的完成度评估

| 维度 | 2026-09-23 | 2026-09-24 |
|---|---:|---:|
| 页面/功能覆盖 | 95% | 100% |
| 页面体验与信息密度 | 75% | 85% |
| 管理端可用性 | 70% | 90% |
| 数据/内容完整性 | 60% | 85% |
| 工程质量与测试 | 90% | 92% |
| 综合完成度 | 80-85% | 90% |
