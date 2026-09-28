export interface QuestionBank {
    id: string;
    code: string;
    level: number;
    name: string;
    status: string;
    created_at: string;
}

export interface PastExamPaper {
    id: string;
    bank_id: string;
    paper_type: string;
    year: number | null;
    session: string | null;
    title: string;
    duration_seconds: number;
    total_score: number;
    passing_score: number;
    status: string;
}

export interface PaperSection {
    id: string;
    paper_id: string;
    code: string;
    title: string;
    display_order: number;
    duration_seconds: number | null;
    answer_transfer_seconds: number;
    scaled_score: number | null;
}

export interface BankSubscription {
    id: string;
    user_id: string;
    bank_id: string;
    status: string;
    starts_at: string;
    expires_at: string | null;
    source: string;
    order_id: string | null;
    operator_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

export interface SupportedLocale {
    id: string;
    language_name: string;
    endonym: string;
    direction: string;
    display_order: number;
    is_default: number;
    fallback_locale_id: string | null;
    status: string;
}

export interface UserRecord {
    id: string;
    username: string;
    email: string | null;
    display_name: string;
    password_hash: string | null;
    password_salt: string | null;
    is_admin: number;
    status: string;
    expires_at: string;
    ui_locale: string;
    last_login_at: string | null;
}

export interface SessionUserRecord extends UserRecord {
    session_id: string;
    session_expires_at: string;
    session_revoked_at: string | null;
}

export interface ClientUser {
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    isAdmin: boolean;
    expiresAt: string;
    uiLocale: string;
}

export interface PaperQuestion {
    id: string;
    display_order: number;
    score: number;
    question_id: string;
    question_version_id: string;
    question_type: string;
    stem: string | null;
    difficulty: number;
    payload_json: string;
    explanation: string | null;
    question_group_version_id: string | null;
}

export interface QuestionGroupVersion {
    id: string;
    question_group_id: string;
    group_type: string;
    instruction: string | null;
    material_id: string | null;
    payload_json: string;
}

export interface WrongQuestion {
    id: string;
    user_id: string;
    attempt_question_result_id: string;
    bank_id: string;
    section_id: string | null;
    question_type: string;
    created_at: string;
}
