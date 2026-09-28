# HSK 文档数据导入报告

> 结构化字段定义、命名约定、原卷分部语义、数据库映射表请参见 [past-exam-format.md](past-exam-format.md)。本文档聚焦导入流程、复验命令与最近一次复验记录。


| 项目 | 内容 |
|---|---|
| 日期 | 2026-09-24 |
| 数据源 | `docs/61332`, `docs/61438`, `docs/61551`, `docs/61552`；H61332 题目正文使用 `docs/61332/Test.md` |
| 目标库 | `data/app.db` |
| 目标题库 | `hsk-level-6` |
| 状态 | 已导入并发布 |
| 复验日期 | 2026-09-24 |

## 导入结果

| 试卷 | 年份 | 听力 | 阅读 | 书写 | 总题数 | 总分 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| H61332 | 2017 | 50 | 50 | 1 | 101 | 300 | published |
| H61438 | 2013 | 50 | 50 | 1 | 101 | 300 | published |
| H61551 | 2017 | 50 | 50 | 1 | 101 | 300 | published |
| H61552 | 2017 | 50 | 50 | 1 | 101 | 300 | published |

合计：4 套试卷、404 道题、12 个分部、44 个导入 group、36 条共享材料、4 个导入任务。

## 数据链路

1. `docs/` 原始 PDF / DOC / DOCX / 音频
2. `data/extracted/` 试卷文本
3. `data/answers/` 答案文本
4. `data/imported/` 设计格式 JSON
5. `data/app.db` 正式数据库

## 重跑命令

```bash
npm run extract:docs --workspace server
npm run import:docs --workspace server
```

## 验证

- `npm run typecheck`：通过
- `npm test`：通过，后端 252 个测试、前端 84 个测试
- `npm run build`：通过
- 数据库核对：4 试卷、12 分部、404 题、44 个导入 group、36 条共享材料、13 个资产

## 2026-09-24 复验补充

- `npm run extract:docs --workspace server` 重新生成 4 套结构化 JSON。
- `server/scripts/validate-past-papers.ts` 增加客观题选项数量校验；4 套卷均通过 101 题 / 300 分校验。
- 修复 OCR 丢项：H61332 第 20、26 题补 C 选项；H61551 第 67 题补 A 选项。
- H61551、H61552 的 WMA 转换为浏览器可播放 MP3，输出到 `data/media/`。
- `npm run import:docs --workspace server` 幂等重跑成功。
- 修复音频资产相对路径解析：服务进程在 `server/` 目录运行时，现在以项目根目录解析 `storage_key`。
- 学生端 `GET /api/banks/hsk-level-6/papers` 返回 4 套已发布试卷。
- 音频 Range 请求返回 `206 Partial Content` 和 `audio/mpeg`。

## 2026-09-24 阅读结构重构

- `extract-docs-data.ts` 的 section 增加 `groups` 结构。
- 每套阅读卷拆为 9 个 group：
  - `grammar`：第 51-60 题，请选出有语病的一项
  - `cloze`：第 61-70 题，选词填空
  - `blank-71-75`、`blank-76-80`：选句填空，各带共享段落
  - `comprehension-81-84`、`85-88`、`89-92`、`93-96`、`97-100`：阅读理解，各带共享文章
- 每套卷业务 group 共 11 个：听力 1 个、阅读 9 个、书写 1 个。
- 71-80 的共享段落和 81-100 的共享文章写入 `materials.text_content`，并通过 `question_group_versions.material_id` 关联。
- 51-60、61-70 没有共享材料，但 group instruction 已入库并在答题页显示。
- 学生端已验证第 51 题显示组题说明，第 71、81 题显示共享段落/文章，第 101 题显示书写原文。
- 新增 `server/tests/importedDocsStructure.test.ts` 锁定阅读 group、题号覆盖和共享材料结构。

## 2026-09-24 H61332 Markdown 重导

- H61332 题目正文来源从 OCR 文本切换为高质量 Markdown：`docs/61332/Test.md`。
- Markdown 解析覆盖 1-101 题题干、A-E 选项、阅读 9 个 group、共享段落/文章和书写原文。
- 修复 Markdown 分支生成 `session` 字段的问题，保证 `data/imported/h61332.json` 可按试卷会话识别。
- 重新执行 `npm run import:docs --workspace server`，H61332 导入为 101 题（听力 50、阅读 50、书写 1）、11 个业务 group、9 个 material group。
- 学生端修复单选题不渲染 `stem` 的问题；第 61 题已显示完整题干与四个选项。
- 浏览器抽查第 61、71、81、101 题：题干、共享段落/文章、书写规则与伯乐原文均正常显示。
- `node --import tsx server/scripts/validate-past-papers.ts data/imported/h61332.json` 通过 101 题 / 300 分校验。

## 2026-09-24 原卷分部结构复验

- 导入 JSON 的 group payload 保留原卷分部结构：
  - 听力：第一部分 1-15、第二部分 16-30、第三部分 31-50。
  - 阅读：第一部分 51-60、第二部分 61-70、第三部分 71-80、第四部分 81-100。
  - 书写：第 101 题。
- 阅读 9 个 material group 不回退合并；71-75、76-80 与 5 篇阅读文章仍按材料粒度入库，同时通过 payload 归属到原卷第三、第四部分。
- 导入脚本将 group payload 写入 `question_group_versions.payload_json`。
- 学生端答题卡按“听力/阅读/书写 + 第 X 部分 + 题号范围”分组；题目页顶部与材料卡显示当前分部。
- 原卷分部与题号文案固定使用中文：“第 X 部分”“第 X 题”，避免界面语言切换影响试卷原文结构。
- 浏览器验证第 1、16、61、81 题，分部标题、题号范围、材料与选项显示均与 H61332 原卷结构一致。

## 2026-09-24 OCR 选句填空 stem 串题修复

- 通过 pdftotext + 渲染比对定位 3 处 OCR stem 串题：
  - H61552 第 74、75 题 stem 完全相同（均含 (74) 与 (75)）。
  - H61552 第 79、80 题 stem 完全相同（均含 (79) 与 (80)）。
  - H61551 第 74 题 stem 过长（吞并前文两句话）。
- 根因：Tesseract OCR 把全角 `！？；` 转为半角 `!?;` 或直接吞掉，exractor 仅以 `split(/(?<=[。！？])/)` 断句，导致同一个「句子」跨多个空号。
- 修复 [server/scripts/extract-docs-data.ts](server/scripts/extract-docs-data.ts:155)：
  - `normalizeText` 增加半角 → 全角归一化（`!`→`！`、`?`→`？`、`;`→`；`）。
  - 3 处 blank block split 改为 `split(/(?<=[。！？；])/)`。
  - 新增 `splitSentenceByBlankMarkers(sentence, start, end)`：当一个「句子」含多个 `(N)` marker 时，按 marker 边界二次切分，每段只含一个空号。
- 重新跑 `npm run extract:docs`、`npm run import:docs` 后，4 套卷 101 题 / 300 分均通过 `validate-past-papers`；H61552 Q74/Q75/Q79/Q80 与 H61551 Q74 stem 现在各自只含自身题号。
- [server/tests/importedDocsStructure.test.ts](server/tests/importedDocsStructure.test.ts:142) 新增 `isolates each blank-fill stem to its own question number` 断言，4 套卷 40 个 blank 题全部通过；后端测试 253 通过 / 24 跳过。


## 2026-09-24 参考答案解释生成

- 新增 [server/scripts/generate-explanations.ts](server/scripts/generate-explanations.ts:1)，按题型 + 材料上下文批量生成中文解析。
- 生成策略：
  - 听力 Q1-50：标注正确答案 + 部分说明 + 选项原文。
  - 语法 Q51-60：标注语病类型说明 + 正确选项原文。
  - 选词 Q61-70：引用题干上下文 + 正确词组。
  - 选句 Q71-80：说明逻辑衔接 + 匹配原文相关句。
  - 阅读理解 Q81-100：匹配原文关键句作为依据。
  - 书写 Q101：任务要求 + 时间限制 + 评分 rubric。
- `npm run generate:explanations --workspace server` 生成 4 套卷 404 条解析，重新导入后 `question_versions.explanation` 从 404/404 NULL 变为 404/404 非空。
- `npm test --workspace server`：254 通过 / 24 跳过。
- `importedDocsStructure.test.ts`：7/7 通过（含 explanation 类型断言）。

## 说明

- H61438 使用 PDF 原生文本层。
- H61332 题目正文使用 `docs/61332/Test.md`；H61551、H61552 使用 150dpi 渲染 + Tesseract `chi_sim` OCR。
- 每套卷均包含听力音频资产、原始 PDF 资产和答案资产。
- 每个题型/题号 block 创建一个 group；有共享内容的 group 同时创建 material。
- 书写题保留原文材料、写作规则和评分 rubric。
- 数据库导入前已备份为 `data/app.db.backup-before-docs-import`。
