# HSK 在线答题平台技术设计

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.2 |
| 日期 | 2026-09-23 |
| 范围 | 现行 HSK 1-6 级纸笔/机考题型在线训练与模拟考 |
| 技术基线 | 复用 `../kid_progreming` 的 React + Vite + Express + TypeScript + SQLite 结构 |
| 执行清单 | `docs/plans/2026-09-23-hsk-platform-todolist.md` |

## 1. 目标与范围

### 1.1 产品目标

1. 用户按 HSK 等级订阅真题包，等级包内所有已发布真题、模拟卷、素材和知识点整体开放。
2. 支持 HSK 1-6 级真题与模拟卷的整卷限时练习。
3. 将听力、阅读、书写中的具体题目抽象为通用交互模型，后续新增题型不改核心表结构。
4. 客观题提交后立即判分；写作题支持待人工/AI 批改。
5. 保存答题过程、音频播放记录、成绩报告和错题。
6. 内容管理员可以导入 PDF、答案 DOC/DOCX 和音频，并完成校对、审核、发布。
7. 界面支持世界使用人数前十语言，覆盖 LTR/RTL、主要文字系统和本地化格式。

### 1.2 非目标

- 不做 HSK 报名、代查分、证书服务。
- 不做 HSKK 口语考试。
- 不做 HSK 3.0 的 7-9 级新题型；如后续支持，应新建题型版本而不是修改现行 1-6 数据。
- MVP 不做强在线监考、防切屏作弊和支付收银闭环；订阅权益按等级建模，初期可由管理员开通，后续可接订单系统。
- 多语言范围是界面与运营文案；考试题干、选项、答案、听力原文和写作材料不做自动翻译。

## 2. 调研结论

### 2.1 等级结构

以下数据来自中文考试服务网官方等级页，并与本仓库 `docs/61438/H61438听力 阅读.pdf`、`H61438书写.pdf` 样卷核对：

| 等级 | 分部 | 题量 | 分部时长 | 总题量 | 总时长 | 满分 | 合格线 |
|---|---|---:|---:|---:|---:|---:|---:|
| HSK 1 | 听力 4 部分 | 20 | 约 15 分钟 | 40 | 约 40 分钟 | 200 | 120 |
| HSK 1 | 阅读 4 部分 | 20 | 17 分钟 |  |  |  |  |
| HSK 2 | 听力 4 部分 | 35 | 约 25 分钟 | 60 | 约 55 分钟 | 200 | 120 |
| HSK 2 | 阅读 4 部分 | 25 | 22 分钟 |  |  |  |  |
| HSK 3 | 听力 4 部分 | 40 | 约 35 分钟 | 80 | 约 90 分钟 | 300 | 180 |
| HSK 3 | 阅读 3 部分 | 30 | 30 分钟 |  |  |  |  |
| HSK 3 | 书写 2 部分 | 10 | 15 分钟 |  |  |  |  |
| HSK 4 | 听力 3 部分 | 45 | 约 30 分钟 | 100 | 约 105 分钟 | 300 | 180 |
| HSK 4 | 阅读 3 部分 | 40 | 40 分钟 |  |  |  |  |
| HSK 4 | 书写 2 部分 | 15 | 25 分钟 |  |  |  |  |
| HSK 5 | 听力 2 部分 | 45 | 约 30 分钟 | 100 | 约 125 分钟 | 300 | 180 |
| HSK 5 | 阅读 3 部分 | 45 | 45 分钟 |  |  |  |  |
| HSK 5 | 书写 2 部分 | 10 | 40 分钟 |  |  |  |  |
| HSK 6 | 听力 3 部分 | 50 | 约 35 分钟 | 101 | 约 140 分钟 | 300 | 180 |
| HSK 6 | 阅读 4 部分 | 50 | 50 分钟 |  |  |  |  |
| HSK 6 | 书写 1 题 | 1 | 45 分钟 |  |  |  |  |

分部题量：

| 等级 | 听力 | 阅读 | 书写 |
|---|---|---|---|
| HSK 1 | 5 + 5 + 5 + 5 | 5 + 5 + 5 + 5 | - |
| HSK 2 | 10 + 10 + 10 + 5 | 5 + 5 + 5 + 10 | - |
| HSK 3 | 10 + 10 + 10 + 10 | 10 + 10 + 10 | 5 + 5 |
| HSK 4 | 10 + 15 + 20 | 10 + 10 + 20 | 10 + 5 |
| HSK 5 | 20 + 25 | 15 + 10 + 20 | 8 + 2 |
| HSK 6 | 15 + 15 + 20 | 10 + 10 + 10 + 20 | 1 |

官方入口：

- `https://www.chinesetest.cn/HSK/1` 至 `https://www.chinesetest.cn/HSK/6`

### 2.2 本地样卷验证

`H61438` 证实了 HSK 6 的实际呈现：

1. 听力第一部分 1-15：听内容后选一致项，四选一。
2. 听力第二部分 16-30：听对话选答案，四选一。
3. 听力第三部分 31-50：听长对话/短文选答案，四选一。
4. 阅读第一部分 51-60：选出有语病的一项，四选一。
5. 阅读第二部分 61-70：选词填空，每题一段材料多个空、四组选项。
6. 阅读第三部分 71-80：选句填空，一组短文/长文带 5 个空、A-E 选项。
7. 阅读第四部分 81-100：文章阅读，每篇文章带 4 题。
8. 书写 101：读材料后缩写 400 字左右。

结论：HSK 的题目不只是“单题 + 选项”，经常出现一组材料共享多个题、一个词库/选项组服务多个空的情况。数据结构必须显式支持 `Group/Material -> Item`。

## 3. 总体架构

沿用 `kid_progreming` 的单仓库前后端分离结构：

```text
React 18 + Vite + TypeScript + Ant Design
        |
        | REST / JSON
        v
Express 4 + TypeScript
        |
        |-- routes
        |-- services
        |-- repositories
        |-- middlewares
        |
        v
SQLite (better-sqlite3, WAL)
```

### 3.1 代码结构

```text
hsk_helper/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── exam/
│   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   ├── AnswerSheet.tsx
│   │   │   │   ├── MaterialPanel.tsx
│   │   │   │   └── QuestionRenderer.tsx
│   │   │   └── questions/
│   │   │       ├── SingleChoice.tsx
│   │   │       ├── TrueFalse.tsx
│   │   │       ├── Sorting.tsx
│   │   │       ├── WordReorder.tsx
│   │   │       ├── DragFill.tsx
│   │   │       ├── TextFill.tsx
│   │   │       └── Essay.tsx
│   │   ├── i18n/
│   │   │   ├── I18nProvider.tsx
│   │   │   ├── locales.ts
│   │   │   └── locales/
│   │   │       ├── en-US/
│   │   │       ├── zh-CN/
│   │   │       └── ...
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── styles/
│   │   └── types/
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── seed.sql
│   │   │   └── connection.ts
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── attemptService.ts
│   │   │   ├── subscriptionService.ts
│   │   │   ├── gradingService.ts
│   │   │   └── localizationService.ts
│   │   │   ├── paperService.ts
│   │   │   └── importService.ts
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── utils/
│   └── scripts/
│       ├── parse-past-papers.ts
│       ├── validate-past-papers.ts
│       └── convert-media.ts
└── docs/
```

### 3.2 与参考项目的映射

| 参考项目概念 | HSK 项目对应 | 变化 |
|---|---|---|
| `question_banks` | HSK 等级真题包 | 一个 HSK 等级一个包，是订阅和授权的最小单位 |
| `user_bank_permissions` | `bank_subscriptions` | 从单纯权限关系升级为带有效期、状态和来源的订阅权益 |
| `past_exam_papers` | 真题卷/模拟卷 | 增加 `paper_type`、音频、分部计时 |
| `paper_sections` | 听力/阅读/书写 | 不再要求单一题型，一个分部含多个题型组 |
| `question_versions` | 可判分题目项 | 引入 `payload_json`、`answer_json` |
| `question_options` | 选择题 payload 内 options | 便于支持图片选项和共享选项组 |
| `paper_questions` | 卷内题目排序与分值 | 增加 `question_group_version_id` |
| `attempt_question_results` | 判分结果 | 答案与结果分表，支持自动保存 |
| `programming_question_specs` | 删除 | 用题型 payload 和判分器注册表替代 |

### 3.3 订阅体系与操作流程

#### 3.3.1 真题包口径

1. **一个 HSK 等级对应一个真题包**：HSK 1-6 共 6 个包，例如 `hsk-level-4`。
2. **订阅单位是等级包**：不按单套试卷、单道题或单个分部售卖。
3. **包内整体开放**：用户开通某等级后，可见并使用该等级下所有已发布真题、模拟卷、听力素材、解析、错题重练和该等级知识点。
4. **等级不隐式继承**：订阅 HSK 4 不能访问 HSK 5；如商业上需要组合包，应创建套餐模板并同时生成多条等级订阅。
5. **同一用户可订阅多个等级**：每条订阅独立计有效期和状态。

#### 3.3.2 订阅状态

| 状态 | 含义 | 能否开始新练习 | 能否查看报告/错题 |
|---|---|---|---|
| `active` | 生效中 | 是 | 是 |
| `paused` | 管理员暂停 | 否 | 是 |
| `expired` | 已到期 | 否 | 是 |
| `canceled` | 已撤销 | 否 | 是 |

到期或暂停后的处理：

1. 不能开始新的 attempt，也不能访问未开始的试卷详情。
2. 已提交报告、练习历史和错题记录保留。
3. 进行中的 attempt 默认只允许提交，不允许继续作答；如业务需要宽限期，通过系统配置开启。
4. 素材接口同样校验订阅状态，避免绕过页面直接拉音频或图片。

#### 3.3.3 管理端流程

操作流程与 `kid_progreming` 保持一致：

```text
管理员登录
  -> 用户管理：创建/禁用用户
  -> 选择用户与一个或多个 HSK 等级
  -> 设置生效时间、到期时间和备注
  -> 生成 bank_subscriptions
  -> 写入审计日志
  -> 用户端目录同步生效
```

管理员可执行：

1. 单个用户开通一个或多个等级包。
2. 批量选择用户开通同一等级。
3. 暂停、恢复、撤销、续期。
4. 查看订阅状态、到期提醒和使用情况。
5. 保留每次变更的操作人、时间、前后状态和备注。

MVP 的 `source` 先支持 `manual`，后续接支付后新增 `order` 并关联订单号；权益表不直接耦合支付实现。

#### 3.3.4 用户端流程

```text
用户登录
  -> 查询有效订阅
  -> 题库列表只展示已订阅等级
  -> 进入等级真题包
  -> 选择真题/模拟卷
  -> 校验订阅与试卷状态
  -> 创建 attempt 并开始服务端计时
  -> 作答、自动保存、提交
  -> 查看报告、解析、错题
```

### 3.4 多语言界面与本地化

#### 3.4.1 支持语言

默认采用“总使用人数（L1 + L2）”前十语言口径，语言清单由 `supported_locales` 配置，不在代码中硬编码：

| 优先级 | Locale | 语言 | 文字方向 | 备注 |
|---:|---|---|---|---|
| 1 | `en-US` | English | LTR | 全局 fallback 语言 |
| 2 | `zh-CN` | 中文（普通话，简体） | LTR | 产品默认语言，考试内容语言 |
| 3 | `hi-IN` | हिन्दी | LTR | Devanagari 字体与数字格式 |
| 4 | `es` | Español | LTR | 使用中性西班牙语文案 |
| 5 | `fr-FR` | Français | LTR | - |
| 6 | `ar` | العربية | RTL | Modern Standard Arabic |
| 7 | `bn-BD` | বাংলা | LTR | Bengali 字体 |
| 8 | `ru-RU` | Русский | LTR | - |
| 9 | `pt-BR` | Português | LTR | 覆盖巴西葡语习惯 |
| 10 | `ur-PK` | اردو | RTL | Nastaliq/Arabic 字体需验证 |

口径说明：以上按 The World Factbook 2022 的宏语言总使用人数排名。若业务确认改用 Ethnologue 2026 的 individual language 口径，第 8/9 位附近会出现 `id-ID`（Indonesian）并影响俄语是否入榜；由于语言清单是配置数据，替换不需要改动 i18n 架构。

#### 3.4.2 技术方案

1. 前端使用 `i18next` + `react-i18next`，按 locale 懒加载翻译包。
2. 翻译文件按模块拆分：`common`、`auth`、`exam`、`report`、`admin`、`errors`。
3. 复数、性别、插值使用 ICU MessageFormat；日期、时间、数字、百分比、倒计时使用 `Intl` API。
4. Ant Design 使用 `ConfigProvider` 注入 locale；官方缺少 locale 包的语言使用自定义组件文案和英文 fallback。
5. 语言选择顺序：URL locale -> 用户资料 -> `localStorage` -> `Accept-Language` -> `zh-CN`。
6. 路由支持 locale 前缀，例如 `/zh-CN/banks`、`/en-US/banks`；根路径按检测顺序重定向。
7. 服务端错误只返回稳定 `code` 和参数，由前端映射为本地化文案；避免把中文错误消息硬编码在 API 中。
8. 审计日志和内部枚举保存英文/代码值，展示层再本地化。

#### 3.4.3 范围边界

必须本地化：

1. 导航、按钮、表单标签、校验提示、空状态。
2. 答题卡、倒计时、提交确认、自动保存提示。
3. 订阅状态、到期时间、权限提示。
4. 报告中的分部名、题型名、统计标签。
5. 后台用户、订阅、导入、审核界面的操作文案。

不自动本地化：

1. 考题原文、选项、图片题干、听力脚本和写作材料。
2. 用户提交的答案和作文。
3. 原始真题 PDF、答案文件和审计日志。

解析与知识点可后续增加人工翻译版本，但不能覆盖原中文内容；应使用独立 `*_i18n` 表或字段。

#### 3.4.4 RTL 与字体

1. `ar`、`ur` 设置 `<html dir="rtl" lang="...">`。
2. CSS 使用逻辑属性：`margin-inline-start`、`padding-inline-end`、`inset-inline-start`。
3. 布局、表格、抽屉、进度条、答题卡、拖拽方向随 `dir` 镜像。
4. 返回/前进/排序箭头等方向性图标必须显式设计 RTL 版本。
5. 字体栈包含 Noto Sans、Noto Sans Arabic、Noto Sans Bengali、Noto Sans Devanagari 及系统字体；考试中文正文保持原字体。
6. 所有固定宽度控件必须用最小/最大宽度约束，避免长译文溢出。

#### 3.4.5 翻译管理

1. 翻译 key 按模块和语义命名，例如 `exam.answer_sheet.unanswered`。
2. 源文案以 `en-US` 和 `zh-CN` 双源维护，其他语言从英文翻译，中文专有名词由术语表约束。
3. 所有组件禁止拼接句子；必须使用插值和复数规则。
4. 翻译包与前端版本一起发布，缺失 key 在 CI 中直接失败。
5. 机器翻译可作为草稿，上线前必须经过母语或专业审校；发布后保留翻译版本和审校人。

## 4. 题型抽象

### 4.1 原则

1. **可判分单元统一叫 Question Item**：对应答题卡上一个编号或一个可独立评分的空。
2. **共享材料统一叫 Material/Question Group**：长音频、阅读文章、图片组、词库、A-E 选项组都可以挂在一个组上。
3. **公开数据与答案分离**：`payload_json` 可在答题前返回，`answer_json` 仅提交后或管理端可见。
4. **题型扩展不改表结构**：新增题型只需新增 Zod schema、前端 renderer、判分器。

### 4.2 题型枚举

```ts
export type HskQuestionType =
  | 'single_choice'
  | 'true_false'
  | 'sorting'
  | 'word_reorder'
  | 'drag_fill'
  | 'text_fill'
  | 'essay';

export type QuestionGroupType =
  | 'material'
  | 'option_set'
  | 'word_pool';
```

### 4.3 题型矩阵

| HSK 场景 | 抽象题型 | 判分 | 前端交互 |
|---|---|---|---|
| 听力/阅读判断对错 | `true_false` | 自动 | 对/错按钮 |
| 听力选择、阅读单选、病句选择 | `single_choice` | 自动 | 单选，支持文本/图片选项 |
| 句子顺序排列 | `sorting` | 自动 | 上移/下移/拖拽排序 |
| 连词成句 | `word_reorder` | 自动/规则 | 词块拖拽，可键盘输入 |
| 选词/选句填空 | `drag_fill` | 自动 | 词库池与空位映射 |
| 看拼音写汉字 | `text_fill` | 自动 | 文本输入，支持多答案 |
| 看图写句、短文、缩写 | `essay` | 人工/AI | 多行输入、字数统计 |

`COMPOSITE` 不作为判分题型建模；共享材料或选项组由 `question_groups` 表达，子题仍是独立可判分项。

## 5. 数据模型

### 5.1 核心关系

```text
supported_locale 1..* user
user 1..* bank_subscription
bank_subscription *..1 question_bank
question_bank 1..* paper
paper 1..* paper_section
paper 1..* paper_question
paper_section 1..* paper_question
question_bank 1..* question_group
question_group 1..* question_group_version
question_group_version 0..1 material
question_group 1..* question_item
question_item 1..* question_version
paper_question 1..1 question_version
paper_question 0..1 question_group_version
paper 1..* paper_question
attempt 1..* attempt_answer
attempt 1..* attempt_question_result
attempt_question_result 0..1 wrong_question
attempt_question_result 0..1 essay_review
```

### 5.2 核心表

```sql
CREATE TABLE question_banks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supported_locales (
    id TEXT PRIMARY KEY, -- BCP-47，例如 en-US、zh-CN、ar
    language_name TEXT NOT NULL,
    endonym TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('ltr', 'rtl')),
    display_order INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    fallback_locale_id TEXT REFERENCES supported_locales(id),
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- active / disabled
    expires_at TEXT NOT NULL DEFAULT '2099-12-31',
    ui_locale TEXT NOT NULL DEFAULT 'zh-CN' REFERENCES supported_locales(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active', -- active / paused / expired / canceled
    starts_at TEXT NOT NULL,
    expires_at TEXT,
    source TEXT NOT NULL DEFAULT 'manual', -- manual / order / import
    order_id TEXT,
    operator_id TEXT REFERENCES users(id),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_bank_subscriptions_current
    ON bank_subscriptions(user_id, bank_id)
    WHERE status IN ('active', 'paused');

CREATE TABLE admin_operation_logs (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL, -- create / update / pause / resume / cancel / renew / publish
    object_type TEXT NOT NULL, -- user / subscription / paper / question / asset
    object_id TEXT NOT NULL,
    before_state_json TEXT,
    after_state_json TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_operation_logs_object
    ON admin_operation_logs(object_type, object_id, created_at);

CREATE TABLE past_exam_papers (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    paper_type TEXT NOT NULL DEFAULT 'past', -- past / mock
    year INTEGER,
    session TEXT,
    title TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    total_score REAL NOT NULL,
    passing_score REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    UNIQUE (bank_id, paper_type, year, session)
);

CREATE TABLE paper_sections (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- listening / reading / writing
    title TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    duration_seconds INTEGER,
    answer_transfer_seconds INTEGER DEFAULT 0,
    scaled_score REAL,
    UNIQUE (paper_id, display_order),
    UNIQUE (paper_id, code)
);

CREATE TABLE materials (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    material_type TEXT NOT NULL, -- audio / text / image_group / mixed
    title TEXT,
    text_content TEXT,
    transcript TEXT,
    payload_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE question_groups (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    group_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE question_group_versions (
    id TEXT PRIMARY KEY,
    question_group_id TEXT NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    group_type TEXT NOT NULL,
    instruction TEXT,
    material_id TEXT REFERENCES materials(id),
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    is_current INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (question_group_id, version_number)
);

CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    question_group_id TEXT REFERENCES question_groups(id),
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_versions (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    question_type TEXT NOT NULL,
    stem TEXT,
    difficulty INTEGER NOT NULL DEFAULT 3,
    payload_json TEXT NOT NULL,
    answer_json TEXT NOT NULL,
    scoring_policy TEXT NOT NULL DEFAULT 'exact',
    explanation TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    is_current INTEGER NOT NULL DEFAULT 1,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (question_id, version_number)
);

CREATE TABLE paper_questions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES paper_sections(id),
    question_id TEXT NOT NULL REFERENCES questions(id),
    question_version_id TEXT NOT NULL REFERENCES question_versions(id),
    question_group_version_id TEXT REFERENCES question_group_versions(id),
    display_order INTEGER NOT NULL,
    score REAL NOT NULL CHECK (score >= 0),
    UNIQUE (paper_id, display_order),
    UNIQUE (paper_id, question_id)
);
```

订阅有效性按 `status`、`starts_at`、`expires_at` 和服务端当前时间共同判断；查询时可实时计算，也可由定时任务把到期记录落成 `expired`。唯一部分索引保证同一用户在同一等级包下最多只有一条 `active/paused` 订阅。

### 5.3 素材表

```sql
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    asset_type TEXT NOT NULL, -- image / audio / pdf / docx / answer_key
    storage_key TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    duration_ms INTEGER,
    width INTEGER,
    height INTEGER,
    checksum TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE paper_assets (
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    usage TEXT NOT NULL, -- full_listening_audio / source_pdf / answer_key
    display_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (paper_id, asset_id, usage)
);

CREATE TABLE material_assets (
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    usage TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    start_ms INTEGER,
    end_ms INTEGER,
    play_limit INTEGER,
    PRIMARY KEY (material_id, asset_id, usage)
);
```

音频可以有两种导入形态：

1. 整卷音频：挂 `paper_assets`，用于完整模拟听力。
2. 片段音频：挂 `material_assets`，带 `start_ms`、`end_ms` 和播放次数，用于逐题练习、错题重听。

`play_limit` 必须按卷配置，不能硬编码到等级。导卷时可按官方说明填写。

### 5.4 作答与结果

```sql
CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id),
    bank_id TEXT NOT NULL REFERENCES question_banks(id),
    mode TEXT NOT NULL DEFAULT 'exam', -- exam / practice / section
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress / submitted / graded
    started_at TEXT NOT NULL,
    submitted_at TEXT,
    duration_used_seconds INTEGER NOT NULL DEFAULT 0,
    total_score REAL NOT NULL DEFAULT 0,
    objective_score REAL NOT NULL DEFAULT 0,
    subjective_score REAL NOT NULL DEFAULT 0,
    manual_score REAL,
    UNIQUE (user_id, paper_id, started_at)
);

CREATE TABLE attempt_answers (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    paper_question_id TEXT NOT NULL REFERENCES paper_questions(id),
    answer_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, paper_question_id)
);

CREATE TABLE attempt_section_states (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES paper_sections(id),
    status TEXT NOT NULL DEFAULT 'pending', -- pending / active / closed
    started_at TEXT,
    ended_at TEXT,
    remaining_seconds INTEGER,
    PRIMARY KEY (attempt_id, section_id)
);

CREATE TABLE attempt_question_results (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    paper_question_id TEXT NOT NULL REFERENCES paper_questions(id),
    question_version_id TEXT NOT NULL REFERENCES question_versions(id),
    question_type TEXT NOT NULL,
    answer_json TEXT,
    judge_status TEXT NOT NULL DEFAULT 'auto', -- auto / manual_pending / ai_pending / accepted
    is_correct INTEGER NOT NULL DEFAULT 0,
    raw_score REAL NOT NULL DEFAULT 0,
    final_score REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (attempt_id, paper_question_id)
);

CREATE TABLE essay_reviews (
    attempt_question_result_id TEXT PRIMARY KEY REFERENCES attempt_question_results(id) ON DELETE CASCADE,
    review_mode TEXT NOT NULL, -- manual / ai / hybrid
    reviewer_type TEXT NOT NULL, -- admin / ai
    reviewer_id TEXT,
    score REAL,
    review_comment TEXT,
    rubric_scores_json TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attempt_audio_events (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id),
    material_id TEXT REFERENCES materials(id),
    event_type TEXT NOT NULL, -- play / pause / ended
    played_at TEXT NOT NULL,
    position_ms INTEGER NOT NULL DEFAULT 0
);
```

### 5.5 答案契约

前端提交统一为 `Record<paperQuestionId, AnswerValue>`：

```ts
export type AnswerValue =
  | { type: 'choice'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'order'; value: string[] }
  | { type: 'word_order'; value: string[] }
  | { type: 'fill'; value: string }
  | { type: 'text'; value: string }
  | { type: 'essay'; value: string };
```

示例：

```json
{
  "answers": {
    "pq-001": { "type": "choice", "value": "B" },
    "pq-016": { "type": "choice", "value": "D" },
    "pq-071": { "type": "fill", "value": "C" },
    "pq-101": { "type": "essay", "value": "远古时期..." }
  }
}
```

## 6. 题型 Payload

### 6.1 单选题

```json
{
  "question_type": "single_choice",
  "payload": {
    "options": [
      { "key": "A", "text": "去超市" },
      { "key": "B", "text": "去爬山" },
      { "key": "C", "text": "买衣服" },
      { "key": "D", "text": "在看书" }
    ]
  },
  "answer": {
    "value": "B"
  }
}
```

### 6.2 判断题

```json
{
  "question_type": "true_false",
  "payload": {
    "display_text": "明天天气很好。",
    "true_label": "对",
    "false_label": "错"
  },
  "answer": {
    "value": true
  }
}
```

### 6.3 排序题

```json
{
  "question_type": "sorting",
  "payload": {
    "items": [
      { "key": "A", "text": "所以，平时要多运动。" },
      { "key": "B", "text": "健康是每个人最宝贵的财富，" },
      { "key": "C", "text": "只有身体好，才能把工作做好，" }
    ]
  },
  "answer": {
    "value": ["B", "C", "A"]
  }
}
```

### 6.4 连词成句

```json
{
  "question_type": "word_reorder",
  "payload": {
    "words": ["很漂亮", "那个", "小女孩", "长得"],
    "punctuation": "。"
  },
  "answer": {
    "accepted_orders": [
      ["那个", "小女孩", "长得", "很漂亮"]
    ]
  }
}
```

判分时按配置决定是否自动补句尾标点、是否忽略多余空格。

### 6.5 填空题

HSK 6 的 71-75 题应建为一个 `option_set` 组，A-E 共享，每个空是独立题目：

```json
{
  "group_type": "option_set",
  "payload": {
    "options": [
      { "key": "A", "text": "反映了当时的科技水平" },
      { "key": "B", "text": "为后人的神话创作提供了丰富的素材" },
      { "key": "C", "text": "以及大量的神话传说" },
      { "key": "D", "text": "它大约成书于汉代初年" },
      { "key": "E", "text": "在古代文化、科技和交通都不发达的情况下" }
    ]
  }
}
```

每个子题：

```json
{
  "question_type": "drag_fill",
  "payload": {
    "blank_id": "71",
    "context": "《山海经》是一部记载中国古代民间传说和地理知识等方面的著作。"
  },
  "answer": {
    "value": "D"
  }
}
```

### 6.6 文本填空

```json
{
  "question_type": "text_fill",
  "payload": {
    "prefix": "我想喝一",
    "suffix": "温水。",
    "pinyin_hint": "bēi"
  },
  "answer": {
    "accepted_values": ["杯"]
  }
}
```

### 6.7 写作题

```json
{
  "question_type": "essay",
  "payload": {
    "task_type": "summary",
    "reading_minutes": 10,
    "writing_minutes": 35,
    "target_length": 400,
    "material_id": "mat-h61438-writing",
    "rules": ["只需复述文章内容", "不加入自己的观点", "标题自拟"]
  },
  "answer": {
    "reference_essay": "...",
    "rubrics": [
      { "criterion": "内容覆盖", "weight": 0.4 },
      { "criterion": "语言准确", "weight": 0.3 },
      { "criterion": "结构连贯", "weight": 0.3 }
    ]
  }
}
```

## 7. API 设计

### 7.1 用户端

```http
GET    /api/locales
PATCH  /api/me/preferences
GET    /api/subscriptions/me
GET    /api/banks
GET    /api/banks/:bankId/papers
GET    /api/papers/:paperId
POST   /api/papers/:paperId/attempts
GET    /api/attempts/:attemptId
PATCH  /api/attempts/:attemptId/answers
POST   /api/attempts/:attemptId/submit
GET    /api/attempts/:attemptId/report
POST   /api/attempts/:attemptId/audio-events
GET    /api/attempts/:attemptId/assets/:assetId
GET    /api/wrong-questions
```

### 7.2 管理端

```http
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:userId

GET    /api/admin/subscriptions
POST   /api/admin/subscriptions
PATCH  /api/admin/subscriptions/:subscriptionId

POST   /api/admin/imports
POST   /api/admin/imports/:importId/parse
PATCH  /api/admin/imports/:importId
POST   /api/admin/imports/:importId/publish

GET    /api/admin/papers
POST   /api/admin/papers
PATCH  /api/admin/papers/:paperId

GET    /api/admin/question-groups
POST   /api/admin/question-groups
PATCH  /api/admin/question-groups/:groupId

GET    /api/admin/questions
POST   /api/admin/questions
PATCH  /api/admin/questions/:questionId

GET    /api/admin/reviews/essays
PATCH  /api/admin/reviews/essays/:resultId
```

### 7.3 关键响应

`GET /api/locales` 返回可用界面语言：

```json
{
  "locales": [
    {
      "id": "en-US",
      "language_name": "English",
      "endonym": "English",
      "direction": "ltr",
      "is_default": false
    },
    {
      "id": "zh-CN",
      "language_name": "Chinese (Mandarin, Simplified)",
      "endonym": "中文（简体）",
      "direction": "ltr",
      "is_default": true
    }
  ]
}
```

`PATCH /api/me/preferences` 请求体：

```json
{
  "ui_locale": "ar"
}
```

`GET /api/subscriptions/me` 返回用户当前可用等级包：

```json
{
  "subscriptions": [
    {
      "bank_id": "hsk-level-6",
      "level": 6,
      "name": "HSK 六级真题包",
      "status": "active",
      "starts_at": "2026-09-01T00:00:00+08:00",
      "expires_at": "2027-09-01T00:00:00+08:00"
    }
  ]
}
```

`GET /api/papers/:paperId` 返回公开作答数据，不返回 `answer_json`：

```json
{
  "paper": {
    "id": "paper-h61438",
    "level": 6,
    "duration_seconds": 8400,
    "sections": [
      {
        "code": "listening",
        "title": "听力",
        "duration_seconds": 2100,
        "groups": [
          {
            "id": "group-h61438-l1",
            "type": "material",
            "material": {
              "audio": {
                "asset_id": "asset-h61438-audio",
                "play_limit": 1
              }
            },
            "questions": []
          }
        ]
      }
    ]
  }
}
```

答案校验、判分和分数计算全部在服务端完成；前端只负责展示和交互。

## 8. 判卷设计

### 8.1 判分器注册表

```ts
type Grader = (
  question: QuestionVersion,
  answer: AnswerValue | null,
  context: GradingContext
) => GradingResult;

const graders: Record<HskQuestionType, Grader> = {
  single_choice: exactChoiceGrader,
  true_false: exactBooleanGrader,
  sorting: exactOrderGrader,
  word_reorder: normalizedWordOrderGrader,
  drag_fill: exactChoiceGrader,
  text_fill: acceptedTextGrader,
  essay: subjectiveGrader
};
```

### 8.2 状态流

```text
提交 attempt
  -> 读取 question_version + answer_json
  -> objective题型立即判分
  -> essay 写入 manual_pending 或 ai_pending
  -> 事务内保存 attempt_question_results
  -> 生成总分与分部得分
  -> 未答/错误客观题进入 wrong_questions
```

### 8.3 判分规则

| 题型 | 规则 |
|---|---|
| `single_choice`、`drag_fill` | 选项 key 完全一致 |
| `true_false` | 布尔值一致 |
| `sorting` | 数组顺序完全一致 |
| `word_reorder` | 归一化后与任一 accepted order 一致 |
| `text_fill` | 归一化后命中 accepted_values |
| `essay` | 人工或 AI 评分，保留评分理由 |

文本归一化默认只去除首尾空格和全角/半角空格；标点、大小写和异体字策略必须写入题目配置，避免全局规则造成误判。

## 9. 音频设计

1. 素材导入时用 `ffmpeg` 统一转码为浏览器友好的 MP3/AAC，保留原始 WMA 文件作为 `source_file`。
2. 听力页使用固定音频控制器，页面滚动时保持在顶部/侧边。
3. 播放次数由服务端记录 `attempt_audio_events`，前端按钮只做即时禁用反馈。
4. 支持整卷连续播放与片段播放：
   - 考试模式默认整卷音频。
   - 练习/错题模式按 material 播放片段。
5. 听力分部结束后自动进入阅读分部；也可按试卷配置显示“填写答题卡”停留页。

MVP 使用本地文件和 HTTP Range；公网部署后替换为 OSS/COS + 签名 URL 或 HLS。

## 10. 前端交互

### 10.1 页面

| 页面 | 路由 | 说明 |
|---|---|---|
| 语言设置 | `/:locale/settings/language` | 十语言选择、回退语言、预览 |
| 我的订阅 | `/subscriptions` | 等级包状态、有效期、续期入口 |
| 题库列表 | `/banks` | 只展示已订阅 HSK 等级真题包 |
| 试卷列表 | `/banks/:bankId/papers` | 真题/模拟卷 |
| 答题页 | `/papers/:paperId/exam` | 分部流、答题卡、音频、倒计时 |
| 报告页 | `/attempts/:attemptId/report` | 分数、逐题、解析 |
| 练习记录 | `/records` | 历史成绩 |
| 错题本 | `/wrong-questions` | 按等级、分部、题型筛选 |
| 知识点 | `/knowledge` | 词汇、语法、题型技巧 |

上表路由均挂在 `/:locale` 前缀下，例如 `/zh-CN/banks`、`/ar/banks`；文档中的省略写法仅用于表达业务路径。TopBar 常驻语言选择器，切换后立即更新 `dir`、字体、文案和本地化格式，并写入用户偏好。

### 10.2 答题页结构

```text
+----------------------------------------------------------+
| 试卷信息 | 倒计时 | 分部切换 | 提交按钮                  |
+---------------------------+------------------------------+
| 答题卡/题号导航            | 音频控制器                    |
| 按分部与题型分组           | 材料/文章/图片面板            |
| 未答、已答、标记状态        | 题目渲染器                    |
|                           | 上一题/下一题                 |
+---------------------------+------------------------------+
```

### 10.3 渲染器注册

```ts
const renderers: Record<HskQuestionType, ComponentType<QuestionProps>> = {
  single_choice: SingleChoice,
  true_false: TrueFalse,
  sorting: Sorting,
  word_reorder: WordReorder,
  drag_fill: DragFill,
  text_fill: TextFill,
  essay: Essay
};
```

移动端优先使用上移/下移、点选词块、点选空位等无拖拽替代操作，保证触屏可用。

### 10.4 多语言验收

1. 十个 locale 的核心页面均无缺失 key、无硬编码中文/英文。
2. `ar`、`ur` 页面在桌面和移动端通过 RTL 截图检查，导航、表格、抽屉、答题卡、音频进度条方向正确。
3. Hindi、Bengali、Arabic、Urdu 字体渲染无豆腐块、无截断、无基线错位。
4. 长译文在按钮、标签、导航、答题卡中可换行或省略，不遮挡内容、不撑破布局。
5. 倒计时、分数、百分比、日期随 locale 正确格式化。
6. 切换语言后刷新页面、重新登录、跨设备登录仍保持用户偏好。
7. 服务端错误码在所有语言下有本地化文案；未知错误回退 English。
8. 考试题干、选项、答案、听力脚本在任何界面语言下保持中文原文。

## 11. 导入管线

### 11.1 输入

```text
docs/<paper_code>/
├── Test.pdf 或 听力 阅读.pdf / 书写.pdf
├── Listening.mp3 / paper.wma
└── Answers.pdf / 答案.docx
```

### 11.2 流程

```text
创建 import job
  -> 解析试卷元信息与分部
  -> 提取题目文本、图片、选项
  -> 提取答案 key
  -> 音频转码并生成素材
  -> 生成结构化 JSON
  -> Zod schema 校验
  -> 人工校对
  -> 审核发布
```

校验规则：

1. 分部题量与官方结构一致；如不一致，需要导入配置显式声明偏差。
2. 每个可判分项必须有 `question_type`、`payload`、`answer`、`score`。
3. 组题的子题数量、空位数量、选项 key 必须能对上。
4. 客观题答案 key 必须存在于选项池。
5. 音频路径必须存在，转码后记录 checksum。
6. 答案和解析发布前必须通过完整性检查。

扫描版 PDF 不做全自动导入；先进入 OCR/人工录入队列，避免错误题干污染题库。

## 12. 安全与权限

1. 用户只能访问 `active` 订阅对应的 HSK 等级真题包。
2. 订阅校验必须落在服务端 repository/service 层，前端隐藏入口只做体验优化。
3. 管理端接口必须具备管理员权限。
4. 答题前接口不返回 `answer_json` 和解析。
5. 倒计时、提交时间、播放次数以服务端记录为准。
6. 素材访问必须校验 attempt、paper、bank subscription 和用户身份。
7. 历史报告锁定 `question_version_id`，题目后续修订不影响已提交记录。
8. 所有 JSON payload 使用 Zod 校验，拒绝未知结构。
9. 订阅开通、暂停、恢复、撤销、续期必须写审计日志。
10. URL 和用户资料中的 locale 必须校验存在于 `supported_locales`，未知值回退 `zh-CN`。
11. 服务端不得根据界面语言改变题目内容、答案、判分规则或订阅权限。

## 13. MVP 实施

### 13.1 第一阶段：平台骨架

1. 复制参考项目 workspace、Vite、Express、SQLite、认证和权限结构。
2. 建立 HSK schema 与 seed，包含 6 个等级真题包和 `bank_subscriptions`。
3. 实现用户、订阅、bank/paper/attempt 基础 API。
4. 管理端支持创建用户、按等级开通/暂停/续期订阅。
5. 建立 `supported_locales`、locale 路由、i18next 加载和 `zh-CN`/`en-US` 完整文案。

### 13.2 第二阶段：客观题作答

1. 实现 `single_choice`、`true_false`、`drag_fill`、`text_fill`。
2. 实现自动保存、提交、报告、错题。
3. 用 H61438 听力/阅读样卷做导入样例。

### 13.3 第三阶段：听力与组题

1. 实现整卷音频、片段音频、播放次数。
2. 实现材料组、A-E 选句填空、文章阅读组题。
3. 实现分部计时与听力结束自动切换。

### 13.4 第四阶段：书写与运营

1. 实现 `word_reorder`、`sorting`、`essay`。
2. 写作题进入人工待批改队列，可选接入 AI 初评。
3. 完成导入校验、审核发布和错题重练。
4. 补齐其余八个界面语言并通过十语言 UI、RTL 和字体验收。

## 14. 待确认问题

1. 真题内容的使用授权和公开范围。
2. 机考模拟是否需要严格锁分部，练习模式是否允许自由跳题和重复听音。
3. 写作题 MVP 采用纯人工批改还是 AI 初评 + 人工复核。
4. HSK 5/6 的听力播放次数需按具体试卷官方说明核对，导入时配置到素材上。
5. 文本判分是否需要支持用户自定义异体字、同义字映射。
6. 订阅到期后进行中的试卷是否允许宽限期内继续作答。
7. 支付订单、续期提醒和组合套餐在 V1 之前是否需要落地。
8. “前十语言”的统计口径需产品确认：默认采用总使用人数（L1+L2）宏语言口径；如改用母语人口或 Ethnologue individual language 口径，需调整语言清单。
9. 非中英文案采用人工翻译、机器翻译加人工审校，还是分批上线。
