import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import AnswerSheet from "../src/components/exam/AnswerSheet";
import type { AnswerMap, PaperDetail } from "../src/types";

const paper: PaperDetail = {
  id: "paper-1",
  level: 6,
  durationSeconds: 8400,
  totalScore: 300,
  passingScore: 180,
  sections: [
    {
      id: "section-listening",
      code: "listening",
      title: "听力",
      groups: [
        {
          id: "group-listening",
          type: "material",
          payload: {
            parts: [
              { partNumber: 1, instruction: "第 1-15 题", questionNumbers: [1] },
              { partNumber: 2, instruction: "第 16-30 题", questionNumbers: [2] },
            ],
          },
          questions: [
            {
              id: "pq-1",
              questionType: "single_choice",
              payload: { options: [] },
              score: 2,
              displayOrder: 1,
            },
            {
              id: "pq-2",
              questionType: "single_choice",
              payload: { options: [] },
              score: 2,
              displayOrder: 2,
            },
          ],
        },
      ],
    },
    {
      id: "section-reading",
      code: "reading",
      title: "阅读",
      groups: [
        {
          id: "group-grammar",
          type: "material",
          payload: { partNumber: 1 },
          questions: [
            {
              id: "pq-3",
              questionType: "single_choice",
              payload: { options: [] },
              score: 2,
              displayOrder: 3,
            },
          ],
        },
        {
          id: "group-cloze",
          type: "material",
          payload: { partNumber: 2 },
          questions: [
            {
              id: "pq-4",
              questionType: "single_choice",
              payload: { options: [] },
              score: 2,
              displayOrder: 4,
            },
          ],
        },
      ],
    },
    {
      id: "section-writing",
      code: "writing",
      title: "书写",
      groups: [
        {
          id: "group-writing",
          type: "material",
          questions: [
            {
              id: "pq-5",
              questionType: "essay",
              payload: { taskType: "summary" },
              score: 100,
              displayOrder: 5,
            },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  void i18n.changeLanguage("zh-CN");
});

describe("AnswerSheet", () => {
  it("groups navigation by the original HSK parts", () => {
    const answers: AnswerMap = {
      "pq-1": { type: "choice", value: "A" },
    };

    render(
      <I18nextProvider i18n={i18n}>
        <AnswerSheet
          paper={paper}
          answers={answers}
          currentIndex={0}
          onSelect={() => {}}
        />
      </I18nextProvider>
    );

    expect(screen.getByText("听力")).toBeInTheDocument();
    expect(screen.getByText("阅读")).toBeInTheDocument();
    expect(screen.getByText("书写")).toBeInTheDocument();
    expect(screen.getAllByText(/第 1 部分/)).toHaveLength(2);
    expect(screen.getAllByText(/第 2 部分/)).toHaveLength(2);
    expect(screen.getAllByText("第 5 题").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1/1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0/1").length).toBeGreaterThan(0);
  });

  it("keeps global question indexes when navigating from a part group", () => {
    const onSelect = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <AnswerSheet
          paper={paper}
          answers={{}}
          currentIndex={0}
          onSelect={onSelect}
        />
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
