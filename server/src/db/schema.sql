-- ============================================================
-- HSK Online Exam Platform — Core Schema
-- Design: docs/design/hsk-online-exam-platform-design.md (v1.2)
-- ============================================================

-- Tracks one-time data migrations for databases created before a feature shipped.
CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Question Banks (HSK levels) ----------
CREATE TABLE IF NOT EXISTS question_banks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Supported Locales ----------
CREATE TABLE IF NOT EXISTS supported_locales (
    id TEXT PRIMARY KEY,                       -- BCP-47 e.g. en-US, zh-CN, ar
    language_name TEXT NOT NULL,
    endonym TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('ltr', 'rtl')),
    display_order INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    fallback_locale_id TEXT REFERENCES supported_locales(id),
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',     -- active / disabled
    expires_at TEXT NOT NULL DEFAULT '2099-12-31',
    ui_locale TEXT NOT NULL DEFAULT 'zh-CN' REFERENCES supported_locales(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ---------- Bank Subscriptions ----------
CREATE TABLE IF NOT EXISTS bank_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',     -- active / paused / expired / canceled
    starts_at TEXT NOT NULL,
    expires_at TEXT,
    source TEXT NOT NULL DEFAULT 'manual',     -- manual / order / import
    order_id TEXT,
    operator_id TEXT REFERENCES users(id),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_subscriptions_current
    ON bank_subscriptions(user_id, bank_id)
    WHERE status IN ('active', 'paused');

-- ---------- Admin Operation Logs ----------
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,                     -- create / update / pause / resume / cancel / renew / publish
    object_type TEXT NOT NULL,                 -- user / subscription / paper / question / asset
    object_id TEXT NOT NULL,
    before_state_json TEXT,
    after_state_json TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_object
    ON admin_operation_logs(object_type, object_id, created_at);

-- ---------- Past Exam Papers ----------
CREATE TABLE IF NOT EXISTS past_exam_papers (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    paper_type TEXT NOT NULL DEFAULT 'past',   -- past / mock
    year INTEGER,
    session TEXT,
    title TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    total_score REAL NOT NULL,
    passing_score REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    UNIQUE (bank_id, paper_type, year, session)
);

-- ---------- Paper Sections ----------
CREATE TABLE IF NOT EXISTS paper_sections (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                       -- listening / reading / writing
    title TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    duration_seconds INTEGER,
    answer_transfer_seconds INTEGER DEFAULT 0,
    scaled_score REAL,
    UNIQUE (paper_id, display_order),
    UNIQUE (paper_id, code)
);

-- ---------- Materials ----------
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    material_type TEXT NOT NULL,              -- audio / text / image_group / mixed
    title TEXT,
    text_content TEXT,
    transcript TEXT,
    payload_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
);

-- ---------- Question Groups ----------
CREATE TABLE IF NOT EXISTS question_groups (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    group_type TEXT NOT NULL,                 -- material / option_set / word_pool
    status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS question_group_versions (
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

-- ---------- Questions ----------
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    question_group_id TEXT REFERENCES question_groups(id),
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question_versions (
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

-- ---------- Paper Questions ----------
CREATE TABLE IF NOT EXISTS paper_questions (
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

-- ---------- Assets ----------
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    asset_type TEXT NOT NULL,                 -- image / audio / pdf / docx / answer_key
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

CREATE TABLE IF NOT EXISTS paper_assets (
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    usage TEXT NOT NULL,                      -- full_listening_audio / source_pdf / answer_key
    display_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (paper_id, asset_id, usage)
);

CREATE TABLE IF NOT EXISTS material_assets (
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    usage TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    start_ms INTEGER,
    end_ms INTEGER,
    play_limit INTEGER,
    PRIMARY KEY (material_id, asset_id, usage)
);

-- ---------- Attempts ----------
CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    paper_id TEXT NOT NULL REFERENCES past_exam_papers(id),
    bank_id TEXT NOT NULL REFERENCES question_banks(id),
    mode TEXT NOT NULL DEFAULT 'exam',        -- exam / practice / section
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

CREATE TABLE IF NOT EXISTS attempt_answers (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    paper_question_id TEXT NOT NULL REFERENCES paper_questions(id),
    answer_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, paper_question_id)
);

CREATE TABLE IF NOT EXISTS attempt_section_states (
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES paper_sections(id),
    status TEXT NOT NULL DEFAULT 'pending',   -- pending / active / closed
    started_at TEXT,
    ended_at TEXT,
    remaining_seconds INTEGER,
    PRIMARY KEY (attempt_id, section_id)
);

CREATE TABLE IF NOT EXISTS attempt_question_results (
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

-- ---------- Essay Reviews ----------
CREATE TABLE IF NOT EXISTS essay_reviews (
    attempt_question_result_id TEXT PRIMARY KEY REFERENCES attempt_question_results(id) ON DELETE CASCADE,
    review_mode TEXT NOT NULL,                 -- manual / ai / hybrid
    reviewer_type TEXT NOT NULL,               -- admin / ai
    reviewer_id TEXT,
    score REAL,
    review_comment TEXT,
    rubric_scores_json TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Attempt Audio Events ----------
CREATE TABLE IF NOT EXISTS attempt_audio_events (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id),
    material_id TEXT REFERENCES materials(id),
    event_type TEXT NOT NULL,                 -- play / pause / ended
    played_at TEXT NOT NULL,
    position_ms INTEGER NOT NULL DEFAULT 0
);

-- ---------- Wrong Questions ----------
CREATE TABLE IF NOT EXISTS wrong_questions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_question_result_id TEXT NOT NULL REFERENCES attempt_question_results(id) ON DELETE CASCADE,
    bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    section_id TEXT REFERENCES paper_sections(id),
    question_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, attempt_question_result_id)
);

CREATE INDEX IF NOT EXISTS idx_wrong_questions_user
    ON wrong_questions(user_id, bank_id);

-- ---------- Import Jobs ----------
CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    paper_id TEXT REFERENCES past_exam_papers(id),
    bank_id TEXT NOT NULL REFERENCES question_banks(id),
    status TEXT NOT NULL DEFAULT 'pending',   -- pending / parsing / parsed / validated / reviewing / published / failed
    source_dir TEXT,
    parsed_json TEXT,
    validation_errors_json TEXT,
    operator_id TEXT REFERENCES users(id),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status
    ON import_jobs(status, created_at);

-- ---------- Knowledge Base (G-005) ----------
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id TEXT PRIMARY KEY,
    bank_id TEXT REFERENCES question_banks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES knowledge_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Feedback (G-006) ----------
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,               -- bug / suggestion / question_error / other
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    paper_question_id TEXT REFERENCES paper_questions(id),
    status TEXT NOT NULL DEFAULT 'open', -- open / replied / resolved / closed
    admin_reply TEXT,
    replied_by TEXT REFERENCES users(id),
    replied_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_user
    ON feedback(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_status
    ON feedback(status, created_at);



-- ---------- User Sessions ----------
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
    ON user_sessions(user_id, revoked_at);

-- ---------- Orders (user self-service subscription purchase) ----------
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL,                  -- full / single
    total_price REAL NOT NULL,
    bank_ids_json TEXT NOT NULL,               -- JSON array of bank IDs
    status TEXT NOT NULL DEFAULT 'completed',  -- pending / completed / failed / refunded
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user
    ON orders(user_id, created_at);
