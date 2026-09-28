import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import RecordDetailPage from "../src/pages/RecordDetailPage";

vi.mock("../src/api", () => ({
  api: {
    getRecord: vi.fn(),
    getReport: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import { api } from "../src/api";

const mockRecord = vi.mocked(api.getRecord);
const mockReport = vi.mocked(api.getReport);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/zh-CN/records/attempt-1"]}>
      <Routes>
        <Route path="/:locale/records/:recordId" element={
          <I18nextProvider i18n={i18n}>
            <RecordDetailPage />
          </I18nextProvider>
        } />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
  vi.clearAllMocks();
});

describe("RecordDetailPage", () => {
  it("passes the record attempt id to the report component", async () => {
    mockRecord.mockResolvedValue({
      record: {
        id: "attempt-1",
        paperId: "paper-h61438",
        paperTitle: "HSK 六级真题 H61438",
        bankId: "hsk-level-6",
        level: 6,
        mode: "exam",
        status: "graded",
        startedAt: "2026-09-24T00:00:00.000Z",
        submittedAt: "2026-09-24T01:00:00.000Z",
        durationUsedSeconds: 3600,
        totalScore: 180,
        objectiveScore: 180,
        subjectiveScore: 0,
      },
    });
    mockReport.mockResolvedValue({
      report: {
        attemptId: "attempt-1",
        totalScore: 180,
        objectiveScore: 180,
        subjectiveScore: 0,
        passingScore: 180,
        passed: true,
        sections: [],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(mockReport).toHaveBeenCalledWith("attempt-1");
    });
    expect(screen.getByText("HSK 六级真题 H61438")).toBeInTheDocument();
    expect(screen.getByText("成绩报告")).toBeInTheDocument();
  });
});
