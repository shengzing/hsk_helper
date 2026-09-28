# HSK 真题数据格式规范

| 项目 | 内容 |
|---|---|
| 版本 | 1.1 |
| 适用数据 | `data/imported/*.json`（4 套六级真题） |
| 入库目标 | `data/app.db` 中的 `past_exam_papers` / `paper_sections` / `question_groups` / `question_group_versions` / `materials` / `questions` / `question_versions` / `paper_questions` / `assets` / `material_assets` / `paper_assets` |
| 维护者 | 内容组 |
| 配套脚本 | [server/scripts/extract-docs-data.ts](server/scripts/extract-docs-data.ts:1)、[server/scripts/import-docs-data.ts](server/scripts/import-docs-data.ts:1)、[server/tests/importedDocsStructure.test.ts](server/tests/importedDocsStructure.test.ts:1) |
| 关联文档 | [docs/plans/data-import-report.md](docs/plans/data-import-report.md:1)（导入流程与复验记录） |

## 1. 概述

本规范定义 HSK 真题在「设计态 JSON」（`data/imported/<code>.json`）与「运行态数据库」（`data/app.db`）中的字段含义、必填性、命名约定和原卷分部语义。

- **用途**：把原始 PDF/DOCX/Markdown 与答案文档解析为可入库的结构化 JSON；为答题页、题库后台、组卷/统计模块提供一致的数据源。
- **生命周期**：`docs/<code>/...` → `data/extracted/`、`data/answers/` → `data/imported/<code>.json`（设计态） → `data/app.db`（运行态） → 前端 API `GET /api/banks/{bankId}/papers`。
- **版本演进**：1.0 初版只把阅读卷按题型切分；1.1 在 `ExtractedGroup.payload` 上加入 `partNumber` 与 `parts[]`，以保留 HSK 原卷「第一/二/三/四部分」语义；听力部分沿用 `LISTENING_PARTS` 自动产出。

> **§ 跨文档引用**：与本规范配套的导入流程、复验命令与素材来源参见 [data-import-report.md](docs/plans/data-import-report.md:1)。本规范不再重复导入步骤，只约束数据形状。

## 2. 设计态 JSON 顶层结构

文件命名：`data/imported/<code>.json`，`<code>` 与 `SOURCES[i].code` 一致（`h61332` / `h61438` / `h61551` / `h61552`）。

```jsonc
{
  "paper_type": "past",
  "title": "HSK 六级真题 H61332",
  "year": 2017,
  "session": "h61332",
  "duration_seconds": 8400,
  "total_score": 300,
  "passing_score": 180,
  "sections": [ /* ExtractedSection[] */ ],
  "assets":   [ /* ExtractedAsset[]  */ ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `paper_type` | `"past"` \| `"mock"` | ✅ | 真题固定为 `"past"`；模拟卷等其他形态由后续脚本扩展。 |
| `title` | string | ✅ | 中文展示名（例：`HSK 六级真题 H61332`）。 |
| `year` | number \| null | ✅ | 出题年份；为 `null` 时不入 UNIQUE 索引判重。 |
| `session` | string | ✅ | 卷次代码，与 `id` 后缀 `paper-${session}` 对齐。 |
| `duration_seconds` | number (>0) | ✅ | 整套考试时长（秒），目前 4 套卷均为 `8400`（140 分钟）。 |
| `total_score` | number | ✅ | 整套总分，目前固定 `300`。 |
| `passing_score` | number | ✅ | 通过线，目前固定 `180`。 |
| `sections` | ExtractedSection[] | ✅ | 长度固定为 3：`listening` / `reading` / `writing`。 |
| `assets` | ExtractedAsset[] | ✅ | 长度通常为 1（仅听力音频）；OCR/PDF 文件不入此数组，由入库时按 `SOURCES[i].sourceFiles` 注入。 |

## 3. `sections[]`

每个 `ExtractedSection` 对应原卷的「一、听力」「二、阅读」「三、书写」3 个分部之一，由 [extract-docs-data.ts](server/scripts/extract-docs-data.ts:771) 写入。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `code` | `"listening"` \| `"reading"` \| `"writing"` | ✅ | 与 `paper_sections.code` 一致；也是 `paper-id` 之后缀。 |
| `title` | string | ✅ | 中文分部名（`听力` / `阅读` / `书写`）。 |
| `duration_seconds` | number (>0) | ✅ | 分部时长：听力 `2100`、阅读 `3000`、书写 `2700`。 |
| `questions` | ExtractedQuestion[] | ✅ | 该分部所有题目的扁平数组（按 `number` 升序）。 |
| `groups` | ExtractedGroup[] | ✅ | 按题型或原卷分部切分的题组，至少 1 个。 |

`groups[]` 数量规则：

| section | groups 数 | 说明 |
|---|:---:|---|
| `listening` | 1 | 唯一 group `main`，依靠 `payload.parts` 描述 3 个分部。 |
| `reading` | 9 | `grammar` / `cloze` / `blank-71-75` / `blank-76-80` / `comprehension-81-84` / `…85-88` / `…89-92` / `…93-96` / `…97-100`。 |
| `writing` | 1 | 唯一 group `summary`，承载第 101 题与书写原文材料。 |

## 4. `questions[]`

```ts
interface ExtractedQuestion {
  number: number;                                  // 1..101
  question_type: "single_choice" | "essay";
  stem: string;                                    // 题干；Markdown 卷非空，OCR 卷可能为空
  payload: Record<string, unknown>;                // 见各题型
  answer:  Record<string, unknown>;
  explanation?: string;                            // 参考答案解释（可选，待补录）
  score:   number;                                 // 选择题 2，书写题 100
}
```

题号约定：

- 听力 `1-50`、阅读 `51-100`、书写 `101`。
- `score` 等于数据库 `paper_questions.score`，与原稿赋分一致：客观题 `2` 分，书写题 `100` 分。
- `explanation` 为可选字段，用于存储每题的参考答案解释。已通过 [server/scripts/generate-explanations.ts](server/scripts/generate-explanations.ts:1) 按题型 + 材料上下文批量生成，404 题全部填充；听力部分基于题型模板（无音频 transcript），阅读部分结合题干 / 材料 / 正确答案关键词匹配生成，书写题包含任务要求与评分 rubric。

### 4.1 `single_choice`（听力 / 阅读客观题）

```jsonc
{
  "number": 61,
  "question_type": "single_choice",
  "stem": "题干文本（可为空，选项描述见 payload.options）",
  "payload": {
    "options": [
      { "key": "A", "text": "选项 A 内容" },
      { "key": "B", "text": "选项 B 内容" },
      { "key": "C", "text": "选项 C 内容" },
      { "key": "D", "text": "选项 D 内容" }
    ]
  },
  "answer": { "value": "B" },
  "explanation": null,
  "score": 2
}
```

| 子字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `payload.options[]` | `ExtractedOption[]` | ✅ | `key` 必须为 `"A"`-`"E"` 之一，`text` 已 `normalizeText` 去多余空白。 |
| `answer.value` | string | ✅ | 与 `options[].key` 取值一致；`"A"`-"`E"`。OCR 解析后允许为空串，由管理员补录。 |
| `payload.options` 来源 | — | — | 听力/阅读 OCR 解析：`[extractOptionsFromCell](server/scripts/extract-docs-data.ts:148)`；Markdown (`h61332`)：`[extractMarkdownOptions](server/scripts/extract-docs-data.ts:464)`。 |

> **健壮性**：书写题之外的填空/选句题 (`71-80`) 也归为 `single_choice`，5 个选项共用同一份 `payload.options`，由所在 group 在渲染时配合 `material` 展示。

### 4.2 `essay`（书写题）

```jsonc
{
  "number": 101,
  "question_type": "essay",
  "stem": "缩写",
  "payload": {
    "task_type": "summary",                     // summary / continuation / ...
    "reading_minutes": 10,
    "writing_minutes": 35,
    "target_length": 400,                       // 目标字数
    "rules": [
      "仔细阅读文章，阅读时不能抄写、记录。",
      "阅读后请缩写成一篇短文。",
      "标题自拟，只需复述文章内容，不需加入自己的观点。",
      "字数为 400 左右。"
    ],
    "material": "原卷书写原文（约 1100+ 字）……"
  },
  "answer": {
    "reference_essay": "",
    "rubrics": [
      { "criterion": "内容覆盖", "weight": 0.4 },
      { "criterion": "语言准确", "weight": 0.3 },
      { "criterion": "结构连贯", "weight": 0.3 }
    ]
  },
  "explanation": null,
  "score": 100
}
```

| 子字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `payload.task_type` | enum | ✅ | 当前实现只下发 `"summary"`。 |
| `payload.reading_minutes` | number | ✅ | 阅读原文的时间预算。 |
| `payload.writing_minutes` | number | ✅ | 写作时间预算。 |
| `payload.target_length` | number | ✅ | 目标字数。 |
| `payload.rules` | string[] | ✅ | 卷面规则，逐条展示。 |
| `payload.material` | string | ✅ | 卷面原文（伯乐 / 习惯 / ……）。由 `[parseEssay](server/scripts/extract-docs-data.ts:351)` 捕获。 |
| `answer.reference_essay` | string | ✅ | 当前为空，由阅卷或后续 LLM 流程填充。 |
| `answer.rubrics` | RubricItem[] | ✅ | 评分维度，`weight` 之和必须为 1。 |

## 5. `groups[]`

```ts
interface ExtractedGroup {
  key: string;                                   // 'main' | 'grammar' | 'comprehension-81-84' | ...
  instruction: string;                           // 组题说明（中文，来自原卷）
  material?: string;                             // 共享原文（阅读选句/阅读理解段落）
  questionNumbers: number[];                     // 引用 section.questions 中的题号
  payload?: {
    partNumber?: number;                         // 归属原卷分部（仅 reading）
    parts?: Array<{                              // 详细分部（仅 listening）
      partNumber: 1 | 2 | 3 | 4;
      instruction: string;
      questionNumbers: number[];
    }>;
  };
}
```

| 字段 | 类型 | 必填 | 适用 group | 说明 |
|---|---|:---:|---|---|
| `key` | string | ✅ | all | 见上文 group 列表；命名见 § 8。 |
| `instruction` | string | ✅ | all | 顶部组题说明；其中 `main`(听力) 使用 `"听力"`，其余使用 `第 X-Y 题：...` 形式。 |
| `material` | string? | 否 | `blank-*` / `comprehension-*` / `summary` | 共享原文，渲染时与题组关联。 |
| `questionNumbers` | number[] | ✅ | all | 该 group 引用的题号集合。`questionNumbers` 是 `section.questions` 子集的索引源。 |
| `payload.partNumber` | number? | 否 | `grammar` / `cloze` / `blank-*` / `comprehension-*` | 阅读 group 的原卷分部号。 |
| `payload.parts` | Part[]? | 否 | `main`(听力) | 听力 3 个子分部的展开（含 `partNumber` / `instruction` / `questionNumbers`）。 |

### 5.1 听力 group（`main`）

`payload.parts` 在 [extract-docs-data.ts](server/scripts/extract-docs-data.ts:106) 由 `LISTENING_PARTS` 静态生成，再被 `buildListeningGroupPayload` 按试卷实际题号过滤：

| partNumber | 题号范围 | instruction |
|:---:|:---:|---|
| 1 | 1-15 | 第 1-15 题：请选出与所听内容一致的一项。 |
| 2 | 16-30 | 第 16-30 题：请选出正确答案。 |
| 3 | 31-50 | 第 31-50 题：请选出正确答案。 |

> **降级**：若 `payload` 缺失，答题页按「单组」渲染并在 card header 显示 `instruction`；若 `payload.parts` 缺失，则仅以 `questionNumbers` 范围生成 `第 X-Y 题`。

### 5.2 阅读 group（9 个）

| group.key | payload.partNumber | instruction | 题号范围 |
|---|:---:|---|:---:|
| `grammar` | 1 | 第 51-60 题：请选出有语病的一项。 | 51-60 |
| `cloze` | 2 | 第 61-70 题：选词填空。 | 61-70 |
| `blank-71-75` | 3 | 第 71-75 题：选句填空。 | 71-75 |
| `blank-76-80` | 3 | 第 76-80 题：选句填空。 | 76-80 |
| `comprehension-81-84` | 4 | 第 81-84 题：请选出正确答案。 | 81-84 |
| `comprehension-85-88` | 4 | 第 85-88 题：请选出正确答案。 | 85-88 |
| `comprehension-89-92` | 4 | 第 89-92 题：请选出正确答案。 | 89-92 |
| `comprehension-93-96` | 4 | 第 93-96 题：请选出正确答案。 | 93-96 |
| `comprehension-97-100` | 4 | 第 97-100 题：请选出正确答案。 | 97-100 |

注：`blank-*` 与 `comprehension-*` 共 7 个 group 同时携带 `material`（共享段落 / 文章）。

### 5.3 书写 group（`summary`）

唯一 group，承载 101 题与卷面原文（≈1100 字散文/记叙文）。`payload` 可省略；渲染时由 `material` 直接显示原文，`questionNumbers = [101]`。

## 6. `assets[]`

```ts
interface ExtractedAsset {
  id: string;                                    // 'asset-h61332-audio'
  asset_type: "audio" | "pdf" | "answer_key" | ...;
  storage_key: string;                           // 'docs/61332/Listening.mp3'
  url: string;                                   // '/api/papers/paper-h61332/assets/asset-h61332-audio'
  mime_type: string;                             // 'audio/mpeg'
  usage: "full_listening_audio" | "source_pdf" | "answer_key" | ...;
  duration_ms?: number;                          // 仅 audio
  file_size?: number;                            // 仅 pdf / answer_key
}
```

> 注意：PDF 原稿与答案键等资产由 [import-docs-data.ts](server/scripts/import-docs-data.ts:315) 在入库阶段按 `SOURCES[i].sourceFiles` / `answerFile` 注入 `assets` 表，并不进入 `data/imported/*.json`。上表 schema 描述的是「JSON 内当前可见的部分」+「入库阶段补足的部分」的并集。

| 资产使用 | `usage` | `asset_type` | 典型 `storage_key` | `mime_type` |
|---|---|---|---|---|
| 全卷听力 | `full_listening_audio` | `audio` | `docs/<code>/Listening.mp3` | `audio/mpeg` |
| 试卷原稿 | `source_pdf` | `pdf` | `docs/<code>/H6xxxx.pdf` | `application/pdf` |
| 答案键 | `answer_key` | `pdf` / `doc` / `docx` | `docs/<code>/H6xxxx答案.docx` | 见上 |

## 7. 数据库映射

下表对照 `data/imported/<code>.json` 字段 → `data/app.db` 表/列。所有写入均以事务形式执行（[import-docs-data.ts](server/scripts/import-docs-data.ts:171)）。

| 设计态 | 运行态表 | 运行态列 / 主键 | 备注 |
|---|---|---|---|
| 顶层 `paper_type/year/session/title/duration/total/passing` | `past_exam_papers` | `id='paper-<code>'`, 上述同名列 | `status='published'` |
| `sections[].code/title/duration_seconds` | `paper_sections` | `id='section-<code>-<section>'` | `display_order`: listening=1, reading=2, writing=3；listening `answer_transfer_seconds=300` |
| 听力 group `main.material`、阅读 group `material`、书写 group `material` | `materials` | `id='material-<code>-<section>-<groupKey>'` | `material_type='audio'`(listening) 或 `'text'`(其它)；`text_content` 仅文本类写入 |
| 听力音频资产 | `assets` | `id='asset-<code>-audio'` | `storage_key` = `docs/<code>/...mp3`；`usage='full_listening_audio'` |
| 音频绑定到 `main.material` | `material_assets` | `usage='audio', play_limit=1` | 全卷听力一次播放限制 |
| `groups[]` | `question_groups` | `id='group-<code>-<section>-<key>'`, `group_type='material'` | 1 个 group 对应 1 行 |
| `groups[]` + `instruction` + `material_id` + `payload` | `question_group_versions` | `id='qgv-<code>-<section>-<key>'`, `version_number=1`, `is_current=1` | `payload_json = JSON.stringify(group.payload ?? {})` |
| `questions[]` 元数据 | `questions` | `id='q-<code>-<number>'`, `bank_id='hsk-level-6'` | `question_group_id` 指向所属 group |
| `questions[]` 题目体 | `question_versions` | `id='qv-<code>-<number>'`, `version_number=1`, `is_current=1`, `is_enabled=1` | `difficulty=3`、`scoring_policy='exact'`、`explanation=question.explanation ?? null` |
| `sections[].questions` 排序 | `paper_questions` | `id='pq-<code>-<number>'`, `display_order=number`, `score=question.score` | 关联 `paper_id` / `section_id` / `question_id` / `question_version_id` / `question_group_version_id` |
| 原卷 PDF | `assets` + `paper_assets` | `id='asset-<code>-source-N'`, `usage='source_pdf'` | `file_size` 由 `statSync` 写入 |
| 答案键 | `assets` + `paper_assets` | `id='asset-<code>-answer'`, `usage='answer_key'`, `display_order=10` | `.doc` / `.docx` 对应不同 `mime_type` |
| 审计 | `import_jobs` | `id='import-<code>-<uuid>'`, `status='published'` | `parsed_json` 存整张设计态 JSON；`operator_id='user-admin'` |

> `BANK_ID` 固定为 `"hsk-level-6"`，由 [import-docs-data.ts](server/scripts/import-docs-data.ts:60) 定义。id 前缀前缀规则见 § 8。

## 8. 命名约定

| 实体 | 模板 | 示例 |
|---|---|---|
| 试卷主键 | `paper-<code>` | `paper-h61332` |
| 分部主键 | `section-<code>-<section>` | `section-h61332-listening` |
| Group | `group-<code>-<section>-<key>` | `group-h61332-reading-comprehension-81-84` |
| Group 版本 | `qgv-<code>-<section>-<key>` | `qgv-h61332-reading-comprehension-81-84` |
| Material | `material-<code>-<section>-<key>` | `material-h61332-listening-main` |
| Question | `q-<code>-<number>` | `q-h61332-61` |
| Question version | `qv-<code>-<number>` | `qv-h61332-61` |
| Paper question | `pq-<code>-<number>` | `pq-h61332-61` |
| 听力音频 | `asset-<code>-audio` | `asset-h61332-audio` |
| 原卷 PDF | `asset-<code>-source-N` | `asset-h61552-source-1` |
| 答案键 | `asset-<code>-answer` | `asset-h61552-answer` |
| 导入任务 | `import-<code>-<uuid>` | `import-h61332-3a1b…` |

`<section>` 取 `listening` / `reading` / `writing`；`<key>` 取 § 5 列表中固定字符串；`<number>` 保留原题号，不足 3 位不补零。

## 9. 各卷差异（H61332 / H61438 / H61551 / H61552）

| 卷次 | 题目正文来源 | 备注 |
|---|---|---|
| `h61332` | [`docs/61332/Test.md`](docs/61332/Test.md:1) | 唯一走 Markdown 解析路径；阅读 9 group、共 101 题、共享段落/文章完整。 |
| `h61438` | [`docs/61438/H61438听力 阅读.pdf`](docs/61438/H61438听力 阅读.pdf:1)、[`docs/61438/H61438书写.pdf`](docs/61438/H61438书写.pdf:1) | PDF 原生文本层；阅读 9 group 结构同上。 |
| `h61551` | [`docs/61551/H61551.pdf`](docs/61551/H61551.pdf:1) | 150dpi 渲染 + Tesseract `chi_sim` OCR；曾因 OCR 丢选项在 v1.0.1 修复（第 67 题补 A）。 |
| `h61552` | [`docs/61552/H61552.pdf`](docs/61552/H61552.pdf:1) | 同上，原 WMA 转 MP3 至 `data/media/`；音频 `storage_key` 指向 `data/media/h61552.mp3`。 |

> OCR 卷的 `single_choice.stem` 允许为空字符串；Markdown 卷（如 H61332）的 `stem` 必现，这是验收阅读 61+ 题干显示的依据。

## 10. 兼容性与降级

| 场景 | 行为 |
|---|---|
| `group.payload` 缺失 | 答题页按 `instruction` + `questionNumbers` 渲染为单组卡；不显示分部标题。 |
| `listening.payload.parts` 缺失 | 退化为按 `questionNumbers` 范围生成「第 X-Y 题」分段。 |
| `reading.group.payload.partNumber` 缺失 | 该 group 不显示原卷分部；group 仍按题型标识渲染。 |
| `material` 缺失 | `blank-*` / `comprehension-*` group 不再附加段落/文章卡，但题组仍可答题（题干 `stem` 已包含原句）。 |
| `questions[].payload.options` 不足 4 个 | 管理后台在导入校验阶段告警，由 `validate-past-papers.ts` 卡住；不进入数据库。 |
| 旧版（v1.0）设计态 JSON | 没有 `group.payload` 字段；可重新执行 `npm run extract:docs --workspace server` 一次性升级到 v1.1。 |

## 11. 验证

- **结构测试**：[server/tests/importedDocsStructure.test.ts](server/tests/importedDocsStructure.test.ts:1) 锁定 9 个阅读 group 的固定 key、payload.partNumber 序列 `[1,2,3,3,4,4,4,4,4]`、听力 3-part 序列，以及 H61332 Markdown 来源校验（`not.toContain('generic/')` 等）。
- **导入校验**：`server/scripts/validate-past-papers.ts` 校验客观题选项数量、卷面总分 300。
- **接口联调**：`GET /api/banks/hsk-level-6/papers` 应返回 4 条 `paper-h6****` 记录；详情接口附 `sections[].groups[].question_numbers`。
- **浏览器抽查**：第 1、16、31、61、71、81、101 题的题干 / 共享材料 / 书写规则与分部结构需与原卷一致。

## 12. 修订记录

| 日期 | 版本 | 关键变化 |
|---|:---:|---|
| 2026-09-24 | 1.0 | 听力/阅读/书写三段式；阅读按 4 部分切分。 |
| 2026-09-24 | 1.1 | `ExtractedGroup.payload` 增加 `partNumber` / `parts`，完整保留原卷分部结构；阅读拆为 9 个 material group；H61332 切换为高质量 Markdown 源。 |
| 2026-09-24 | 1.1.1 | 新增本规范文档；明确 `BANK_ID="hsk-level-6"`、资产命名约定和与 `data-import-report.md` 的分工。 |
| 2026-09-24 | 1.1.2 | OCR 选句填空 stem 串题修复：`normalizeText` 半角→全角归一化、`split(/(?<=[。！？；])/)` 扩展、新增 `splitSentenceByBlankMarkers` 二级切分；测试新增「每个 blank stem 只含自身题号」断言。 |
| 2026-09-24 | 1.2.0 | `ExtractedQuestion` 新增可选 `explanation` 字段；导入脚本 INSERT 写入 `question_versions.explanation`；格式文档同步修订。 |
| 2026-09-24 | 1.2.1 | 新增 `generate-explanations.ts` 脚本，按题型批量生成 404 条中文解析并入库；`question_versions.explanation` 从全量 NULL 变为全量非空。 |
