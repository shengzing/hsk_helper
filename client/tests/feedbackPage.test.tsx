import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import FeedbackPage from "../src/pages/FeedbackPage";

vi.mock("../src/api", () => ({
  api: {
    getFeedback: vi.fn(),
    createFeedback: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import { api } from "../src/api";

const mockFeedback = vi.mocked(api.getFeedback);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/zh-CN/feedback"]}>
      <I18nextProvider i18n={i18n}>
        <FeedbackPage />
      </I18nextProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
});

describe("FeedbackPage", () => {
  it("renders the localized feedback form and records", async () => {
    mockFeedback.mockResolvedValue({
      feedback: [
        {
          id: "fb-1",
          userId: "user-student",
          username: "student",
          type: "suggestion",
          title: "希望增加错题重练功能",
          content: "错题本里的题目如果能直接重练就更好了。",
          status: "open",
          createdAt: "2026-09-24T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("提交反馈")).toBeInTheDocument();
    });
    expect(screen.getByText("反馈类型")).toBeInTheDocument();
    expect(screen.getByText("详细内容")).toBeInTheDocument();
    expect(screen.getByText("希望增加错题重练功能")).toBeInTheDocument();
    expect(screen.getByText("功能建议")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
  });

  it("shows a visible error when feedback cannot be loaded", async () => {
    mockFeedback.mockRejectedValue(new Error("failed"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("服务器错误，请稍后重试")).toBeInTheDocument();
    });
  });
});
