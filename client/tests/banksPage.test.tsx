import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

// Mock the API module
vi.mock("../src/api", () => ({
  api: {
    getMySubscriptions: vi.fn(),
    getRecords: vi.fn(),
    getWrongQuestions: vi.fn(),
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
import BanksPage from "../src/pages/BanksPage";

const mockSub = vi.mocked(api.getMySubscriptions);
const mockRecords = vi.mocked(api.getRecords);
const mockWrongQuestions = vi.mocked(api.getWrongQuestions);

function renderWithRouter(ui: React.ReactNode, route = "/zh-CN/banks") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={i18n}>
        {ui}
      </I18nextProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
  mockRecords.mockResolvedValue({ records: [], stats: { totalAttempts: 0, passed: 0, avgScore: 0 } });
  mockWrongQuestions.mockResolvedValue({ wrongQuestions: [] });
});

describe("BanksPage", () => {
  it("shows skeleton while loading", () => {
    mockSub.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithRouter(<BanksPage />);
    const skeleton = document.querySelector(".ant-skeleton");
    expect(skeleton).toBeTruthy();
  });

  it("renders subscriptions when API succeeds", async () => {
    mockSub.mockResolvedValue({
      subscriptions: [
        {
          bankId: "hsk-level-4",
          level: 4,
          name: "HSK 四级真题包",
          status: "active",
          startsAt: "2026-09-01T00:00:00+08:00",
          expiresAt: "2027-09-01T00:00:00+08:00",
          paperCount: 4,
        },
      ],
    });
    renderWithRouter(<BanksPage />);
    await waitFor(() => {
      expect(screen.getByText("HSK 4 级")).toBeInTheDocument();
    });
    expect(screen.getByText("HSK 四级真题包")).toBeInTheDocument();
    expect(screen.getByText("真题数量: 4")).toBeInTheDocument();
    expect(screen.getByText("生效中")).toBeInTheDocument();
    expect(screen.getByText("练习次数")).toBeInTheDocument();
    expect(screen.getByText("错题本")).toBeInTheDocument();
  });

  it("shows empty state when no subscriptions", async () => {
    mockSub.mockResolvedValue({ subscriptions: [] });
    renderWithRouter(<BanksPage />);
    await waitFor(() => {
      expect(screen.getByText("您还没有开通任何等级真题包")).toBeInTheDocument();
    });
  });

  it("sorts banks with papers first and marks empty banks", async () => {
    mockSub.mockResolvedValue({
      subscriptions: [
        {
          bankId: "hsk-level-4",
          level: 4,
          name: "HSK 四级真题包",
          status: "active",
          startsAt: "2026-09-01T00:00:00+08:00",
          expiresAt: "2027-09-01T00:00:00+08:00",
          paperCount: 0,
        },
        {
          bankId: "hsk-level-6",
          level: 6,
          name: "HSK 六级真题包",
          status: "active",
          startsAt: "2026-09-01T00:00:00+08:00",
          expiresAt: "2027-09-01T00:00:00+08:00",
          paperCount: 4,
        },
      ],
    });

    renderWithRouter(<BanksPage />);

    await waitFor(() => {
      expect(screen.getByText("HSK 六级真题包")).toBeInTheDocument();
    });
    expect(screen.getByText("暂无真题")).toBeInTheDocument();
    expect(screen.getByText("真题数量: 4")).toBeInTheDocument();
    const hsk4 = screen.getByText("HSK 4 级");
    const hsk6 = screen.getByText("HSK 6 级");
    expect(
      hsk6.compareDocumentPosition(hsk4) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("shows error message when API fails with network error", async () => {
    const { ApiError } = await import("../src/api");
    mockSub.mockRejectedValue(new ApiError("NETWORK", "Network error", 500));
    renderWithRouter(<BanksPage />);
    await waitFor(() => {
      expect(screen.getByText("网络错误，请检查连接")).toBeInTheDocument();
    });
  });

  it("shows unauthorized message when API returns 401", async () => {
    const { ApiError } = await import("../src/api");
    mockSub.mockRejectedValue(new ApiError("UNAUTHORIZED", "Please log in", 401));
    renderWithRouter(<BanksPage />);
    await waitFor(() => {
      expect(screen.getByText("请先登录")).toBeInTheDocument();
    });
  });
});
