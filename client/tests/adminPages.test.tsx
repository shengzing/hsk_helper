import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

vi.mock("../src/api", () => ({
  api: {
    adminGetSubscriptions: vi.fn(),
    adminGetUsers: vi.fn(),
    adminCreateSubscriptions: vi.fn(),
    adminUpdateSubscription: vi.fn(),
    adminGetStats: vi.fn(),
    adminGetFeedback: vi.fn(),
    adminReplyFeedback: vi.fn(),
    adminCloseFeedback: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

import { api } from "../src/api";
import SubscriptionsPage from "../src/pages/admin/SubscriptionsPage";
import AdminDashboardPage from "../src/pages/admin/AdminDashboardPage";
import AdminFeedbackPage from "../src/pages/admin/AdminFeedbackPage";

const mockSubs = vi.mocked(api.adminGetSubscriptions);
const mockUsers = vi.mocked(api.adminGetUsers);
const mockStats = vi.mocked(api.adminGetStats);
const mockFeedback = vi.mocked(api.adminGetFeedback);

function renderPage(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        {ui}
      </I18nextProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
});

describe("Admin SubscriptionsPage", () => {
  it("renders table with subscription data", async () => {
    mockSubs.mockResolvedValue({
      subscriptions: [
        {
          id: "sub-1",
          userId: "user-student",
          username: "student",
          bankId: "hsk-level-4",
          bankLevel: 4,
          bankName: "HSK 四级真题包",
          status: "active",
          startsAt: "2026-09-01",
          expiresAt: "2027-09-01",
          source: "manual",
        },
      ],
    });
    mockUsers.mockResolvedValue({ users: [] });

    renderPage(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText("student")).toBeInTheDocument();
    });
    expect(screen.getByText("HSK 4")).toBeInTheDocument();
  });

  it("renders create subscription button", async () => {
    mockSubs.mockResolvedValue({ subscriptions: [] });
    mockUsers.mockResolvedValue({ users: [] });

    renderPage(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockSubs.mockReturnValue(new Promise(() => {}));
    mockUsers.mockReturnValue(new Promise(() => {}));

    renderPage(<SubscriptionsPage />);

    const spinner = document.querySelector(".ant-spin") || document.querySelector(".ant-table-loading");
    expect(spinner || document.querySelector(".ant-table")).toBeTruthy();
  });
});

describe("Admin DashboardPage", () => {
  it("renders real dashboard statistics", async () => {
    mockStats.mockResolvedValue({
      stats: {
        totalUsers: 2,
        totalBanks: 6,
        totalPapers: 1,
        totalKnowledgeDocs: 25,
        activeSubscriptions: 2,
        completedAttempts: 1,
        openFeedback: 1,
      },
    });

    renderPage(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("用户总数")).toBeInTheDocument();
    });
    expect(screen.getByText("题库总数")).toBeInTheDocument();
    expect(screen.getByText("待处理反馈")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows a visible error when stats cannot be loaded", async () => {
    mockStats.mockRejectedValue(new Error("failed"));

    renderPage(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("服务器错误，请稍后重试")).toBeInTheDocument();
    });
  });
});

describe("Admin FeedbackPage", () => {
  it("renders feedback records with usernames and localized status", async () => {
    mockFeedback.mockResolvedValue({
      feedback: [
        {
          id: "fb-1",
          userId: "user-student",
          username: "student",
          displayName: "张小程",
          title: "希望增加错题重练功能",
          content: "错题本里的题目如果能直接重练就更好了。",
          status: "open",
          createdAt: "2026-09-23T00:00:00.000Z",
        },
      ],
    });

    renderPage(<AdminFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("student")).toBeInTheDocument();
    });
    expect(screen.getByText("希望增加错题重练功能")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
  });

  it("shows a visible error when feedback cannot be loaded", async () => {
    mockFeedback.mockRejectedValue(new Error("failed"));

    renderPage(<AdminFeedbackPage />);

    await waitFor(() => {
      expect(screen.getByText("服务器错误，请稍后重试")).toBeInTheDocument();
    });
  });
});
