-- ============================================================
-- HSK Online Exam Platform — Initial Seed Data
-- ============================================================

-- ---------- 10 Supported Locales (total speakers L1+L2 ranking) ----------
INSERT OR IGNORE INTO supported_locales (id, language_name, endonym, direction, display_order, is_default, fallback_locale_id, status) VALUES
    ('en-US', 'English',                  'English',                   'ltr', 1, 0, NULL,    'published'),
    ('zh-CN', 'Chinese (Mandarin, Simpl.)','中文（简体）',              'ltr', 2, 1, NULL,    'published'),
    ('hi-IN', 'Hindi',                    'हिन्दी',                     'ltr', 3, 0, 'en-US', 'published'),
    ('es',    'Spanish',                  'Español',                    'ltr', 4, 0, 'en-US', 'published'),
    ('fr-FR', 'French',                   'Français',                   'ltr', 5, 0, 'en-US', 'published'),
    ('ar',    'Arabic (Modern Standard)', 'العربية',                     'rtl', 6, 0, 'en-US', 'published'),
    ('bn-BD', 'Bengali',                  'বাংলা',                       'ltr', 7, 0, 'en-US', 'published'),
    ('ru-RU', 'Russian',                  'Русский',                    'ltr', 8, 0, 'en-US', 'published'),
    ('pt-BR', 'Portuguese (Brazil)',      'Português',                  'ltr', 9, 0, 'en-US', 'published'),
    ('ur-PK', 'Urdu',                     'اردو',                        'rtl',10, 0, 'en-US', 'published');

-- ---------- 6 HSK Level Question Banks ----------
INSERT OR IGNORE INTO question_banks (id, code, level, name, status) VALUES
    ('hsk-level-1', 'hsk-1', 1, 'HSK 一级真题包', 'published'),
    ('hsk-level-2', 'hsk-2', 2, 'HSK 二级真题包', 'published'),
    ('hsk-level-3', 'hsk-3', 3, 'HSK 三级真题包', 'published'),
    ('hsk-level-4', 'hsk-4', 4, 'HSK 四级真题包', 'published'),
    ('hsk-level-5', 'hsk-5', 5, 'HSK 五级真题包', 'published'),
    ('hsk-level-6', 'hsk-6', 6, 'HSK 六级真题包', 'published');

-- ---------- Default Users (passwords set by connection.ts ensureInitialUser) ----------
INSERT OR IGNORE INTO users (id, username, display_name, is_admin, status, expires_at, ui_locale) VALUES
    ('user-admin',    'admin',    '系统管理员', 1, 'active', '2099-12-31', 'zh-CN'),
    ('user-student',  'student',  '张小程',     0, 'active', '2099-12-31', 'zh-CN');

-- ---------- Sample Subscription for Student (HSK Level 4) ----------
INSERT OR IGNORE INTO bank_subscriptions (id, user_id, bank_id, status, starts_at, expires_at, source, operator_id, note) VALUES
    ('sub-student-hsk4', 'user-student', 'hsk-level-4', 'active',
     '2026-09-01T00:00:00+08:00', '2027-09-01T00:00:00+08:00',
     'manual', 'user-admin', 'MVP seed subscription');

-- ---------- H61438 Sample Paper (draft) ----------
INSERT OR IGNORE INTO past_exam_papers (id, bank_id, paper_type, year, session, title, duration_seconds, total_score, passing_score, status) VALUES
    ('paper-h61438', 'hsk-level-6', 'past', 2024, '61438',
     'HSK 六级真题 H61438', 8400, 300, 180, 'published');

INSERT OR IGNORE INTO paper_sections (id, paper_id, code, title, display_order, duration_seconds, answer_transfer_seconds, scaled_score) VALUES
    ('section-h61438-listening', 'paper-h61438', 'listening', '听力', 1, 2100, 0, 100),
    ('section-h61438-reading',   'paper-h61438', 'reading',   '阅读', 2, 3000, 0, 100),
    ('section-h61438-writing',   'paper-h61438', 'writing',   '书写', 3, 2700, 0, 100);

-- ---------- H61438 Audio Asset ----------
INSERT OR IGNORE INTO assets (id, asset_type, storage_key, url, mime_type, file_size) VALUES
    ('asset-h61438-audio', 'audio', 'docs/61438/H61438.mp3', '/api/attempts/dummy/assets/asset-h61438-audio', 'audio/mpeg', 34058690);

INSERT OR IGNORE INTO paper_assets (paper_id, asset_id, usage, display_order) VALUES
    ('paper-h61438', 'asset-h61438-audio', 'full_listening_audio', 0);

-- ---------- H61438 Questions ----------
-- Question group for listening section
INSERT OR IGNORE INTO question_groups (id, bank_id, group_type, status) VALUES
    ('qg-h61438-l1', 'hsk-level-6', 'material', 'published');

INSERT OR IGNORE INTO question_group_versions (id, question_group_id, version_number, group_type, instruction, payload_json, status, is_current) VALUES
    ('qgv-h61438-l1', 'qg-h61438-l1', 1, 'material', '听录音，选出与内容一致的一项', '{"material_type":"audio"}', 'published', 1);

-- Listening questions (single_choice)
INSERT OR IGNORE INTO questions (id, bank_id, question_group_id, status) VALUES
    ('q-h61438-l1', 'hsk-level-6', 'qg-h61438-l1', 'published'),
    ('q-h61438-l2', 'hsk-level-6', 'qg-h61438-l1', 'published');

INSERT OR IGNORE INTO question_versions (id, question_id, version_number, question_type, stem, difficulty, payload_json, answer_json, status, is_current, is_enabled) VALUES
    ('qv-h61438-l1', 'q-h61438-l1', 1, 'single_choice', '男：今天天气真好，我们去公园走走吧。女：好啊，我也想出去透透气。问：他们打算去哪里？', 2,
     '{"options":[{"key":"A","text":"去超市"},{"key":"B","text":"去公园"},{"key":"C","text":"去图书馆"},{"key":"D","text":"去学校"}]}',
     '{"value":"B"}', 'published', 1, 1),
    ('qv-h61438-l2', 'q-h61438-l2', 1, 'single_choice', '女：你觉得这部电影怎么样？男：比我想象的好多了，特别是音乐很动人。问：男的觉得电影怎么样？', 3,
     '{"options":[{"key":"A","text":"很差"},{"key":"B","text":"一般"},{"key":"C","text":"比想象的好"},{"key":"D","text":"无聊"}]}',
     '{"value":"C"}', 'published', 1, 1);

-- Reading questions (single_choice - 病句选择)
INSERT OR IGNORE INTO questions (id, bank_id, status) VALUES
    ('q-h61438-r1', 'hsk-level-6', 'published'),
    ('q-h61438-r2', 'hsk-level-6', 'published');

INSERT OR IGNORE INTO question_versions (id, question_id, version_number, question_type, stem, difficulty, payload_json, answer_json, status, is_current, is_enabled) VALUES
    ('qv-h61438-r1', 'q-h61438-r1', 1, 'single_choice', '选出有语病的一项。', 3,
     '{"options":[{"key":"A","text":"经过这次旅行，我对中国文化有了更深的了解。"},{"key":"B","text":"由于天气原因，航班被取消了。"},{"key":"C","text":"尽管他很努力，但是成绩一直提高不了。"},{"key":"D","text":"我昨天去了北京旅游，觉得很高兴了。"}]}',
     '{"value":"D"}', 'published', 1, 1),
    ('qv-h61438-r2', 'q-h61438-r2', 1, 'single_choice', '选出有语病的一项。', 3,
     '{"options":[{"key":"A","text":"这个问题我已经想了很久。"},{"key":"B","text":"他昨天买了一件很新的衣服。"},{"key":"C","text":"我们明天去看电影吧。"},{"key":"D","text":"这本书我已经看完了。"}]}',
     '{"value":"B"}', 'published', 1, 1);

-- Writing question (essay - 缩写)
INSERT OR IGNORE INTO questions (id, bank_id, status) VALUES
    ('q-h61438-w1', 'hsk-level-6', 'published');

INSERT OR IGNORE INTO question_versions (id, question_id, version_number, question_type, stem, difficulty, payload_json, answer_json, status, is_current, is_enabled) VALUES
    ('qv-h61438-w1', 'q-h61438-w1', 1, 'essay', '读材料后缩写 400 字左右。', 5,
     '{"task_type":"summary","reading_minutes":10,"writing_minutes":35,"target_length":400,"rules":["只需复述文章内容","不加入自己的观点","标题自拟"]}',
     '{"reference_essay":"...","rubrics":[{"criterion":"content","weight":0.4},{"criterion":"accuracy","weight":0.3},{"criterion":"coherence","weight":0.3}]}',
     'published', 1, 1);

-- Paper questions (link questions to paper sections)
INSERT OR IGNORE INTO paper_questions (id, paper_id, section_id, question_id, question_version_id, question_group_version_id, display_order, score) VALUES
    ('pq-h61438-l1', 'paper-h61438', 'section-h61438-listening', 'q-h61438-l1', 'qv-h61438-l1', 'qgv-h61438-l1', 1, 6),
    ('pq-h61438-l2', 'paper-h61438', 'section-h61438-listening', 'q-h61438-l2', 'qv-h61438-l2', 'qgv-h61438-l1', 2, 6),
    ('pq-h61438-r1', 'paper-h61438', 'section-h61438-reading', 'q-h61438-r1', 'qv-h61438-r1', NULL, 51, 6),
    ('pq-h61438-r2', 'paper-h61438', 'section-h61438-reading', 'q-h61438-r2', 'qv-h61438-r2', NULL, 52, 6),
    ('pq-h61438-w1', 'paper-h61438', 'section-h61438-writing', 'q-h61438-w1', 'qv-h61438-w1', NULL, 101, 100);

-- ---------- Student subscription for HSK Level 6 ----------
INSERT OR IGNORE INTO bank_subscriptions (id, user_id, bank_id, status, starts_at, expires_at, source, operator_id, note) VALUES
    ('sub-student-hsk6', 'user-student', 'hsk-level-6', 'active',
     '2026-09-01T00:00:00+08:00', '2027-09-01T00:00:00+08:00',
     'manual', 'user-admin', 'MVP seed subscription for HSK 6');

-- ---------- Admin Operation Log: Seed Subscription ----------
INSERT OR IGNORE INTO admin_operation_logs (id, operator_id, action, object_type, object_id, after_state_json) VALUES
    ('log-seed-sub-1', 'user-admin', 'create', 'subscription', 'sub-student-hsk4',
     '{"status":"active","bank_id":"hsk-level-4","user_id":"user-student","note":"Seed subscription for MVP"}');

-- ---------- Knowledge Base (G-005, HSK 3.0 official outline) ----------
INSERT OR IGNORE INTO knowledge_categories (id, bank_id, name, description, display_order, status) VALUES
    ('kc-hsk3-overview', NULL, 'HSK 3.0 总览', '新版 HSK 等级体系与大纲组成', 1, 'published'),
    ('kc-hsk1-outline', 'hsk-level-1', 'HSK 一级', '一级考试结构、话题、词汇与语法', 2, 'published'),
    ('kc-hsk2-outline', 'hsk-level-2', 'HSK 二级', '二级考试结构、话题、词汇与语法', 3, 'published'),
    ('kc-hsk3-outline', 'hsk-level-3', 'HSK 三级', '三级考试结构、话题、词汇与语法', 4, 'published'),
    ('kc-hsk4-outline', 'hsk-level-4', 'HSK 四级', '四级考试结构、话题、词汇与语法', 5, 'published'),
    ('kc-hsk5-outline', 'hsk-level-5', 'HSK 五级', '五级考试结构、话题、词汇与语法', 6, 'published'),
    ('kc-hsk6-outline', 'hsk-level-6', 'HSK 六级', '六级考试结构、话题、词汇与语法', 7, 'published');

INSERT OR IGNORE INTO knowledge_documents (id, category_id, title, content, tags, display_order, status) VALUES
    ('kd-hsk3-overview', 'kc-hsk3-overview', 'HSK 3.0 官方总览',
     replace('# HSK 3.0 官方总览\n\n- 新版 HSK 采用“三阶段、九等级”体系。\n- 官方大纲包含五个部分：任务、话题、词汇、汉字、语法。\n- 1-6 级累计词汇量：300、500、1000、2000、3600、5400。\n- 本平台当前覆盖 HSK 1-6 级。\n- 官方来源：中文考试服务网。', '\n', char(10)),
     'HSK,官方,大纲', 1, 'published'),

    ('kd-hsk1-structure', 'kc-hsk1-outline', 'HSK 一级考试结构',
     replace('# HSK 一级考试结构\n\n- 总题量：40 题\n- 听力：20 题，约 15 分钟\n- 阅读：20 题，17 分钟\n- 考试总时长：约 40 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就生活场景进行简单交流。', '\n', char(10)),
     'HSK1,考试结构', 1, 'published'),
    ('kd-hsk1-outline', 'kc-hsk1-outline', 'HSK 一级大纲要点',
     replace('# HSK 一级大纲要点\n\n- 话题大纲：5 个一级话题、15 个二级话题、30 个三级话题\n- 词汇大纲：累计 300 个词语\n- 语法大纲：词类、短语、句子成分、句型、句类、特殊句型、复句、动作的态、特殊表达法\n- 重点：主谓句与非主谓句；是非问、特指问、正反问', '\n', char(10)),
     'HSK1,大纲,语法', 2, 'published'),

    ('kd-hsk2-structure', 'kc-hsk2-outline', 'HSK 二级考试结构',
     replace('# HSK 二级考试结构\n\n- 总题量：60 题\n- 听力：35 题，约 25 分钟\n- 阅读：25 题，22 分钟\n- 考试总时长：约 55 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就生活、学习、工作场景进行基本交流。', '\n', char(10)),
     'HSK2,考试结构', 1, 'published'),
    ('kd-hsk2-outline', 'kc-hsk2-outline', 'HSK 二级大纲要点',
     replace('# HSK 二级大纲要点\n\n- 话题大纲：5 个一级话题、18 个二级话题、34 个三级话题\n- 词汇大纲：累计 500 个词语\n- 语法大纲：动词重叠、形容词重叠、结果补语、趋向补语、状态补语、比较句、被动句、常用复句\n- 重点：A 比 B + 形容词；虽然……但是……；一边……一边……', '\n', char(10)),
     'HSK2,大纲,语法', 2, 'published'),

    ('kd-hsk3-structure', 'kc-hsk3-outline', 'HSK 三级考试结构',
     replace('# HSK 三级考试结构\n\n- 总题量：80 题\n- 听力：40 题，约 35 分钟\n- 阅读：30 题，30 分钟\n- 书写：10 题，15 分钟\n- 考试总时长：约 90 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就生活、学习、工作场景进行有效交流。', '\n', char(10)),
     'HSK3,考试结构', 1, 'published'),
    ('kd-hsk3-outline', 'kc-hsk3-outline', 'HSK 三级大纲要点',
     replace('# HSK 三级大纲要点\n\n- 话题大纲：6 个一级话题、22 个二级话题、54 个三级话题\n- 词汇大纲：累计 1000 个词语\n- 语法大纲：疑问代词非疑问用法、可能补语、程度补语、把字句、被动句、越来越、一边……一边……\n- 重点：趋向补语的引申用法；A 跟 B 一样；不但……而且……', '\n', char(10)),
     'HSK3,大纲,语法', 2, 'published'),

    ('kd-hsk4-structure', 'kc-hsk4-outline', 'HSK 四级考试结构',
     replace('# HSK 四级考试结构\n\n- 总题量：100 题\n- 听力：45 题，约 30 分钟\n- 阅读：40 题，40 分钟\n- 书写：15 题，25 分钟\n- 考试总时长：约 105 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就生活、学习、工作场景进行完整、连贯交流。', '\n', char(10)),
     'HSK4,考试结构', 1, 'published'),
    ('kd-hsk4-outline', 'kc-hsk4-outline', 'HSK 四级大纲要点',
     replace('# HSK 四级大纲要点\n\n- 话题大纲：7 个一级话题、31 个二级话题、77 个三级话题\n- 词汇大纲：累计 2000 个词语\n- 语法大纲：各类副词与介词扩展、情态补语、可能补语、被动句、把字句、双重否定句、多种复句\n- 重点：不管是……还是……；不仅……而且……；即使……也……', '\n', char(10)),
     'HSK4,大纲,语法', 2, 'published'),

    ('kd-hsk5-structure', 'kc-hsk5-outline', 'HSK 五级考试结构',
     replace('# HSK 五级考试结构\n\n- 总题量：100 题\n- 听力：45 题，约 30 分钟\n- 阅读：45 题，45 分钟\n- 书写：10 题，40 分钟\n- 考试总时长：约 125 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就工作、学业场景进行准确、恰当交流。', '\n', char(10)),
     'HSK5,考试结构', 1, 'published'),
    ('kd-hsk5-outline', 'kc-hsk5-outline', 'HSK 五级大纲要点',
     replace('# HSK 五级大纲要点\n\n- 话题大纲：7 个一级话题、29 个二级话题、72 个三级话题\n- 词汇大纲：累计 3600 个词语\n- 语法大纲：多项状语、趋向补语引申用法、状态补语、把字句、被动句、让步复句、递进复句\n- 重点：越来越……；哪怕……也……；不但没有……反而……', '\n', char(10)),
     'HSK5,大纲,语法', 2, 'published'),

    ('kd-hsk6-structure', 'kc-hsk6-outline', 'HSK 六级考试结构',
     replace('# HSK 六级考试结构\n\n- 总题量：101 题\n- 听力：50 题，约 35 分钟\n- 阅读：50 题，50 分钟\n- 书写：1 题，45 分钟\n- 考试总时长：约 140 分钟（含 5 分钟填写个人信息）\n- 官方能力描述：能用中文就职场、学业、一般专业场景进行丰富、顺畅交流。', '\n', char(10)),
     'HSK6,考试结构', 1, 'published'),
    ('kd-hsk6-outline', 'kc-hsk6-outline', 'HSK 六级大纲要点',
     replace('# HSK 六级大纲要点\n\n- 话题大纲：7 个一级话题、25 个二级话题、68 个三级话题\n- 词汇大纲：累计 5400 个词语\n- 语法大纲：类前缀、类后缀、程度补语、把字句、条件复句、让步复句、目的复句、四字格、话语标记\n- 重点：除非……否则……；就算……也……；以便……', '\n', char(10)),
     'HSK6,大纲,语法', 2, 'published');

-- ---------- Knowledge Base: HSK vocabulary and grammar ----------
INSERT OR IGNORE INTO knowledge_documents (id, category_id, title, content, tags, display_order, status) VALUES
    ('kd-hsk1-vocabulary', 'kc-hsk1-outline', 'HSK 一级核心词汇',
     replace('# HSK 一级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 爱、八、爸爸、吧、白天、百、包子、杯子、本、边\n- 病、不、不客气、不要、菜、茶、唱、超市、车、吃\n- 出租车、穿、打电话、大、大家、大学、大学生、到、的、第\n- 弟弟、店、电话、电脑、电视、电影、电影院、东西、都、读', '\n', char(10)),
     'HSK1,词汇,单词', 3, 'published'),
    ('kd-hsk1-grammar', 'kc-hsk1-outline', 'HSK 一级语法要点',
     replace('# HSK 一级语法要点\n\n- 词类：名词、动词、形容词、代词、数词、量词、副词、介词、连词、助词\n- 基本短语：联合、偏正、动宾、主谓、数量、介宾、方位\n- 句子成分：主语、谓语、宾语、定语、状语、补语\n- 常用句型：主谓句、非主谓句、是非问句、特指问句、正反问句\n- 特殊句型：是字句、有字句、存现句、连动句、双宾语句\n- 动作的态：完成态、变化态、进行态\n- 特殊表达法：钱数、序数、时间', '\n', char(10)),
     'HSK1,语法,句型', 4, 'published'),

    ('kd-hsk2-vocabulary', 'kc-hsk2-outline', 'HSK 二级核心词汇',
     replace('# HSK 二级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 啊、爱好、白色、帮、帮忙、包、本子、比、别、不错\n- 不好意思、长、车站、出、出国、出来、出门、出去、床、词\n- 从小、错、打、打车、打开、但是、得、地、地铁、懂\n- 动、饭馆、飞、高、高中、告诉、个子、公交车、过、过来', '\n', char(10)),
     'HSK2,词汇,单词', 3, 'published'),
    ('kd-hsk2-grammar', 'kc-hsk2-outline', 'HSK 二级语法要点',
     replace('# HSK 二级语法要点\n\n- 动词重叠：AA、A一A、A了A、ABAB\n- 形容词重叠：AA、AABB\n- 补语：结果、趋向、状态、数量\n- 比较句：A比B+形容词；A比B+形容词+数量/程度补语；A有/没有B+形容词\n- 被动句：主语+被+宾语+动词\n- 复句：并列、选择、转折、因果、紧缩\n- 固定格式：还是……吧；要/快要/就要……了；都……了', '\n', char(10)),
     'HSK2,语法,句型', 4, 'published'),

    ('kd-hsk3-vocabulary', 'kc-hsk3-outline', 'HSK 三级核心词汇',
     replace('# HSK 三级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 阿姨、矮、爱人、安静、安全、把、搬、班级、搬家、办\n- 办法、办公室、半天、帮助、饱、报纸、北、北方、被、笔记\n- 比较、笔记本、比如、比赛、必须、变、遍、变成、变化、表演\n- 别的、别人、宾馆、冰激凌、冰箱、病人、不但、不见、不用、不同', '\n', char(10)),
     'HSK3,词汇,单词', 3, 'published'),
    ('kd-hsk3-grammar', 'kc-hsk3-outline', 'HSK 三级语法要点',
     replace('# HSK 三级语法要点\n\n- 疑问代词非疑问用法：任指、不定指\n- 可能补语：动词+得/不+动词/形容词\n- 程度补语：形容词+得很；形容词/动词+极了/坏了\n- 把字句：主语+把+宾语+动词+在/到+处所\n- 被动句：主语+被+宾语+动词\n- 越来越……；一边……一边……\n- 复句：递进、转折、假设、条件、目的', '\n', char(10)),
     'HSK3,语法,句型', 4, 'published'),

    ('kd-hsk4-vocabulary', 'kc-hsk4-outline', 'HSK 四级核心词汇',
     replace('# HSK 四级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 啊、爱情、爱心、安检、安排、按、按时、按照、白酒、办公\n- 办理、办事、保护、保证、抱、报考、报名、抱歉、背、背包\n- 北部、倍、本科、本来、笨、鼻子、笔试、毕业、毕业生、便于\n- 标准、表格、表示、表现、表扬、饼干、并、并且、播放、博士', '\n', char(10)),
     'HSK4,词汇,单词', 3, 'published'),
    ('kd-hsk4-grammar', 'kc-hsk4-outline', 'HSK 四级语法要点',
     replace('# HSK 四级语法要点\n\n- 副词扩展：程度、范围、时间、频率、方式、关联、情态、语气\n- 介词扩展：引出时间/处所、施事/受事、原因、对象、凭借\n- 补语：可能补语、程度补语\n- 把字句：主语+把+宾语+动词+了/动量补语/时量补语\n- 被动句：主语+叫/让+宾语+动词\n- 复句：并列、承接、递进、选择、转折、假设、条件、因果、目的、让步、紧缩\n- 数的表达法：概数、小数、分数、百分数、倍数', '\n', char(10)),
     'HSK4,语法,句型', 4, 'published'),

    ('kd-hsk5-vocabulary', 'kc-hsk5-outline', 'HSK 五级核心词汇',
     replace('# HSK 五级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 哎、哎呀、唉、爱护、安、安全带、安慰、安装、暗、熬夜\n- 把握、白、半夜、傍晚、包裹、包含、包括、包装、薄、宝\n- 保、保安、宝贝、保持、保存、宝贵、保留、保险、保质期、报到\n- 报道、报告、报警、暴雨、抱怨、背、背后、背景、被子、本', '\n', char(10)),
     'HSK5,词汇,单词', 3, 'published'),
    ('kd-hsk5-grammar', 'kc-hsk5-outline', 'HSK 五级语法要点',
     replace('# HSK 五级语法要点\n\n- 多项状语\n- 趋向补语引申用法\n- 状态补语\n- 把字句\n- 被动句\n- 复句：承接、选择、假设、因果、让步、递进\n- 程度补语：形容词/心理动词+得+不得了', '\n', char(10)),
     'HSK5,语法,句型', 4, 'published'),

    ('kd-hsk6-vocabulary', 'kc-hsk6-outline', 'HSK 六级核心词汇',
     replace('# HSK 六级核心词汇\n\n以下为官方大纲词表节选，共 40 个：\n\n- 岸、案例、按摩、暗示、昂贵、白白、白领、摆、摆放、百分点\n- 百货、摆脱、败、拜访、拜年、版、版本、伴随、扮演、榜样\n- 棒球、保管、保健、保暖、保修、保障、爆、爆发、报刊、暴力\n- 暴露、报社、爆炸、悲观、悲剧、悲伤、北极、北美洲、被动、被迫', '\n', char(10)),
     'HSK6,词汇,单词', 3, 'published'),
    ('kd-hsk6-grammar', 'kc-hsk6-outline', 'HSK 六级语法要点',
     replace('# HSK 六级语法要点\n\n- 类前缀、类后缀\n- 程度补语\n- 把字句\n- 条件复句\n- 让步复句\n- 目的复句\n- 四字格\n- 话语标记', '\n', char(10)),
     'HSK6,语法,句型', 4, 'published');

-- ---------- Sample Feedback (G-006) ----------
INSERT OR IGNORE INTO feedback (id, user_id, type, title, content, status) VALUES
    ('fb-seed-1', 'user-student', 'suggestion', '希望增加错题重练功能',
     '错题本里的题目如果能直接重练就更好了，不用手动去找原来的试卷。',
     'open');
