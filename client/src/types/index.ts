/** Shared types — aligned with design doc §4, §5, §6, §7 */

export type HskQuestionType =
  | "single_choice"
  | "true_false"
  | "sorting"
  | "word_reorder"
  | "drag_fill"
  | "text_fill"
  | "essay";

export type QuestionGroupType = "material" | "option_set" | "word_pool";

export type AnswerValue =
  | { type: "choice"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "order"; value: string[] }
  | { type: "word_order"; value: string[] }
  | { type: "fill"; value: string }
  | { type: "text"; value: string }
  | { type: "essay"; value: string };

export type SubscriptionStatus = "active" | "paused" | "expired" | "canceled";
export type PaperType = "past" | "mock";
export type PaperStatus = "draft" | "published";
export type AttemptMode = "exam" | "practice" | "section";
export type AttemptStatus = "in_progress" | "submitted" | "graded";
export type JudgeStatus = "auto" | "manual_pending" | "ai_pending" | "accepted";
export type SectionCode = "listening" | "reading" | "writing";

// ── API response types (design doc §7.3) ──

export interface LocaleInfo {
  id: string;
  languageName: string;
  endonym: string;
  direction: "ltr" | "rtl";
  isDefault: boolean;
}

export interface Subscription {
  bankId: string;
  level: number;
  name: string;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt?: string;
  paperCount: number;
}

export interface SubscriptionPlanBank {
  id: string;
  code: string;
  level: number;
  name: string;
  paperCount: number;
  subscribed: boolean;
}

export interface SubscriptionPlans {
  fullSubscription: { price: number; durationDays: number };
  perBank: { price: number; durationDays: number };
  banks: SubscriptionPlanBank[];
}

export interface PurchaseResult {
  orderId: string;
  orderType: "full" | "single";
  totalPrice: number;
  createdBankIds: string[];
  skippedBankIds: string[];
}

export interface BankInfo {
  id: string;
  code: string;
  level: number;
  name: string;
  status: string;
}

export interface PaperSummary {
  id: string;
  bankId: string;
  paperType: PaperType;
  year?: number;
  session?: string;
  title: string;
  durationSeconds: number;
  totalScore: number;
  passingScore: number;
  status: PaperStatus;
}

// ── Question payload types (design doc §6) ──

export interface QuestionOption {
  key: string;
  text: string;
}

export interface SingleChoicePayload {
  options: QuestionOption[];
}

export interface TrueFalsePayload {
  displayText: string;
  trueLabel: string;
  falseLabel: string;
}

export interface SortingPayload {
  items: QuestionOption[];
}

export interface WordReorderPayload {
  words: string[];
  punctuation: string;
}

export interface DragFillPayload {
  blankId: string;
  context: string;
}

export interface TextFillPayload {
  prefix: string;
  suffix: string;
  pinyinHint?: string;
}

export interface EssayPayload {
  taskType: string;
  readingMinutes?: number;
  writingMinutes?: number;
  targetLength?: number;
  materialId?: string;
  material?: string;
  rules?: string[];
}

export type QuestionPayload =
  | SingleChoicePayload
  | TrueFalsePayload
  | SortingPayload
  | WordReorderPayload
  | DragFillPayload
  | TextFillPayload
  | EssayPayload;

// ── Paper detail (design doc §7.3 GET /api/papers/:paperId) ──

export interface PaperQuestion {
  id: string;
  questionType: HskQuestionType;
  stem?: string;
  payload: QuestionPayload;
  score: number;
  displayOrder: number;
}

export interface MaterialInfo {
  title?: string;
  audio?: {
    assetId: string;
    playLimit: number;
    startMs?: number;
    endMs?: number;
  };
  textContent?: string;
  transcript?: string;
}

export interface QuestionGroupPart {
  partNumber: number;
  instruction: string;
  questionNumbers: number[];
}

export interface QuestionGroupPayload {
  partNumber?: number;
  parts?: QuestionGroupPart[];
  [key: string]: unknown;
}

export interface QuestionGroupInfo {
  id: string;
  type: QuestionGroupType;
  instruction?: string;
  material?: MaterialInfo;
  payload?: QuestionGroupPayload;
  questions: PaperQuestion[];
}

export interface PaperSection {
  id: string;
  code: SectionCode;
  title: string;
  durationSeconds?: number;
  groups: QuestionGroupInfo[];
}

export interface PaperDetail {
  id: string;
  level: number;
  durationSeconds: number;
  totalScore: number;
  passingScore: number;
  sections: PaperSection[];
}

// ── Attempt types ──

export interface Attempt {
  id: string;
  paperId: string;
  bankId: string;
  mode: AttemptMode;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  durationUsedSeconds: number;
  totalScore: number;
  objectiveScore: number;
  subjectiveScore: number;
}

export type AnswerMap = Record<string, AnswerValue>;

// ── Report types ──

export interface QuestionResult {
  id: string;
  paperQuestionId: string;
  questionType: HskQuestionType;
  isCorrect: boolean;
  rawScore: number;
  finalScore: number;
  answer?: AnswerValue;
  correctAnswer?: AnswerValue;
  explanation?: string;
}

export interface SectionResult {
  sectionId: string;
  code: SectionCode;
  title: string;
  scaledScore: number;
  results: QuestionResult[];
}

export interface AttemptReport {
  attemptId: string;
  totalScore: number;
  objectiveScore: number;
  subjectiveScore: number;
  passingScore: number;
  passed: boolean;
  sections: SectionResult[];
}

// ── Wrong question types ──

export interface WrongQuestion {
  id: string;
  bankId: string;
  level: number;
  sectionCode: SectionCode;
  questionType: HskQuestionType;
  paperQuestionId: string;
  yourAnswer?: AnswerValue;
  correctAnswer?: AnswerValue;
  explanation?: string;
  createdAt: string;
}

// ── Admin types (design doc §7.2) ──

export interface AdminUser {
  id: string;
  username: string;
  email?: string | null;
  displayName: string;
  isAdmin: boolean;
  status: string;
  uiLocale: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AdminSubscription {
  id: string;
  userId: string;
  username: string;
  bankId: string;
  bankLevel: number;
  bankName: string;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt?: string;
  source: string;
  note?: string;
  createdAt: string;
}

export interface EssayReviewItem {
  resultId: string;
  attemptId: string;
  questionType: string;
  answer: string;
  paperQuestionId: string;
  reviewMode: string;
  status: string;
  score?: number;
  reviewComment?: string;
  reviewerId?: string;
  completedAt?: string;
}

// ── Auth types ──

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  displayName: string;
  isAdmin: boolean;
  expiresAt?: string;
}

// ── Records types (G-003) ──

export interface RecordSummary {
  id: string;
  paperId: string;
  paperTitle: string;
  level: number;
  mode: AttemptMode;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  totalScore: number;
  objectiveScore: number;
  subjectiveScore: number;
}

// ── Knowledge types (G-005) ──

export interface KnowledgeCategory {
  id: string;
  name: string;
  description?: string;
  level?: number;
  documentCount: number;
}

export interface KnowledgeDocument {
  id: string;
  categoryId: string;
  title: string;
  snippet?: string;
  content?: string;
  tags?: string[];
  createdAt: string;
}

export interface AdminKnowledgeCategory {
  id: string;
  bankId?: string | null;
  name: string;
  description?: string;
  displayOrder: number;
  status: "draft" | "published";
  documentCount: number;
}

export interface AdminKnowledgeDocument {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  content: string;
  tags?: string[];
  displayOrder: number;
  status: "draft" | "published";
  createdAt: string;
}

// ── Feedback types (G-006) ──

export type FeedbackStatus = "open" | "replied" | "resolved" | "closed";

export interface Feedback {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  type: string;
  title: string;
  content: string;
  questionId?: string;
  status: FeedbackStatus;
  reply?: string;
  createdAt: string;
}

// ── Admin dashboard types (G-007) ──

export interface DashboardStats {
  totalUsers: number;
  totalBanks: number;
  totalPapers: number;
  totalKnowledgeDocs: number;
  activeSubscriptions: number;
  completedAttempts: number;
  openFeedback: number;
}

// ── Admin paper management types (G-009) ──

export interface AdminPaper {
  id: string;
  bankId: string;
  bankLevel: number;
  paperType: PaperType;
  year?: number;
  session?: string;
  title: string;
  durationSeconds: number;
  totalScore: number;
  passingScore: number;
  status: PaperStatus;
  questionCount?: number;
  createdAt: string;
}
