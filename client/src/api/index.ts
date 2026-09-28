import type {
  AdminPaper,
  AdminKnowledgeCategory,
  AdminKnowledgeDocument,
  AdminSubscription,
  AdminUser,
  AnswerMap,
  Attempt,
  AttemptReport,
  AuthUser,
  BankInfo,
  DashboardStats,
  EssayReviewItem,
  Feedback,
  KnowledgeCategory,
  KnowledgeDocument,
  LocaleInfo,
  PaperDetail,
  PaperSummary,
 RecordSummary,
 Subscription,
  SubscriptionPlans,
  PurchaseResult,
 WrongQuestion,
} from "../types";

const API_BASE = "/api";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface DataEnvelope<T> {
  data?: T;
}

interface LocaleRow {
  id: string;
  language_name: string;
  endonym: string;
  direction: "ltr" | "rtl";
  is_default: boolean | number;
}

interface RecordStats {
  totalAttempts: number;
  passed: number;
  avgScore: number;
}

type FeedbackRow = Omit<Feedback, "reply"> & {
  adminReply?: string | null;
  paperQuestionId?: string | null;
  userUsername?: string;
  userDisplayName?: string;
};

type RecordRow = Omit<RecordSummary, "level"> & {
  bankLevel?: number;
  level?: number;
};

type WrongQuestionRow = Omit<WrongQuestion, "level"> & {
  bankLevel?: number;
  level?: number;
};

type AdminKnowledgeDocumentRow = Omit<AdminKnowledgeDocument, "tags"> & {
  tags?: string | null;
};

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
}

function toCamelCase<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map(item => toCamelCase<unknown>(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      result[camelKey(key)] = toCamelCase<unknown>(item);
    }
    return result as T;
  }
  return value as T;
}

async function requestRaw<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = body?.error ?? {};
    if (
      response.status === 401 &&
     path !== "/auth/login" &&
     path !== "/auth/logout" &&
     path !== "/auth/register" &&
     typeof window !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent("hsk:unauthorized"));
    }
    throw new ApiError(err.code ?? "UNKNOWN", err.message ?? `HTTP ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

async function requestData<T>(path: string, options?: RequestInit): Promise<T> {
  const body = await requestRaw<DataEnvelope<T>>(path, options);
  return toCamelCase<T>(body.data as T);
}

function normalizeFeedback(row: FeedbackRow): Feedback {
  const { adminReply, paperQuestionId, userUsername, userDisplayName, ...rest } = row;
  return {
    ...rest,
    username: userUsername ?? row.username,
    displayName: userDisplayName,
    reply: adminReply ?? undefined,
    questionId: paperQuestionId ?? undefined,
  };
}

function normalizeRecord(row: RecordRow): RecordSummary {
  const { bankLevel, ...rest } = row;
  return { ...rest, level: bankLevel ?? rest.level ?? 0 };
}

function normalizeWrongQuestion(row: WrongQuestionRow): WrongQuestion {
  const { bankLevel, ...rest } = row;
  return { ...rest, level: bankLevel ?? rest.level ?? 0 };
}

function normalizeAdminKnowledgeDocument(row: AdminKnowledgeDocumentRow): AdminKnowledgeDocument {
  return {
    ...row,
    tags: typeof row.tags === "string"
      ? row.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
      : [],
  };
}

export const api = {
  getMe: async () => ({ data: await requestData<AuthUser | null>("/auth/me") }),
 login: async (username: string, password: string) => ({
   data: await requestData<AuthUser>("/auth/login", {
     method: "POST",
     body: JSON.stringify({ username, password }),
   }),
 }),
  register: async (email: string, password: string, displayName?: string) => ({
    data: await requestData<AuthUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  }),
 logout: async () => {
    await requestRaw("/auth/logout", { method: "POST" });
    return { ok: true };
  },

  getLocales: async () => {
    const body = await requestRaw<{ locales: LocaleRow[] }>("/locales");
    return {
      locales: body.locales.map<LocaleInfo>(row => ({
        id: row.id,
        languageName: row.language_name,
        endonym: row.endonym,
        direction: row.direction,
        isDefault: row.is_default === true || row.is_default === 1,
      })),
    };
  },
  updatePreferences: async (uiLocale: string) => {
    await requestData("/me/preferences", {
      method: "PATCH",
      body: JSON.stringify({ ui_locale: uiLocale }),
    });
    return { uiLocale };
  },

 getMySubscriptions: async () => ({
   subscriptions: await requestData<Subscription[]>("/subscriptions/me"),
 }),
  getSubscriptionPlans: async () => ({
    plans: await requestData<SubscriptionPlans>("/subscriptions/plans"),
  }),
  purchaseSubscription: async (orderType: "full" | "single", bankIds?: string[]) => ({
    result: await requestData<PurchaseResult>("/subscriptions/purchase", {
      method: "POST",
      body: JSON.stringify({ orderType, bankIds }),
    }),
  }),
  getBanks: async () => ({
    banks: await requestData<BankInfo[]>("/banks"),
  }),
  getPapers: async (bankId: string) => ({
    papers: await requestData<PaperSummary[]>(`/banks/${bankId}/papers`),
  }),
  getPaper: async (paperId: string) => ({
    paper: await requestData<PaperDetail>(`/papers/${paperId}`),
  }),

  createAttempt: async (paperId: string) => {
    const created = await requestData<{ attemptId: string }>(`/papers/${paperId}/attempts`, {
      method: "POST",
    });
    const attempt = await requestData<Attempt>(`/attempts/${created.attemptId}`);
    return { attempt };
  },
  getAttempt: async (attemptId: string) => ({
    attempt: await requestData<Attempt>(`/attempts/${attemptId}`),
  }),
  saveAnswers: async (attemptId: string, answers: AnswerMap) => {
    const result = await requestData<{ saved: number }>(`/attempts/${attemptId}/answers`, {
      method: "PATCH",
      body: JSON.stringify({ answers }),
    });
    return { saved: Boolean(result.saved) };
  },
  submitAttempt: async (attemptId: string) => {
    await requestRaw(`/attempts/${attemptId}/submit`, { method: "POST" });
    const attempt = await requestData<Attempt>(`/attempts/${attemptId}`);
    return { attempt };
  },
  getReport: async (attemptId: string) => ({
    report: await requestData<AttemptReport>(`/attempts/${attemptId}/report`),
  }),

  logAudioEvent: async (
    attemptId: string,
    data: {
      assetId: string;
      materialId?: string;
      eventType: "play" | "pause" | "ended";
      positionMs: number;
    }
  ) => {
    await requestData(`/attempts/${attemptId}/audio-events`, {
      method: "POST",
      body: JSON.stringify({
        asset_id: data.assetId,
        material_id: data.materialId,
        event_type: data.eventType,
        played_at: new Date().toISOString(),
        position_ms: data.positionMs,
      }),
    });
    return { logged: true };
  },

  getWrongQuestions: async () => ({
    wrongQuestions: (await requestData<WrongQuestionRow[]>("/wrong-questions"))
      .map(normalizeWrongQuestion),
  }),

  getRecords: async () => {
    const data = await requestData<{ records: RecordSummary[]; stats: RecordStats }>("/records");
    return { records: data.records.map(normalizeRecord), stats: data.stats };
  },
  getRecord: async (recordId: string) => {
    const row = await requestData<RecordRow>(`/records/${recordId}`);
    return { record: normalizeRecord(row) };
  },

  getKnowledgeCategories: async () => ({
    categories: await requestData<KnowledgeCategory[]>("/knowledge"),
  }),
  getKnowledgeDocuments: async (categoryId: string) => ({
    documents: await requestData<KnowledgeDocument[]>(`/knowledge/${categoryId}/documents`),
  }),
  getKnowledgeDocument: async (documentId: string) => ({
    document: await requestData<KnowledgeDocument>(`/knowledge/documents/${documentId}`),
  }),

  getFeedback: async () => {
    const rows = await requestData<FeedbackRow[]>("/feedback");
    return { feedback: rows.map(normalizeFeedback) };
  },
  createFeedback: async (data: {
    type?: string;
    title: string;
    content: string;
    questionId?: string;
  }) => {
    const created = await requestData<{ id: string }>("/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: data.type ?? "other",
        title: data.title,
        content: data.content,
        paperQuestionId: data.questionId,
      }),
    });
    return { feedback: { id: created.id } as Feedback };
  },
  adminGetFeedback: async () => {
    const rows = await requestData<FeedbackRow[]>("/admin/feedback");
    return { feedback: rows.map(normalizeFeedback) };
  },
  adminReplyFeedback: async (id: string, reply: string) => {
    await requestData(`/admin/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ adminReply: reply, status: "replied" }),
    });
    return { updated: true };
  },
  adminCloseFeedback: async (id: string) => {
    await requestData(`/admin/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed" }),
    });
    return { updated: true };
  },

  adminGetUsers: async () => ({
    users: await requestData<AdminUser[]>("/admin/users"),
  }),
  adminCreateUser: async (data: { username: string; email?: string; displayName: string; isAdmin?: boolean }) => {
  const user = await requestData<AdminUser>("/admin/users", {
     method: "POST",
     body: JSON.stringify({
       username: data.username,
       email: data.email,
       name: data.displayName,
       displayName: data.displayName,
       isAdmin: data.isAdmin ?? false,
     }),
   });
   return { user };
 },
  adminUpdateUser: async (userId: string, data: Partial<AdminUser>) => {
    const user = await requestData<AdminUser>(`/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return { user };
  },

  adminGetSubscriptions: async () => ({
    subscriptions: await requestData<AdminSubscription[]>("/admin/subscriptions"),
  }),
  adminCreateSubscriptions: async (data: {
    userIds: string[];
    bankId: string;
    startsAt: string;
    expiresAt?: string;
    note?: string;
  }) => {
    const result = await requestData<{ created: number }>("/admin/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        subscriptions: data.userIds.map(userId => ({
          userId,
          bankId: data.bankId,
          startsAt: data.startsAt,
          expiresAt: data.expiresAt,
          note: data.note,
        })),
      }),
    });
    return { created: result.created };
  },
  adminUpdateSubscription: async (
    subscriptionId: string,
    data: { status?: string; startsAt?: string; expiresAt?: string; note?: string }
  ) => {
    await requestData(`/admin/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { updated: true };
  },

  adminGetEssayReviews: async () => ({
    reviews: await requestData<EssayReviewItem[]>("/admin/reviews/essays"),
  }),
  adminUpdateEssayReview: async (
    resultId: string,
    data: { score?: number; reviewComment?: string; completed?: boolean }
  ) => {
    await requestData(`/admin/reviews/essays/${resultId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { updated: true };
  },

  adminGetStats: async () => ({
    stats: (await requestData<{ stats: DashboardStats }>("/admin/stats")).stats,
  }),

  adminGetKnowledgeCategories: async () => ({
    categories: await requestData<AdminKnowledgeCategory[]>("/admin/knowledge/categories"),
  }),
  adminCreateKnowledgeCategory: async (data: Omit<AdminKnowledgeCategory, "id" | "documentCount">) => {
    const created = await requestData<{ id: string }>("/admin/knowledge/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { id: created.id };
  },
  adminUpdateKnowledgeCategory: async (categoryId: string, data: Partial<AdminKnowledgeCategory>) => {
    await requestData(`/admin/knowledge/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { updated: true };
  },
  adminGetKnowledgeDocuments: async () => ({
    documents: (await requestData<AdminKnowledgeDocumentRow[]>("/admin/knowledge/documents"))
      .map(normalizeAdminKnowledgeDocument),
  }),
  adminCreateKnowledgeDocument: async (data: Omit<AdminKnowledgeDocument, "id" | "categoryName" | "createdAt">) => {
    const created = await requestData<{ id: string }>("/admin/knowledge/documents", {
      method: "POST",
      body: JSON.stringify({ ...data, tags: data.tags?.join(",") }),
    });
    return { id: created.id };
  },
  adminUpdateKnowledgeDocument: async (
    documentId: string,
    data: Partial<Omit<AdminKnowledgeDocument, "id" | "categoryName" | "createdAt">>
  ) => {
    await requestData(`/admin/knowledge/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...data, tags: data.tags?.join(",") }),
    });
    return { updated: true };
  },

  adminGetPapers: async () => ({
    papers: await requestData<AdminPaper[]>("/admin/papers"),
  }),
  adminCreatePaper: async (data: Partial<AdminPaper>) => {
    const created = await requestData<{ paperId: string }>("/admin/papers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { paperId: created.paperId };
  },
  adminUpdatePaper: async (paperId: string, data: Partial<AdminPaper>) => {
    await requestData(`/admin/papers/${paperId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { updated: true };
  },
};
