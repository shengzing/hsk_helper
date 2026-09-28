import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

vi.mock("../src/api", () => ({
  api: {
    getKnowledgeCategories: vi.fn(),
    getKnowledgeDocuments: vi.fn(),
    getKnowledgeDocument: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import { api } from "../src/api";
import KnowledgePage from "../src/pages/KnowledgePage";

const mockCategories = vi.mocked(api.getKnowledgeCategories);
const mockDocuments = vi.mocked(api.getKnowledgeDocuments);
const mockDocument = vi.mocked(api.getKnowledgeDocument);

const categories = [
  {
    id: "kc-hsk1-outline",
    name: "HSK 一级",
    documentCount: 4,
  },
];

const documents = [
  {
    id: "kd-hsk1-structure",
    categoryId: "kc-hsk1-outline",
    title: "HSK 一级考试结构",
  },
  {
    id: "kd-hsk1-outline",
    categoryId: "kc-hsk1-outline",
    title: "HSK 一级大纲要点",
  },
  {
    id: "kd-hsk1-vocabulary",
    categoryId: "kc-hsk1-outline",
    title: "HSK 一级核心词汇",
  },
  {
    id: "kd-hsk1-grammar",
    categoryId: "kc-hsk1-outline",
    title: "HSK 一级语法要点",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <KnowledgePage />
      </I18nextProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
  mockCategories.mockResolvedValue({ categories });
  mockDocuments.mockImplementation(async (categoryId: string) => ({
    documents: documents.filter((document) => document.categoryId === categoryId),
  }));
});

describe("KnowledgePage", () => {
  it("renders categories and documents in a tree", async () => {
    mockDocument.mockResolvedValue({
      document: {
        ...documents[0],
        content: "# HSK 一级考试结构",
      },
    });

    renderPage();

    expect(
      await screen.findByRole("treeitem", { name: /HSK 一级考试结构/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /HSK 一级大纲要点/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /HSK 一级核心词汇/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /HSK 一级语法要点/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("selects a document from the tree and shows its content", async () => {
    mockDocument.mockImplementation(async (documentId: string) => ({
      document: {
        ...documents.find((document) => document.id === documentId)!,
        content:
          documentId === "kd-hsk1-outline"
            ? "# HSK 一级大纲要点内容"
            : "# HSK 一级考试结构",
      },
    }));

    renderPage();

    await screen.findByRole("treeitem", {
      name: /HSK 一级大纲要点/,
    });
    const outlineNode = screen.getByTitle("HSK 一级大纲要点");
    await userEvent.click(outlineNode);

    await waitFor(() => {
      expect(screen.getByText("HSK 一级大纲要点内容")).toBeInTheDocument();
    });
  });

  it("shows a visible error when knowledge cannot be loaded", async () => {
    mockCategories.mockRejectedValue(new Error("failed"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("服务器错误，请稍后重试")).toBeInTheDocument();
    });
  });
});
