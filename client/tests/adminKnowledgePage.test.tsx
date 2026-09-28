import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

vi.mock("../src/api", () => ({
  api: {
    adminGetKnowledgeCategories: vi.fn(),
    adminGetKnowledgeDocuments: vi.fn(),
    adminCreateKnowledgeCategory: vi.fn(),
    adminUpdateKnowledgeCategory: vi.fn(),
    adminCreateKnowledgeDocument: vi.fn(),
    adminUpdateKnowledgeDocument: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import { api } from "../src/api";
import AdminKnowledgePage from "../src/pages/admin/AdminKnowledgePage";

const mockCategories = vi.mocked(api.adminGetKnowledgeCategories);
const mockDocuments = vi.mocked(api.adminGetKnowledgeDocuments);

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <AdminKnowledgePage />
      </I18nextProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
});

describe("Admin KnowledgePage", () => {
  it("renders categories and documents", async () => {
    mockCategories.mockResolvedValue({
      categories: [
        {
          id: "kc-hsk3-overview",
          name: "HSK 3.0 总览",
          bankId: null,
          displayOrder: 1,
          status: "published",
          documentCount: 1,
        },
      ],
    });
    mockDocuments.mockResolvedValue({
      documents: [
        {
          id: "kd-hsk3-overview",
          categoryId: "kc-hsk3-overview",
          categoryName: "HSK 3.0 总览",
          title: "HSK 3.0 官方总览",
          content: "# HSK 3.0 官方总览",
          tags: ["HSK", "官方", "大纲"],
          displayOrder: 1,
          status: "published",
          createdAt: "2026-09-25T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("HSK 3.0 总览")).toBeInTheDocument();
    });
    expect(screen.getByText("新建分类")).toBeInTheDocument();
    expect(screen.getByText("新建文档")).toBeInTheDocument();
  });

  it("shows a visible error when knowledge management cannot be loaded", async () => {
    mockCategories.mockRejectedValue(new Error("failed"));
    mockDocuments.mockRejectedValue(new Error("failed"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("服务器错误，请稍后重试")).toBeInTheDocument();
    });
  });
});
