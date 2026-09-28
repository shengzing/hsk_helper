import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";
import SingleChoice from "../src/components/questions/SingleChoice";
import TrueFalse from "../src/components/questions/TrueFalse";
import QuestionRenderer from "../src/components/questions/QuestionRenderer";
import Essay from "../src/components/questions/Essay";
import MaterialPanel from "../src/components/exam/MaterialPanel";
import type { PaperQuestion, AnswerValue } from "../src/types";

function renderWithI18n(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("SingleChoice renderer", () => {
  const question: PaperQuestion = {
    id: "pq-1",
    questionType: "single_choice",
    stem: "无论做什么事情，都应该按照一定的______。",
    payload: {
      options: [
        { key: "A", text: "去超市" },
        { key: "B", text: "去爬山" },
        { key: "C", text: "买衣服" },
        { key: "D", text: "在看书" },
      ],
    },
    score: 3,
    displayOrder: 1,
  };

  it("renders all 4 options", () => {
    renderWithI18n(<SingleChoice question={question} value={null} onChange={() => {}} />);
    expect(screen.getByText("无论做什么事情，都应该按照一定的______。")).toBeInTheDocument();
    expect(screen.getByText("A.")).toBeInTheDocument();
    expect(screen.getByText("B.")).toBeInTheDocument();
    expect(screen.getByText("C.")).toBeInTheDocument();
    expect(screen.getByText("D.")).toBeInTheDocument();
    expect(screen.getByText("去超市")).toBeInTheDocument();
    expect(screen.getByText("去爬山")).toBeInTheDocument();
  });

  it("calls onChange with choice value when option clicked", () => {
    const onChange = vi.fn();
    renderWithI18n(<SingleChoice question={question} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("去爬山"));
    expect(onChange).toHaveBeenCalledWith({ type: "choice", value: "B" });
  });

  it("shows selected state when value is set", () => {
    const value: AnswerValue = { type: "choice", value: "B" };
    renderWithI18n(<SingleChoice question={question} value={value} onChange={() => {}} />);
    // The radio for B should be checked
    const radioB = screen.getByRole("radio", { name: /去爬山/i });
    expect(radioB).toBeChecked();
  });
});

describe("TrueFalse renderer", () => {
  const question: PaperQuestion = {
    id: "pq-2",
    questionType: "true_false",
    payload: {
      displayText: "明天天气很好。",
      trueLabel: "对",
      falseLabel: "错",
    },
    score: 2,
    displayOrder: 2,
  };

  it("renders the statement text", () => {
    renderWithI18n(<TrueFalse question={question} value={null} onChange={() => {}} />);
    expect(screen.getByText("明天天气很好。")).toBeInTheDocument();
  });

  it("renders true and false buttons", () => {
    renderWithI18n(<TrueFalse question={question} value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "对" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "错" })).toBeInTheDocument();
  });

  it("calls onChange with boolean true when 对 clicked", () => {
    const onChange = vi.fn();
    renderWithI18n(<TrueFalse question={question} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "对" }));
    expect(onChange).toHaveBeenCalledWith({ type: "boolean", value: true });
  });

  it("calls onChange with boolean false when 错 clicked", () => {
    const onChange = vi.fn();
    renderWithI18n(<TrueFalse question={question} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "错" }));
    expect(onChange).toHaveBeenCalledWith({ type: "boolean", value: false });
  });
});

describe("QuestionRenderer dispatch", () => {
  it("renders SingleChoice for single_choice type", () => {
    const question: PaperQuestion = {
      id: "pq-3",
      questionType: "single_choice",
      payload: { options: [{ key: "A", text: "Yes" }, { key: "B", text: "No" }] },
      score: 1,
      displayOrder: 1,
    };
    renderWithI18n(<QuestionRenderer question={question} value={null} onChange={() => {}} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders TrueFalse for true_false type", () => {
    const question: PaperQuestion = {
      id: "pq-4",
      questionType: "true_false",
      payload: { displayText: "Test statement", trueLabel: "对", falseLabel: "错" },
      score: 1,
      displayOrder: 2,
    };
    renderWithI18n(<QuestionRenderer question={question} value={null} onChange={() => {}} />);
    expect(screen.getByText("Test statement")).toBeInTheDocument();
  });

  it("renders fallback for unknown type", () => {
    const question = {
      id: "pq-5",
      questionType: "unknown" as any,
      payload: {},
      score: 1,
      displayOrder: 3,
    };
    renderWithI18n(<QuestionRenderer question={question as any} value={null} onChange={() => {}} />);
    expect(screen.getByText(/Unknown question type/)).toBeInTheDocument();
  });
});

describe("Essay renderer", () => {
  it("renders imported writing material", () => {
    const question: PaperQuestion = {
      id: "pq-essay",
      questionType: "essay",
      payload: {
        taskType: "summary",
        readingMinutes: 10,
        writingMinutes: 35,
        targetLength: 400,
        material: "这是一篇需要缩写的原文材料。",
        rules: ["标题自拟"],
      },
      score: 100,
      displayOrder: 101,
    };

    renderWithI18n(<Essay question={question} value={null} onChange={() => {}} />);
    expect(screen.getByText("这是一篇需要缩写的原文材料。")).toBeInTheDocument();
  });
});

describe("MaterialPanel", () => {
  it("shows the current listening part from the original paper structure", () => {
    renderWithI18n(
      <MaterialPanel
        attemptId="attempt-1"
        currentQuestionNumber={18}
        group={{
          id: "group-listening",
          type: "material",
          instruction: "听力",
          payload: {
            parts: [
              { partNumber: 1, instruction: "第 1-15 题", questionNumbers: [1, 15] },
              {
                partNumber: 2,
                instruction: "第 16-30 题：请选出正确答案。",
                questionNumbers: [16, 17, 18, 30],
              },
            ],
          },
          questions: [],
        }}
      />
    );

    expect(screen.getByText(/第 2 部分/)).toBeInTheDocument();
    expect(screen.getByText(/第 16-30 题：请选出正确答案。/)).toBeInTheDocument();
  });

  it("renders shared text and audio metadata", () => {
    renderWithI18n(
      <MaterialPanel
        attemptId="attempt-1"
        group={{
          id: "group-1",
          type: "material",
          instruction: "听力",
          material: {
            title: "听力材料",
            textContent: "听录音，选择正确答案。",
            audio: { assetId: "asset-1", playLimit: 2 },
          },
          questions: [],
        }}
      />
    );

    expect(screen.getByText("听力")).toBeInTheDocument();
    expect(screen.getByText("听录音，选择正确答案。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });
});
